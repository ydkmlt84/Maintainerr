import { Injectable } from '@nestjs/common';
import { PlexApiService } from '../api/plex-api/plex-api.service';
import { ServarrService } from '../api/servarr-api/servarr.service';
import { TmdbIdService } from '../api/tmdb-api/tmdb-id.service';
import { Collection } from '../collections/entities/collection.entities';
import { CollectionMedia } from '../collections/entities/collection_media.entities';
import { ServarrAction } from '../collections/interfaces/collection.interface';
import { MaintainerrLogger } from '../logging/logs.service';

@Injectable()
export class RadarrActionHandler {
  constructor(
    private readonly servarrApi: ServarrService,
    private readonly plexApi: PlexApiService,
    private readonly tmdbIdService: TmdbIdService,
    private readonly logger: MaintainerrLogger,
  ) {
    logger.setContext(RadarrActionHandler.name);
  }

  public async handleAction(
    collection: Collection,
    media: CollectionMedia,
  ): Promise<void> {
    const radarrApiClient = await this.servarrApi.getRadarrApiClient(
      collection.radarrSettingsId,
    );

    // find tmdbid
    const tmdbid = media.tmdbId
      ? media.tmdbId
      : (
          await this.tmdbIdService.getTmdbIdFromPlexRatingKey(
            media.plexId.toString(),
          )
        )?.id;

    if (tmdbid) {
      const radarrMedia = await radarrApiClient.getMovieByTmdbId(tmdbid);
      if (radarrMedia?.id) {
        switch (collection.arrAction) {
          case ServarrAction.DELETE:
          case ServarrAction.UNMONITOR_DELETE_EXISTING:
            await radarrApiClient.deleteMovie(
              radarrMedia.id,
              true,
              collection.listExclusions,
            );
            this.logger.log(
              `Removed movie with tmdb id ${tmdbid} from filesystem & Radarr`,
            );
            break;
          case ServarrAction.UNMONITOR:
            await radarrApiClient.updateMovie(radarrMedia.id, {
              monitored: false,
              addImportExclusion: collection.listExclusions,
            });
            this.logger.log(
              `Unmonitored movie with tmdb id ${tmdbid}${collection.listExclusions ? ' & added to import exclusion list' : ''} in Radarr`,
            );
            break;
          case ServarrAction.UNMONITOR_DELETE_ALL:
            await radarrApiClient.updateMovie(radarrMedia.id, {
              monitored: false,
              deleteFiles: true,
              addImportExclusion: collection.listExclusions,
            });
            this.logger.log(
              `Unmonitored movie with tmdb id ${tmdbid}${collection.listExclusions ? ', added to import exclusion list' : ''} & removed files from filesystem in Radarr`,
            );
            break;
          case ServarrAction.CHANGE_QUALITY_PROFILE:
            if (collection.qualityProfileId == null) {
              this.logger.warn(
                `No quality profile selected for movie with tmdb id ${tmdbid}. Skipping quality profile update in Radarr`,
              );
              break;
            }

            await radarrApiClient.updateMovie(radarrMedia.id, {
              qualityProfileId: collection.qualityProfileId,
              deleteFiles:
                collection.replaceExistingFilesAfterQualityProfileChange,
            });
            this.logger.log(
              `Changed quality profile for movie with tmdb id ${tmdbid} to profile id ${collection.qualityProfileId} in Radarr`,
            );

            const shouldSearch =
              collection.searchAfterQualityProfileChange ||
              collection.replaceExistingFilesAfterQualityProfileChange;

            if (shouldSearch) {
              await radarrApiClient.searchMovie(radarrMedia.id);
              this.logger.log(
                `Triggered search for movie with tmdb id ${tmdbid} in Radarr after quality profile change`,
              );
            }
            break;
        }
      } else {
        if (this.shouldDeleteFromPlexWhenMissingInArr(collection.arrAction)) {
          this.logger.log(
            `Couldn't find movie with tmdb id ${tmdbid} in Radarr, so no Radarr action was taken for movie with Plex ID ${media.plexId}. Attempting to remove from the filesystem via Plex.`,
          );
          await this.plexApi.deleteMediaFromDisk(media.plexId.toString());
        } else {
          this.logger.log(
            `Radarr unmonitor action was not possible, couldn't find movie with tmdb id ${tmdbid} in Radarr. No action was taken for movie with Plex ID ${media.plexId}`,
          );
        }
      }
    } else {
      this.logger.log(
        `Couldn't find correct tmdb id. No action taken for movie with Plex ID: ${media.plexId}. Please check this movie manually`,
      );
    }
  }

  private shouldDeleteFromPlexWhenMissingInArr(action: ServarrAction): boolean {
    return [
      ServarrAction.DELETE,
      ServarrAction.UNMONITOR_DELETE_ALL,
      ServarrAction.UNMONITOR_DELETE_EXISTING,
    ].includes(action);
  }
}
