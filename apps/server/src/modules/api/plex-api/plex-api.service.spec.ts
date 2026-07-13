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
})
