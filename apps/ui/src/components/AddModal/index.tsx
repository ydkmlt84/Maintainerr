import { MediaItemType } from '@maintainerr/contracts'
import { useEffect, useMemo, useState } from 'react'
import GetApiHandler, { PostApiHandler } from '../../utils/ApiHandler'
import Alert from '../Common/Alert'
import FormItem from '../Common/FormItem'
import Modal from '../Common/Modal'
import { IAddModal, IAlterableMediaDto, ICollectionMedia } from './interfaces'

const getCollectionLabel = (collection: ICollectionMedia): string =>
  `${collection.title}${collection.isActive === false ? ' (Inactive)' : ''}`

const AddModal = (props: IAddModal) => {
  const selectClassName =
    'mt-1 block w-full rounded-md border-zinc-600 bg-zinc-900 text-sm text-zinc-100 shadow-sm focus:border-maintainerr-500 focus:ring-maintainerr-500'
  const [selectedCollection, setSelectedCollection] = useState<
    number | string
  >()
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState(false)
  const [forceRemovalcheck, setForceRemovalCheck] = useState(false)
  const [selectedAction, setSelectedAction] = useState<number>(0)
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>()
  // For show only
  const [selectedSeasons, setSelectedSeasons] = useState<number | string>(-1)
  const [selectedEpisodes, setSelectedEpisodes] = useState<number | string>(-1)

  const [collectionOptions, setCollectionOptions] = useState<
    ICollectionMedia[]
  >([])
  const [seasonOptions, setSeasonOptions] = useState<ICollectionMedia[]>([
    {
      id: -1,
      title: 'All seasons',
    },
  ])
  const [episodeOptions, setEpisodeOptions] = useState<ICollectionMedia[]>([
    {
      id: -1,
      title: 'All episodes',
    },
  ])

  const origCollectionOptions = useMemo(
    () =>
      props.modalType === 'exclude'
        ? [
            {
              id: -1,
              title: 'All collections',
            },
          ]
        : [],
    [props.modalType],
  )

  const selectedMediaId = useMemo(() => {
    if (props.type === 'season' || props.type === 'episode') {
      return props.mediaServerId
    }
    return props.type === 'movie'
      ? -1
      : selectedEpisodes !== -1
        ? selectedEpisodes
        : selectedSeasons
  }, [props.mediaServerId, props.type, selectedSeasons, selectedEpisodes])

  const selectedContext = useMemo((): MediaItemType => {
    if (props.type === 'season' || props.type === 'episode') {
      return props.type
    }
    return props.type === 'show'
      ? selectedEpisodes !== -1
        ? 'episode'
        : selectedSeasons !== -1
          ? 'season'
          : 'show'
      : 'movie'
  }, [selectedSeasons, selectedEpisodes, props.type])

  const handleCancel = () => {
    props.onCancel()
  }

  const handleOk = async () => {
    if (selectedCollection !== undefined) {
      const mediaDto: IAlterableMediaDto = {
        id: selectedMediaId,
        type: selectedContext,
      }

      try {
        if (props.modalType === 'add') {
          await PostApiHandler(`/collections/media/add`, {
            mediaId: props.mediaServerId,
            context: mediaDto,
            collectionId: selectedCollection,
            action: selectedAction,
          })
        } else {
          await PostApiHandler('/rules/exclusion', {
            mediaId: props.mediaServerId,
            context: mediaDto,
            collectionId:
              selectedCollection !== -1 ? selectedCollection : undefined,
            action: selectedAction,
            ...(selectedAction === 0 && expiresInDays ? { expiresInDays } : {}),
          })
        }

        props.onSubmit({
          action: selectedAction === 0 ? 'add' : 'remove',
          collectionTitle: collectionOptions.find(
            (collection) => collection.id === selectedCollection,
          )?.title,
          modalType: props.modalType,
        })
      } catch (error) {
        if (props.onError) {
          props.onError()
          return
        }
        throw error
      }
    } else {
      setAlert(true)
    }
  }

  const handleForceRemoval = async () => {
    setForceRemovalCheck(false)
    try {
      if (props.modalType === 'add') {
        await PostApiHandler(`/collections/media/add`, {
          mediaId: props.mediaServerId,
          context: { id: -1, type: props.type },
          collectionId: undefined,
          action: 1,
        })
      }
      props.onSubmit({
        action: 'remove',
        collectionTitle: 'all collections',
        modalType: props.modalType,
      })
    } catch (error) {
      if (props.onError) {
        props.onError()
        return
      }
      throw error
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedSeasons(-1)
      setSelectedEpisodes(-1)
    })

    if (props.type && props.type === 'show') {
      // get seasons
      GetApiHandler(`/media-server/meta/${props.mediaServerId}/children`).then(
        (resp: { id: string; title: string }[]) => {
          setSeasonOptions([
            {
              id: -1,
              title: 'All seasons',
            },
            ...resp.map((el) => {
              return {
                id: el.id,
                title: el.title,
              } as ICollectionMedia
            }),
          ])
          setLoading(false)
        },
      )
    }
  }, [props.mediaServerId, props.type])

  useEffect(() => {
    queueMicrotask(() => setSelectedCollection(collectionOptions[0]?.id))
  }, [collectionOptions])

  useEffect(() => {
    if (selectedSeasons !== -1) {
      queueMicrotask(() => setLoading(true))

      // get episodes
      GetApiHandler(`/media-server/meta/${selectedSeasons}/children`).then(
        (resp: { id: string; index: number }[]) => {
          setEpisodeOptions([
            {
              id: -1,
              title: 'All episodes',
            },
            ...resp.map((el) => {
              return {
                id: el.id,
                title: `Episode ${el.index}`,
              } as ICollectionMedia
            }),
          ])
          setLoading(false)
        },
      )
    } else {
      queueMicrotask(() => setSelectedEpisodes(-1))
    }
  }, [selectedSeasons])

  // fetch correct collections based on selected type
  useEffect(() => {
    queueMicrotask(() => setLoading(true))
    let active = true
    const collectionTypes: MediaItemType[] =
      props.type === 'show'
        ? selectedEpisodes !== -1
          ? ['episode']
          : selectedSeasons !== -1
            ? ['season', 'episode']
            : ['show', 'season', 'episode']
        : props.type === 'season'
          ? ['season', 'episode']
          : props.type === 'episode'
            ? ['episode']
            : ['movie']

    Promise.all(
      collectionTypes.map((type) =>
        GetApiHandler<ICollectionMedia[]>(`/collections?typeId=${type}`),
      ),
    )
      .then((responses) => {
        if (!active) return
        setCollectionOptions([...origCollectionOptions, ...responses.flat()])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [origCollectionOptions, selectedSeasons, selectedEpisodes, props.type])

  return (
    <>
      <Modal
        loading={loading}
        backgroundClickable={false}
        onCancel={handleCancel}
        onOk={handleOk}
        okDisabled={selectedCollection === undefined}
        title={
          props.modalType === 'add' && props.addOnly
            ? 'Add Media to Collection'
            : props.modalType === 'add'
              ? 'Add / Remove Media'
              : 'Exclude Media'
        }
        okText={props.addOnly ? 'Add to Collection' : 'Submit'}
        okButtonType={'primary'}
        onSecondary={() => {}}
        specialButtonType="warning"
        specialDisabled={props.modalType !== 'add' || props.addOnly}
        specialText={'Remove from all collections'}
        onSpecial={
          props.modalType === 'add' && !props.addOnly
            ? () => {
                setForceRemovalCheck(true)
              }
            : undefined
        }
        iconSvg={''}
        size="2xl"
      >
        {forceRemovalcheck ? (
          <Modal
            loading={loading}
            backgroundClickable={false}
            onCancel={() => setForceRemovalCheck(false)}
            onOk={handleForceRemoval}
            okDisabled={false}
            title={'Confirmation Required'}
            okText={'Submit'}
          >
            Are you certain you want to proceed? This action will remove the{' '}
            {props.modalType === 'add' ? 'media ' : 'exclusion '}
            from all collections. For shows, this entails removing all
            associated {props.modalType === 'add' ? '' : 'exclusions for '}
            seasons and episodes as well.
          </Modal>
        ) : undefined}

        {alert ? (
          <Alert title="Please select a collection" type="warning" />
        ) : undefined}

        <div className="space-y-4 rounded-lg border border-zinc-600 bg-zinc-800 p-4">
          {!props.addOnly ? (
            <FormItem label="Action">
              <select
                className={selectClassName}
                name={`Action-field`}
                id={`Action-field`}
                value={selectedAction}
                onChange={(e: { target: { value: string } }) => {
                  setSelectedAction(+e.target.value)
                }}
              >
                <option value={0}>Add</option>
                <option value={1}>Remove</option>
              </select>
            </FormItem>
          ) : null}

          {props.modalType === 'exclude' && selectedAction === 0 ? (
            <FormItem label="Duration">
              <select
                className={selectClassName}
                name="Exclusion-duration-field"
                id="Exclusion-duration-field"
                value={expiresInDays ?? 0}
                onChange={(e: { target: { value: string } }) =>
                  setExpiresInDays(
                    e.target.value === '0' ? undefined : +e.target.value,
                  )
                }
              >
                <option value={0}>Permanent</option>
                <option value={7}>7 days</option>
              </select>
            </FormItem>
          ) : null}

          {/* For shows */}
          {props.type === 'show' ? (
            <FormItem label="Seasons">
              <select
                className={selectClassName}
                name={`Seasons-field`}
                id={`Seasons-field`}
                value={selectedSeasons}
                onChange={(e: { target: { value: string } }) => {
                  const value = e.target.value
                  setSelectedSeasons(value === '-1' ? -1 : value)
                }}
              >
                {seasonOptions.map((e: ICollectionMedia) => {
                  return (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  )
                })}
              </select>
            </FormItem>
          ) : undefined}
          {/* For shows and specific seasons */}
          {props.type === 'show' && selectedSeasons !== -1 ? (
            <FormItem label="Episodes">
              <select
                className={selectClassName}
                name={`Episodes-field`}
                id={`Episodes-field`}
                value={selectedEpisodes}
                onChange={(e: { target: { value: string } }) => {
                  const value = e.target.value
                  setSelectedEpisodes(value === '-1' ? -1 : value)
                }}
              >
                {episodeOptions.map((e: ICollectionMedia) => {
                  return (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  )
                })}
              </select>
            </FormItem>
          ) : undefined}

          <FormItem label="Collection">
            <select
              className={selectClassName}
              name={`Collection-field`}
              id={`Collection-field`}
              value={selectedCollection}
              onChange={(e: { target: { value: string } }) => {
                setSelectedCollection(+e.target.value)
              }}
            >
              {collectionOptions?.map((e: ICollectionMedia) => {
                return (
                  <option key={e?.id} value={e?.id}>
                    {getCollectionLabel(e)}
                  </option>
                )
              })}
            </select>
          </FormItem>
          {collectionOptions.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No compatible collections are available for this media type.
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  )
}
export default AddModal
