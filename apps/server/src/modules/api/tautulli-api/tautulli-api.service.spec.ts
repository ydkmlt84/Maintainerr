import { TautulliApiService } from './tautulli-api.service'

describe('TautulliApiService.getRecentlyAdded', () => {
  it('returns recently added media from Tautulli', async () => {
    const getWithoutCache = jest.fn().mockResolvedValue({
      response: {
        result: 'success',
        message: null,
        data: {
          recently_added: [{ rating_key: '123', media_type: 'movie' }],
        },
      },
    })
    const service = Object.create(
      TautulliApiService.prototype,
    ) as TautulliApiService
    service.api = { getWithoutCache } as never

    await expect(service.getRecentlyAdded(12)).resolves.toEqual([
      { rating_key: '123', media_type: 'movie' },
    ])
    expect(getWithoutCache).toHaveBeenCalledWith('', {
      params: { cmd: 'get_recently_added', count: 12 },
    })
  })
})

describe('TautulliApiService.getHomeStats', () => {
  it('returns cached Tautulli home stats', async () => {
    const get = jest.fn().mockResolvedValue({
      response: {
        result: 'success',
        message: null,
        data: [{ stat_id: 'popular_movies', rows: [] }],
      },
    })
    const service = Object.create(
      TautulliApiService.prototype,
    ) as TautulliApiService
    service.api = { get } as never

    await expect(service.getHomeStats(30, 5)).resolves.toEqual([
      { stat_id: 'popular_movies', rows: [] },
    ])
    expect(get).toHaveBeenCalledWith(
      '',
      {
        params: {
          cmd: 'get_home_stats',
          time_range: 30,
          stats_count: 5,
        },
      },
      300,
    )
  })
})

describe('TautulliApiService.getImage', () => {
  it('proxies a Tautulli library image', async () => {
    const getRawWithoutCache = jest.fn().mockResolvedValue({
      data: Buffer.from('image'),
      headers: { 'content-type': 'image/png' },
    })
    const service = Object.create(
      TautulliApiService.prototype,
    ) as TautulliApiService
    service.api = { getRawWithoutCache } as never

    const image = await service.getImage(
      '/library/metadata/121621/thumb/1783930713',
    )

    expect(image).toEqual({
      data: Buffer.from('image'),
      contentType: 'image/png',
    })
    expect(getRawWithoutCache).toHaveBeenCalledWith('', {
      responseType: 'arraybuffer',
      params: {
        cmd: 'pms_image_proxy',
        img: '/library/metadata/121621/thumb/1783930713',
        rating_key: '121621',
        width: 300,
        height: 450,
      },
    })
  })

  it('rejects paths outside the Plex metadata image namespace', async () => {
    const service = Object.create(
      TautulliApiService.prototype,
    ) as TautulliApiService

    await expect(
      service.getImage('https://example.com/image.jpg'),
    ).resolves.toBeNull()
  })
})
