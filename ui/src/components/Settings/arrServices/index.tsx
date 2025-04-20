import {
  DocumentAddIcon,
  PlusCircleIcon,
  TrashIcon,
} from '@heroicons/react/solid'
import { useEffect, useState } from 'react'
import GetApiHandler, { DeleteApiHandler } from '../../../utils/ApiHandler'
import { ICollection } from '../../Collection'
import Button from '../../Common/Button'
import LoadingSpinner from '../../Common/LoadingSpinner'
import Modal from '../../Common/Modal'
import RadarrSettingsModal from './Radarr/SettingsModal'
import SonarrSettingsModal from './Sonarr/SettingsModal'

// Type declarations
export interface IRadarrSetting {
  id: number
  serverName: string
  url: string
  apiKey: string
}
export interface ISonarrSetting {
  id: number
  serverName: string
  url: string
  apiKey: string
}

// Shared delete modal type
type DeleteSettingResponseDto =
  | { status: 'OK'; code: 1; message: string }
  | {
      status: 'NOK'
      code: 0
      message: string
      data: { collectionsInUse: ICollection[] } | null
    }

const ArrServices = () => {
  // Radarr
  const [radarrLoaded, setRadarrLoaded] = useState(false)
  const [radarrSettings, setRadarrSettings] = useState<IRadarrSetting[]>([])
  const [radarrModalActive, setRadarrModalActive] = useState<
    IRadarrSetting | boolean
  >()
  const [radarrCollectionsInUse, setRadarrCollectionsInUse] = useState<
    ICollection[] | undefined
  >()

  // Sonarr
  const [sonarrLoaded, setSonarrLoaded] = useState(false)
  const [sonarrSettings, setSonarrSettings] = useState<ISonarrSetting[]>([])
  const [sonarrModalActive, setSonarrModalActive] = useState<
    ISonarrSetting | boolean
  >()
  const [sonarrCollectionsInUse, setSonarrCollectionsInUse] = useState<
    ICollection[] | undefined
  >()

  // Load both on mount
  useEffect(() => {
    GetApiHandler<IRadarrSetting[]>('/settings/radarr').then((resp) => {
      setRadarrSettings(resp)
      setRadarrLoaded(true)
    })

    GetApiHandler<ISonarrSetting[]>('/settings/sonarr').then((resp) => {
      setSonarrSettings(resp)
      setSonarrLoaded(true)
    })

    document.title = 'Maintainerr - Settings - arrServices'
  }, [])

  const handleRadarrSaved = (setting: IRadarrSetting) => {
    const updated = [...radarrSettings]
    const index = updated.findIndex((s) => s.id === setting.id)
    if (index !== -1) updated[index] = setting
    else updated.push(setting)
    setRadarrSettings(updated)
    setRadarrModalActive(undefined)
  }

  const handleSonarrSaved = (setting: ISonarrSetting) => {
    const updated = [...sonarrSettings]
    const index = updated.findIndex((s) => s.id === setting.id)
    if (index !== -1) updated[index] = setting
    else updated.push(setting)
    setSonarrSettings(updated)
    setSonarrModalActive(undefined)
  }

  const deleteRadarr = (id: number) => {
    DeleteApiHandler<DeleteSettingResponseDto>(`/settings/radarr/${id}`).then(
      (resp) => {
        if (resp.code === 1) {
          setRadarrSettings(radarrSettings.filter((s) => s.id !== id))
        } else if (resp.data?.collectionsInUse) {
          setRadarrCollectionsInUse(resp.data.collectionsInUse)
        }
      },
    )
  }

  const deleteSonarr = (id: number) => {
    DeleteApiHandler<DeleteSettingResponseDto>(`/settings/sonarr/${id}`).then(
      (resp) => {
        if (resp.code === 1) {
          setSonarrSettings(sonarrSettings.filter((s) => s.id !== id))
        } else if (resp.data?.collectionsInUse) {
          setSonarrCollectionsInUse(resp.data.collectionsInUse)
        }
      },
    )
  }

  if (!radarrLoaded || !sonarrLoaded) {
    return (
      <div className="mt-6">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <>
      {/* RADARR SETTINGS */}
      <div className="section">
        <h3 className="heading mb-4">Radarr Settings</h3>
        <SettingsList
          settings={radarrSettings}
          onEdit={setRadarrModalActive}
          onDelete={deleteRadarr}
          onAdd={() => setRadarrModalActive(true)}
        />
      </div>

      {/* SONARR SETTINGS */}
      <div className="section mt-8">
        <h3 className="heading mb-4">Sonarr Settings</h3>
        <SettingsList
          settings={sonarrSettings}
          onEdit={setSonarrModalActive}
          onDelete={deleteSonarr}
          onAdd={() => setSonarrModalActive(true)}
        />
      </div>

      {/* Modals */}
      {radarrModalActive && (
        <RadarrSettingsModal
          settings={
            typeof radarrModalActive === 'boolean'
              ? undefined
              : radarrModalActive
          }
          onUpdate={handleRadarrSaved}
          onCancel={() => setRadarrModalActive(undefined)}
        />
      )}
      {sonarrModalActive && (
        <SonarrSettingsModal
          settings={
            typeof sonarrModalActive === 'boolean'
              ? undefined
              : sonarrModalActive
          }
          onUpdate={handleSonarrSaved}
          onCancel={() => setSonarrModalActive(undefined)}
        />
      )}

      {/* Warnings */}
      {radarrCollectionsInUse && (
        <InUseWarning
          collections={radarrCollectionsInUse}
          onClose={() => setRadarrCollectionsInUse(undefined)}
        />
      )}
      {sonarrCollectionsInUse && (
        <InUseWarning
          collections={sonarrCollectionsInUse}
          onClose={() => setSonarrCollectionsInUse(undefined)}
        />
      )}
    </>
  )
}

// Reusable components
const SettingsList = ({
  settings,
  onEdit,
  onDelete,
  onAdd,
}: {
  settings: { id: number; serverName: string; url: string }[]
  onEdit: (s: any) => void
  onDelete: (id: number) => void
  onAdd: () => void
}) => (
  <ul className="grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
    {settings.map((setting) => (
      <li
        key={setting.id}
        className="h-full rounded-xl bg-zinc-800 p-4 text-zinc-400 shadow ring-1 ring-zinc-700"
      >
        <div className="mb-2 flex items-center gap-x-3 text-base font-medium text-white sm:text-lg">
          {setting.serverName}
        </div>
        <p className="mb-4 space-x-2 truncate text-gray-300">
          <span className="font-semibold">Address</span>
          <a href={setting.url} className="hover:underline">
            {setting.url}
          </a>
        </p>
        <div>
          <Button
            buttonType="twin-primary-l"
            buttonSize="md"
            className="h-10 w-1/2"
            onClick={() => onEdit(setting)}
          >
            <DocumentAddIcon className="m-auto" />{' '}
            <p className="m-auto font-semibold">Edit</p>
          </Button>
          <DeleteButton onDeleteRequested={() => onDelete(setting.id)} />
        </div>
      </li>
    ))}

    <li className="flex h-full items-center justify-center rounded-xl border-2 border-dashed border-gray-400 bg-zinc-800 p-4 text-zinc-400 shadow">
      <button
        type="button"
        className="add-button m-auto flex h-9 rounded bg-amber-600 px-4 text-zinc-200 shadow-md hover:bg-amber-500"
        onClick={onAdd}
      >
        <PlusCircleIcon className="m-auto h-5" />
        <p className="m-auto ml-1 font-semibold">Add server</p>
      </button>
    </li>
  </ul>
)

const DeleteButton = ({
  onDeleteRequested,
}: {
  onDeleteRequested: () => void
}) => {
  const [confirming, setConfirming] = useState(false)

  return (
    <Button
      buttonSize="md"
      buttonType="twin-secondary-r"
      className="h-10 w-1/2"
      onClick={() => {
        if (confirming) {
          onDeleteRequested()
          setConfirming(false)
        } else {
          setConfirming(true)
        }
      }}
    >
      <TrashIcon className="m-auto" />
      <p className="m-auto font-semibold">
        {confirming ? <>Are you sure?</> : <>Delete</>}
      </p>
    </Button>
  )
}

const InUseWarning = ({
  collections,
  onClose,
}: {
  collections: ICollection[]
  onClose: () => void
}) => (
  <Modal title="Server in-use" size="sm" onOk={onClose}>
    <p className="mb-4">
      This server is currently being used by the following rules:
      <ul className="list-inside list-disc">
        {collections.map((x) => (
          <li key={x.id}>{x.title}</li>
        ))}
      </ul>
    </p>
    <p>You must re-assign these rules to a different server before deleting.</p>
  </Modal>
)

export default ArrServices
