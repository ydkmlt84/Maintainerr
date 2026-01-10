import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collection } from '../../collections/entities/collection.entities';
import { CollectionMedia } from '../../collections/entities/collection_media.entities';
import { Exclusion } from '../../rules/entities/exclusion.entities';
import { EPlexDataType } from './enums/plex-data-type-enum';
import { PlexLibraryItem } from './interfaces/library.interfaces';
import { PlexApiService } from './plex-api.service';

export interface EnrichedLibraryItem extends PlexLibraryItem {
  maintainerrExclusionId?: number;
  maintainerrExclusionType?: 'global' | 'specific';
  maintainerrExclusionTargets?: { id?: number; label: string }[];
  maintainerrIsManual?: boolean;
  maintainerrCollections?: {
    id: number;
    title: string;
    isManual?: boolean;
    daysLeft?: number;
  }[];
  maintainerrDaysLeft?: number;
}

@Injectable()
export class LibraryEnrichmentService {
  constructor(
    private readonly plexApiService: PlexApiService,
    @InjectRepository(Exclusion)
    private readonly exclusionRepo: Repository<Exclusion>,
    @InjectRepository(CollectionMedia)
    private readonly collectionMediaRepo: Repository<CollectionMedia>,
  ) {}

  public async getEnrichedLibrary(
    id: string,
    {
      offset = 0,
      size = 50,
      sort,
      all,
      datatype,
    }: {
      offset?: number;
      size?: number;
      sort?: string;
      all?: boolean | string | number;
      datatype?: EPlexDataType;
    } = {},
  ): Promise<{ totalSize: number; items: EnrichedLibraryItem[] }> {
    const fetchAll = all === true || all === 'true' || all === 1 || all === '1';

    const base = fetchAll
      ? await this.plexApiService.getLibraryContentsAll(
          id,
          sort,
          size,
          datatype,
        )
      : await this.plexApiService.getLibraryContents(
          id,
          { offset, size },
          datatype,
          true,
          sort,
        );

    if (!base) {
      return { totalSize: 0, items: [] };
    }

    const exclusions = await this.fetchExclusionMap();
    const collections = await this.fetchCollectionMap();

    const enriched: EnrichedLibraryItem[] = (base.items ?? []).map((item) => {
      const exclusion = exclusions.get(+item.ratingKey);
      const collectionInfo = collections.get(+item.ratingKey) ?? [];
      const daysLefts = collectionInfo
        .map((c) => c.daysLeft)
        .filter((d): d is number => d !== undefined);
      const minDaysLeft =
        daysLefts.length > 0 ? Math.min(...daysLefts) : undefined;
      const isManual = collectionInfo.some((c) => c.isManual);

      return {
        ...item,
        maintainerrExclusionId: exclusion?.id,
        maintainerrExclusionType: exclusion?.type,
        maintainerrExclusionLabels: exclusion?.labels,
        maintainerrExclusionTargets: exclusion?.targets,
        maintainerrIsManual: isManual,
        maintainerrCollections: collectionInfo,
        maintainerrDaysLeft: minDaysLeft,
      };
    });

    return { totalSize: base.totalSize, items: enriched };
  }

  private async fetchExclusionMap(): Promise<
    Map<
      number,
      {
        id: number;
        type: 'global' | 'specific';
        labels: string[];
        targets: { id?: number; label: string }[];
      }
    >
  > {
    const rows = await this.exclusionRepo
      .createQueryBuilder('exclusion')
      .leftJoin('rule_group', 'rg', 'rg.id = exclusion.ruleGroupId')
      .leftJoin('collection', 'c', 'c.id = rg.collectionId')
      .select([
        'exclusion.id as id',
        'exclusion.plexId as plexId',
        'exclusion.parent as parent',
        'exclusion.ruleGroupId as ruleGroupId',
        'c.id as collectionId',
        'c.title as collectionTitle',
        'rg.name as ruleGroupName',
      ])
      .getRawMany();

    const map = new Map<
      number,
      {
        id: number;
        type: 'global' | 'specific';
        labels: string[];
        targets: { id?: number; label: string }[];
      }
    >();

    const add = (plexId: number, row: any) => {
      const label =
        row.ruleGroupId === null
          ? 'Global'
          : row.collectionTitle || row.ruleGroupName || 'Collection';
      const target = row.ruleGroupId === null ? undefined : row.collectionId;
      const existing = map.get(plexId);
      if (existing) {
        if (!existing.labels.includes(label)) {
          existing.labels.push(label);
          existing.targets.push({ id: target, label });
        }
        existing.id = existing.id ?? row.id;
        existing.type =
          existing.type === 'global' || row.ruleGroupId === null
            ? 'global'
            : 'specific';
      } else {
        map.set(plexId, {
          id: row.id,
          type: row.ruleGroupId === null ? 'global' : 'specific',
          labels: [label],
          targets: [{ id: target, label }],
        });
      }
    };

    rows.forEach((row) => {
      add(row.plexId, row);
      if (row.parent) {
        add(row.parent, row);
      }
    });

    return map;
  }

  private async fetchCollectionMap(): Promise<
    Map<
      number,
      { id: number; title: string; isManual?: boolean; daysLeft?: number }[]
    >
  > {
    const medias = await this.collectionMediaRepo.find({
      relations: ['collection'],
    });

    const map = new Map<
      number,
      { id: number; title: string; isManual?: boolean; daysLeft?: number }[]
    >();

    medias.forEach((cm) => {
      const collection = cm.collection as unknown as Collection;
      const daysLeft =
        collection?.deleteAfterDays != null
          ? Math.ceil(
              (new Date(cm.addDate).getTime() +
                collection.deleteAfterDays * 24 * 60 * 60 * 1000 -
                Date.now()) /
                (1000 * 60 * 60 * 24),
            )
          : undefined;

      const entry = {
        id: collection?.id,
        title: collection?.title,
        isManual: cm.isManual,
        daysLeft,
      };

      const existing = map.get(cm.plexId);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(cm.plexId, [entry]);
      }
    });

    return map;
  }
}
