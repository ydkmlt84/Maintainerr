import { Mocked, TestBed } from '@suites/unit'
import { Repository } from 'typeorm'
import { CollectionsService } from './collections.service'
import { CollectionLog } from './entities/collection_log.entities'
import { CollectionMedia } from './entities/collection_media.entities'
import { Exclusion } from '../rules/entities/exclusion.entities'

const queryBuilder = (rows: unknown[]) => ({
  innerJoin: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue(rows),
})

describe('CollectionsService media context', () => {
  let service: CollectionsService
  let collectionMediaRepo: Mocked<Repository<CollectionMedia>>
  let exclusionRepo: Mocked<Repository<Exclusion>>
  let collectionLogRepo: Mocked<Repository<CollectionLog>>

  beforeEach(async () => {
    const { unit, unitRef } =
      await TestBed.solitary(CollectionsService).compile()

    service = unit
    collectionMediaRepo = unitRef.get('CollectionMediaRepository')
    exclusionRepo = unitRef.get('ExclusionRepository')
    collectionLogRepo = unitRef.get('CollectionLogRepository')
  })

  it('combines memberships, exclusions, and recent activity from local data', async () => {
    collectionMediaRepo.createQueryBuilder.mockReturnValue(
      queryBuilder([
        {
          collectionId: 12,
          collectionTitle: 'Leaving Soon',
          collectionActive: 1,
          addedAt: '2026-07-01T00:00:00.000Z',
          isManual: 0,
          deleteAfterDays: 14,
          ruleGroupName: 'Unwatched movies',
        },
      ]) as never,
    )
    exclusionRepo.createQueryBuilder.mockReturnValue(
      queryBuilder([
        {
          id: 5,
          ruleGroupId: null,
          collectionId: null,
          collectionTitle: null,
          ruleGroupName: null,
        },
      ]) as never,
    )
    collectionLogRepo.createQueryBuilder.mockReturnValue(
      queryBuilder([
        {
          id: 9,
          timestamp: '2026-07-01T00:00:00.000Z',
          message: 'Added "Example"',
          collectionId: 12,
          collectionTitle: 'Leaving Soon',
        },
      ]) as never,
    )

    const result = await service.getMediaMaintainerrContext('117454')

    expect(result.memberships[0]).toMatchObject({
      collectionId: 12,
      collectionTitle: 'Leaving Soon',
      collectionActive: true,
      isManual: false,
      deleteAfterDays: 14,
      ruleGroupName: 'Unwatched movies',
    })
    expect(result.memberships[0].scheduledFor).toEqual(
      new Date('2026-07-15T00:00:00.000Z'),
    )
    expect(result.exclusions[0]).toMatchObject({
      id: 5,
      scope: 'global',
    })
    expect(result.recentActivity[0]).toMatchObject({
      id: 9,
      collectionTitle: 'Leaving Soon',
    })
  })
})
