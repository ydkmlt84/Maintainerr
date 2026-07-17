import { Mocked, TestBed } from '@suites/unit'
import { MaintainerrLogger } from '../../logging/logs.service'
import PlexApi from '../lib/plexApi'
import { PlexApiService } from './plex-api.service'

describe('PlexApiService metadata errors', () => {
  let service: PlexApiService
  let logger: Mocked<MaintainerrLogger>

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(PlexApiService).compile()

    service = unit
    logger = unitRef.get(MaintainerrLogger)
  })

  it('treats a missing Plex metadata item as an expected result', async () => {
    const plexClient = {
      query: jest
        .fn()
        .mockRejectedValue(
          new Error(
            'GET /library/metadata/117454 failed with exception: response code: 404',
          ),
        ),
    } as unknown as Mocked<PlexApi>
    ;(
      service as unknown as {
        plexClient: Mocked<PlexApi>
      }
    ).plexClient = plexClient

    await expect(service.getMetadata('117454')).resolves.toBeUndefined()
    expect(logger.error).not.toHaveBeenCalled()
    expect(logger.debug).toHaveBeenCalledWith(
      'Plex metadata item 117454 was not found',
    )
  })

  it('empties trash for every movie and show library', async () => {
    const plexClient = {
      queryAll: jest.fn().mockResolvedValue({
        MediaContainer: {
          Directory: [
            { key: '1', title: 'Movies', type: 'movie' },
            { key: '2', title: 'TV Shows', type: 'show' },
            { key: '3', title: 'Music', type: 'artist' },
          ],
        },
      }),
      putQuery: jest.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<PlexApi>
    ;(
      service as unknown as {
        plexClient: Mocked<PlexApi>
      }
    ).plexClient = plexClient

    await expect(service.emptyTrash()).resolves.toEqual({
      libraryCount: 2,
      libraries: ['Movies', 'TV Shows'],
    })
    expect(plexClient.putQuery).toHaveBeenNthCalledWith(1, {
      uri: '/library/sections/1/emptyTrash',
    })
    expect(plexClient.putQuery).toHaveBeenNthCalledWith(2, {
      uri: '/library/sections/2/emptyTrash',
    })
  })
})
