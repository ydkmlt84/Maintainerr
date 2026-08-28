import {
  MediaServerType,
  SeerrSetting,
  TautulliSetting,
  TraktStatus,
} from '@maintainerr/contracts'
import {
  CheckCircleIcon,
  ExternalLinkIcon,
  PencilIcon,
  PlusIcon,
  ServerIcon,
  TrashIcon,
} from '@heroicons/react/solid'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import GetApiHandler, { DeleteApiHandler } from '../../../utils/ApiHandler'
import { logClientError } from '../../../utils/ClientLogger'
import Button from '../../Common/Button'
import LoadingSpinner from '../../Common/LoadingSpinner'
import Modal from '../../Common/Modal'
import { ICollection } from '../../Collection'
import { useSettingsOutletContext } from '..'
import { IRadarrSetting } from '../Radarr'
import RadarrSettingsModal from '../Radarr/SettingsModal'
import { ISonarrSetting } from '../Sonarr'
import SonarrSettingsModal from '../Sonarr/SettingsModal'
import SingletonSettingsModal, {
  SingletonServiceType,
} from './SingletonSettingsModal'
import TraktSettingsModal from './TraktSettingsModal'

type ServiceType = 'radarr' | 'sonarr' | SingletonServiceType | 'trakt'
type ArrSetting = IRadarrSetting | ISonarrSetting

type DeleteArrResponse =
  | { status: 'OK'; code: 1; message: string; data?: never }
  | {
      status: 'NOK'
      code: 0
      message: string
      data: { collectionsInUse: ICollection[] } | null
    }

interface ServiceCardProps {
  type: ServiceType
  name: string
  url: string
  connected?: boolean
  onEdit: () => void
  onDelete: () => void
}

const serviceDetails: Record<
  ServiceType,
  { name: string; description: string; icon: string }
> = {
  radarr: {
    name: 'Radarr',
    description: 'Movie management',
    icon: 'radarr.svg',
  },
  sonarr: {
    name: 'Sonarr',
    description: 'TV management',
    icon: 'sonarr.svg',
  },
  seerr: {
    name: 'Seerr',
    description: 'Media requests',
    icon: 'seerr.svg',
  },
  tautulli: {
    name: 'Tautulli',
    description: 'Plex analytics',
    icon: 'tautulli.svg',
  },
  trakt: {
    name: 'Trakt',
    description: 'Discovery and watchlist',
    icon: 'trakt.svg',
  },
}

const basePath = import.meta.env.VITE_BASE_PATH || ''

const isConfigured = (settings?: SeerrSetting | TautulliSetting) =>
  Boolean(settings?.url && settings.api_key)

const ServiceCard = ({
  type,
  name,
  url,
  connected = true,
  onEdit,
  onDelete,
}: ServiceCardProps) => {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const details = serviceDetails[type]

  return (
    <li className="flex min-h-[11rem] flex-col rounded-lg bg-zinc-800 p-4 shadow ring-1 ring-zinc-700">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-200">
          <img
            src={`${basePath}/icons_logos/${details.icon}`}
            alt=""
            className="h-9 w-9 object-contain"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-base font-semibold text-white">
              {name}
            </h4>
            <CheckCircleIcon
              className={`h-4 w-4 shrink-0 ${
                connected ? 'text-green-400' : 'text-amber-400'
              }`}
            />
          </div>
          <p className="text-sm text-zinc-400">
            {connected ? details.name : 'Account not connected'}
          </p>
        </div>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex min-w-0 items-center gap-1.5 text-sm text-zinc-300 hover:text-white"
      >
        <span className="truncate">{url}</span>
        <ExternalLinkIcon className="h-4 w-4 shrink-0" />
      </a>

      <div className="mt-auto flex gap-2 pt-4">
        <Button buttonType="primary" buttonSize="sm" onClick={onEdit}>
          <PencilIcon />
          <span>Edit</span>
        </Button>
        <Button
          buttonType={confirmDelete ? 'danger' : 'default'}
          buttonSize="sm"
          onClick={() => {
            if (confirmDelete) {
              onDelete()
              setConfirmDelete(false)
            } else {
              setConfirmDelete(true)
            }
          }}
        >
          <TrashIcon />
          <span>{confirmDelete ? 'Confirm' : 'Delete'}</span>
        </Button>
      </div>
    </li>
  )
}

const ServicesSettings = () => {
  const { settings: globalSettings } = useSettingsOutletContext()
  const supportsTautulli =
    globalSettings.media_server_type === MediaServerType.PLEX
  const [radarr, setRadarr] = useState<IRadarrSetting[]>([])
  const [sonarr, setSonarr] = useState<ISonarrSetting[]>([])
  const [seerr, setSeerr] = useState<SeerrSetting>()
  const [tautulli, setTautulli] = useState<TautulliSetting>()
  const [trakt, setTrakt] = useState<TraktStatus>()
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [editingType, setEditingType] = useState<ServiceType>()
  const [editingArr, setEditingArr] = useState<ArrSetting>()
  const [collectionsInUse, setCollectionsInUse] = useState<ICollection[]>()

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const requests: [
        Promise<IRadarrSetting[]>,
        Promise<ISonarrSetting[]>,
        Promise<SeerrSetting>,
        Promise<TautulliSetting> | Promise<undefined>,
        Promise<TraktStatus>,
      ] = [
        GetApiHandler<IRadarrSetting[]>('/settings/radarr'),
        GetApiHandler<ISonarrSetting[]>('/settings/sonarr'),
        GetApiHandler<SeerrSetting>('/settings/seerr'),
        supportsTautulli
          ? GetApiHandler<TautulliSetting>('/settings/tautulli')
          : Promise.resolve(undefined),
        GetApiHandler<TraktStatus>('/trakt/status'),
      ]
      const [
        radarrSettings,
        sonarrSettings,
        seerrSettings,
        tautulliSettings,
        traktSettings,
      ] = await Promise.all(requests)
      setRadarr(radarrSettings)
      setSonarr(sonarrSettings)
      setSeerr(seerrSettings)
      setTautulli(tautulliSettings)
      setTrakt(traktSettings)
    } catch (error) {
      setLoadFailed(true)
      void logClientError(
        'Failed to load service settings',
        error,
        'Settings.Services.loadSettings',
      )
    } finally {
      setLoading(false)
    }
  }, [supportsTautulli])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const closeEditor = () => {
    setEditingType(undefined)
    setEditingArr(undefined)
  }

  const chooseService = (type: ServiceType) => {
    setChooserOpen(false)
    setEditingType(type)
    setEditingArr(undefined)
  }

  const editArr = (type: 'radarr' | 'sonarr', setting: ArrSetting) => {
    setEditingType(type)
    setEditingArr(setting)
  }

  const deleteArr = async (type: 'radarr' | 'sonarr', id: number) => {
    try {
      const response = await DeleteApiHandler<DeleteArrResponse>(
        `/settings/${type}/${id}`,
      )
      if (response.code === 1) {
        if (type === 'radarr') {
          setRadarr((current) => current.filter((item) => item.id !== id))
        } else {
          setSonarr((current) => current.filter((item) => item.id !== id))
        }
      } else if (response.data?.collectionsInUse) {
        setCollectionsInUse(response.data.collectionsInUse)
      }
    } catch (error) {
      void logClientError(
        `Failed to delete ${type} setting`,
        error,
        'Settings.Services.deleteArr',
      )
      toast.error(`Failed to delete ${serviceDetails[type].name} setting.`)
    }
  }

  const deleteSingleton = async (type: SingletonServiceType) => {
    try {
      const response = await DeleteApiHandler<{ code: 0 | 1; message: string }>(
        `/settings/${type}`,
      )
      if (response.code === 1) {
        if (type === 'seerr') setSeerr(undefined)
        else setTautulli(undefined)
      } else {
        toast.error(response.message || `Failed to delete ${type} setting.`)
      }
    } catch (error) {
      void logClientError(
        `Failed to delete ${type} setting`,
        error,
        'Settings.Services.deleteSingleton',
      )
      toast.error(`Failed to delete ${serviceDetails[type].name} setting.`)
    }
  }

  const deleteTrakt = async () => {
    try {
      await DeleteApiHandler('/trakt/configuration')
      setTrakt({
        configured: false,
        connected: false,
        clientSecretConfigured: false,
      })
    } catch (error) {
      void logClientError(
        'Failed to delete Trakt setting',
        error,
        'Settings.Services.deleteTrakt',
      )
      toast.error('Failed to delete Trakt setting.')
    }
  }

  if (loading) {
    return (
      <div className="mt-6">
        <title>Services - Maintainerr</title>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <>
      <title>Services - Maintainerr</title>
      <div className="h-full w-full">
        <div className="section flex items-center justify-between gap-4">
          <div>
            <h3 className="heading">Services</h3>
            <p className="description">Third-party service connections</p>
          </div>
          <Button buttonType="primary" onClick={() => setChooserOpen(true)}>
            <PlusIcon />
            <span>Add Service</span>
          </Button>
        </div>

        {loadFailed ? (
          <div className="section rounded-lg bg-zinc-800 p-5 ring-1 ring-zinc-700">
            <p className="text-zinc-300">
              Service settings could not be loaded.
            </p>
            <Button className="mt-4" onClick={() => void loadSettings()}>
              Retry
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {radarr.map((setting) => (
              <ServiceCard
                key={`radarr-${setting.id}`}
                type="radarr"
                name={setting.serverName}
                url={setting.externalUrl || setting.url}
                onEdit={() => editArr('radarr', setting)}
                onDelete={() => void deleteArr('radarr', setting.id)}
              />
            ))}
            {sonarr.map((setting) => (
              <ServiceCard
                key={`sonarr-${setting.id}`}
                type="sonarr"
                name={setting.serverName}
                url={setting.externalUrl || setting.url}
                onEdit={() => editArr('sonarr', setting)}
                onDelete={() => void deleteArr('sonarr', setting.id)}
              />
            ))}
            {isConfigured(seerr) && seerr && (
              <ServiceCard
                type="seerr"
                name="Seerr"
                url={seerr.url}
                onEdit={() => setEditingType('seerr')}
                onDelete={() => void deleteSingleton('seerr')}
              />
            )}
            {supportsTautulli && isConfigured(tautulli) && tautulli && (
              <ServiceCard
                type="tautulli"
                name="Tautulli"
                url={tautulli.url}
                onEdit={() => setEditingType('tautulli')}
                onDelete={() => void deleteSingleton('tautulli')}
              />
            )}
            {trakt?.configured && (
              <ServiceCard
                type="trakt"
                name={trakt.username ? `Trakt - ${trakt.username}` : 'Trakt'}
                url={
                  trakt.username
                    ? `https://trakt.tv/users/${trakt.username}`
                    : 'https://trakt.tv'
                }
                connected={trakt.connected}
                onEdit={() => setEditingType('trakt')}
                onDelete={() => void deleteTrakt()}
              />
            )}

            {radarr.length === 0 &&
              sonarr.length === 0 &&
              !isConfigured(seerr) &&
              !isConfigured(tautulli) &&
              !trakt?.configured && (
                <li className="col-span-full flex min-h-[12rem] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-600 bg-zinc-800/50 p-6 text-center">
                  <ServerIcon className="h-8 w-8 text-zinc-500" />
                  <p className="mt-3 font-medium text-white">
                    No services configured
                  </p>
                  <Button
                    buttonType="primary"
                    className="mt-4"
                    onClick={() => setChooserOpen(true)}
                  >
                    <PlusIcon />
                    <span>Add Service</span>
                  </Button>
                </li>
              )}
          </ul>
        )}
      </div>

      {chooserOpen && (
        <Modal
          title="Add Service"
          size="lg"
          onCancel={() => setChooserOpen(false)}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(Object.keys(serviceDetails) as ServiceType[]).map((type) => {
              const details = serviceDetails[type]
              const unavailable =
                (type === 'seerr' && isConfigured(seerr)) ||
                (type === 'tautulli' &&
                  (!supportsTautulli || isConfigured(tautulli))) ||
                (type === 'trakt' && trakt?.configured)
              return (
                <button
                  key={type}
                  type="button"
                  disabled={unavailable}
                  onClick={() => chooseService(type)}
                  className="flex items-center gap-3 rounded-lg bg-zinc-800 p-4 text-left ring-1 ring-zinc-600 transition hover:bg-zinc-700 hover:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-200">
                    <img
                      src={`${basePath}/icons_logos/${details.icon}`}
                      alt=""
                      className="h-9 w-9 object-contain"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-white">
                      {details.name}
                    </span>
                    <span className="block text-sm text-zinc-400">
                      {type === 'tautulli' && !supportsTautulli
                        ? 'Requires Plex'
                        : unavailable
                          ? 'Already configured'
                          : details.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </Modal>
      )}

      {editingType === 'radarr' && (
        <RadarrSettingsModal
          settings={editingArr as IRadarrSetting | undefined}
          onCancel={closeEditor}
          onUpdate={(setting) => {
            setRadarr((current) => {
              const index = current.findIndex((item) => item.id === setting.id)
              return index === -1
                ? [...current, setting]
                : current.map((item) =>
                    item.id === setting.id ? setting : item,
                  )
            })
            closeEditor()
          }}
        />
      )}
      {editingType === 'sonarr' && (
        <SonarrSettingsModal
          settings={editingArr as ISonarrSetting | undefined}
          onCancel={closeEditor}
          onUpdate={(setting) => {
            setSonarr((current) => {
              const index = current.findIndex((item) => item.id === setting.id)
              return index === -1
                ? [...current, setting]
                : current.map((item) =>
                    item.id === setting.id ? setting : item,
                  )
            })
            closeEditor()
          }}
        />
      )}
      {(editingType === 'seerr' || editingType === 'tautulli') && (
        <SingletonSettingsModal
          service={editingType}
          settings={editingType === 'seerr' ? seerr : tautulli}
          onCancel={closeEditor}
          onUpdate={(setting) => {
            if (editingType === 'seerr') setSeerr(setting)
            else setTautulli(setting)
            closeEditor()
          }}
        />
      )}
      {editingType === 'trakt' && trakt && (
        <TraktSettingsModal
          settings={trakt}
          onCancel={closeEditor}
          onUpdate={setTrakt}
        />
      )}

      {collectionsInUse && (
        <Modal
          title="Server in use"
          size="sm"
          onOk={() => setCollectionsInUse(undefined)}
        >
          <p>This server is used by the following collections:</p>
          <ul className="mt-3 list-inside list-disc">
            {collectionsInUse.map((collection) => (
              <li key={collection.id}>{collection.title}</li>
            ))}
          </ul>
          <p className="mt-3">
            Reassign them to another server before deleting this connection.
          </p>
        </Modal>
      )}
    </>
  )
}

export default ServicesSettings
