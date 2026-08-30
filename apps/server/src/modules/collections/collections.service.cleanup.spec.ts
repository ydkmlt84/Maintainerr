import { ServiceUnavailableException } from '@nestjs/common'
import type { Mocked } from '@suites/doubles.jest'
import { TestBed } from '@suites/unit'
import { Repository } from 'typeorm'
import { MediaServerFactory } from '../api/media-server/media-server.factory'
import { IMediaServerService } from '../api/media-server/media-server.interface'
import { SettingsService } from '../settings/settings.service'
import { CollectionsService } from './collections.service'
import { CollectionMedia } from './entities/collection_media.entities'

describe('CollectionsService stale media cleanup', () => {
  let service: CollectionsService
  let settingsService: Mocked<SettingsService>
  let mediaServerFactory: Mocked<MediaServerFactory>

  beforeEach(async () => {
    const { unit, unitRef } =
      await TestBed.solitary(CollectionsService).compile()

    service = unit
    settingsService = unitRef.get(SettingsService)
    mediaServerFactory = unitRef.get(MediaServerFactory)
  })

  it('refuses manual cleanup when the media server is unreachable', async () => {
    settingsService.testMediaServerConnection.mockResolvedValue(false)
    const removeSpy = jest.spyOn(service, 'removeStaleCollectionMedia')

    await expect(service.cleanupStaleCollectionMedia()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
    expect(removeSpy).not.toHaveBeenCalled()
  })

  it('returns the number removed when manual cleanup is safe to run', async () => {
    settingsService.testMediaServerConnection.mockResolvedValue(true)
    jest.spyOn(service, 'removeStaleCollectionMedia').mockResolvedValue(3)

    await expect(service.cleanupStaleCollectionMedia()).resolves.toBe(3)
  })

  it('deletes and counts media entries missing from the media server', async () => {
    const collectionMediaRepository = (
      service as unknown as {
        CollectionMediaRepo: Mocked<Repository<CollectionMedia>>
      }
    ).CollectionMediaRepo
    const mediaServer = {
      getMetadata: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ id: 'present' }),
    } as unknown as Mocked<IMediaServerService>

    collectionMediaRepository.find.mockResolvedValue([
      { id: 1, mediaServerId: 'missing' },
      { id: 2, mediaServerId: 'present' },
    ] as CollectionMedia[])
    collectionMediaRepository.delete.mockResolvedValue({ raw: [] })
    mediaServerFactory.getService.mockResolvedValue(mediaServer)

    await expect(service.removeStaleCollectionMedia()).resolves.toBe(1)
    expect(collectionMediaRepository.delete).toHaveBeenCalledWith(1)
    expect(collectionMediaRepository.delete).toHaveBeenCalledTimes(1)
  })
})
