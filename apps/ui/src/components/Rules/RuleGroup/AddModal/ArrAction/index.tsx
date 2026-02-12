import { useEffect, useState } from 'react'
import { ServarrAction } from '../../../../../types/servarr-action'
import GetApiHandler from '../../../../../utils/ApiHandler'
import { IRadarrSetting } from '../../../../Settings/Radarr'
import { ISonarrSetting } from '../../../../Settings/Sonarr'

type ArrType = 'Radarr' | 'Sonarr'

interface ArrActionProps {
  type: ArrType
  arrAction?: number
  settingId?: number | null // null for when the user has selected 'None', undefined for when this is a new rule
  qualityProfileId?: number
  replaceExistingFilesAfterQualityProfileChange?: boolean
  searchAfterQualityProfileChange?: boolean
  options: Option[]
  onUpdate: (
    arrAction: number,
    settingId?: number | null,
    qualityProfileId?: number,
  ) => void
  onQualityProfileBehaviorChange?: (
    replaceExistingFilesAfterQualityProfileChange: boolean,
    searchAfterQualityProfileChange: boolean,
  ) => void
  accActionError?: string
  settingIdError?: string
  qualityProfileError?: string
}

interface Option {
  id: number
  name: string
}

interface QualityProfile {
  id: number
  name: string
}

const ArrAction = (props: ArrActionProps) => {
  const selectedSetting =
    props.settingId === undefined ? '-1' : (props.settingId?.toString() ?? '')
  const [settings, setSettings] = useState<(IRadarrSetting | ISonarrSetting)[]>(
    [],
  )
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([])
  const [loadingQualityProfiles, setLoadingQualityProfiles] =
    useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const action = props.arrAction ?? ServarrAction.DELETE
  const replaceExistingFilesAfterQualityProfileChange =
    props.replaceExistingFilesAfterQualityProfileChange ?? false
  const searchAfterQualityProfileChange =
    props.searchAfterQualityProfileChange ?? false

  const handleSelectedSettingIdChange = (id?: number | null) => {
    const actionUpdate = id == null ? ServarrAction.DELETE : action
    props.onUpdate(actionUpdate, id, undefined)
  }

  const handleActionChange = (value: number) => {
    props.onUpdate(
      value,
      props.settingId,
      value === ServarrAction.CHANGE_QUALITY_PROFILE
        ? props.qualityProfileId
        : undefined,
    )
  }

  const handleQualityProfileChange = (qualityProfileId?: number) => {
    props.onUpdate(action, props.settingId, qualityProfileId)
  }

  const loadArrSettings = async (type: ArrType) => {
    setLoading(true)
    setSettings([])
    const settingsResponse = await GetApiHandler<IRadarrSetting[]>(
      `/settings/${type.toLowerCase()}`,
    )
    setSettings(settingsResponse)
    setLoading(false)

    // The selected server does not exist anymore (old client data potentially) so deselect
    if (
      props.settingId &&
      settingsResponse.find((x) => x.id === props.settingId) == null
    ) {
      handleSelectedSettingIdChange(undefined)
    }
  }

  const loadQualityProfiles = async (settingId: number) => {
    setLoadingQualityProfiles(true)
    const response = await GetApiHandler<QualityProfile[]>(
      `/settings/${props.type.toLowerCase()}/${settingId}/quality-profiles`,
    )
    setQualityProfiles(response ?? [])
    setLoadingQualityProfiles(false)
  }

  useEffect(() => {
    loadArrSettings(props.type)
  }, [props.type])

  useEffect(() => {
    if (
      props.settingId == null ||
      action !== ServarrAction.CHANGE_QUALITY_PROFILE
    ) {
      setQualityProfiles([])
      return
    }

    loadQualityProfiles(props.settingId)
  }, [props.type, props.settingId, action])

  const noneServerSelected = selectedSetting === ''

  const options: Option[] = noneServerSelected
    ? [
        {
          id: ServarrAction.DELETE,
          name: 'Delete',
        },
        {
          id: ServarrAction.DO_NOTHING,
          name: 'Do nothing',
        },
      ]
    : props.options

  return (
    <div>
      <div className="form-row items-center">
        <label htmlFor={`${props.type}-server`} className="text-label">
          {props.type} server *
        </label>
        <div className="form-input">
          <div className="form-input-field">
            <select
              name={`${props.type}-server`}
              id={`${props.type}-server`}
              value={selectedSetting}
              onChange={(e) => {
                handleSelectedSettingIdChange(
                  e.target.value == '' ? null : +e.target.value,
                )
              }}
            >
              {selectedSetting === '-1' && (
                <option value="-1" disabled></option>
              )}
              <option value="">None</option>
              {settings.map((e) => {
                return (
                  <option key={e.id} value={e.id}>
                    {e.serverName}
                  </option>
                )
              })}
              {loading && (
                <option value="" disabled>
                  Loading servers...
                </option>
              )}
            </select>
          </div>
          {props.settingIdError ? (
            <p className="mt-1 text-xs text-red-400">{props.settingIdError}</p>
          ) : undefined}
        </div>
      </div>
      <div className="form-row items-center">
        <label htmlFor={`${props.type}-action`} className="text-label">
          {noneServerSelected ? 'Plex' : props.type} action
        </label>
        <div className="form-input">
          <div className="form-input-field">
            <select
              name={`${props.type}-action`}
              id={`${props.type}-action`}
              value={action}
              onChange={(e) => {
                handleActionChange(+e.target.value)
              }}
            >
              {options.map((e) => {
                return (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                )
              })}
            </select>
          </div>
          {props.accActionError ? (
            <p className="mt-1 text-xs text-red-400">{props.accActionError}</p>
          ) : undefined}
        </div>
      </div>
      {action === ServarrAction.CHANGE_QUALITY_PROFILE &&
        !noneServerSelected && (
          <>
            <div className="form-row items-center">
              <label
                htmlFor={`${props.type}-quality-profile`}
                className="text-label"
              >
                {props.type} quality profile *
                <p className="text-xs font-normal">
                  Choose which profile you want to change media to.
                </p>
              </label>
              <div className="form-input">
                <div className="form-input-field">
                  <select
                    name={`${props.type}-quality-profile`}
                    id={`${props.type}-quality-profile`}
                    value={props.qualityProfileId?.toString() ?? ''}
                    onFocus={() => {
                      if (props.settingId != null) {
                        loadQualityProfiles(props.settingId)
                      }
                    }}
                    onChange={(e) => {
                      handleQualityProfileChange(
                        e.target.value === '' ? undefined : +e.target.value,
                      )
                    }}
                  >
                    <option value="">Select quality profile</option>
                    {qualityProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                    {loadingQualityProfiles && (
                      <option value="" disabled>
                        Loading quality profiles...
                      </option>
                    )}
                  </select>
                </div>
                {props.qualityProfileError ? (
                  <p className="mt-1 text-xs text-red-400">
                    {props.qualityProfileError}
                  </p>
                ) : undefined}
              </div>
            </div>
            <div className="form-row items-start">
              <label className="text-label">
                Quality profile update behavior
                <p className="text-xs font-normal">
                  Choose what happens after changing the profile.
                </p>
              </label>
              <div className="form-input">
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="checkbox"
                      id={`${props.type}-quality-change-only`}
                      className="border-zinc-600 hover:border-zinc-500 focus:border-zinc-500 focus:bg-opacity-100 focus:placeholder-zinc-400 focus:outline-none focus:ring-0"
                      checked={
                        !searchAfterQualityProfileChange &&
                        !replaceExistingFilesAfterQualityProfileChange
                      }
                      onChange={(event) => {
                        if (event.target.checked) {
                          props.onQualityProfileBehaviorChange?.(false, false)
                        }
                      }}
                    />
                    <label
                      htmlFor={`${props.type}-quality-change-only`}
                      className="text-center text-sm"
                    >
                      Change Only
                    </label>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="checkbox"
                      id={`${props.type}-quality-search-only`}
                      className="border-zinc-600 hover:border-zinc-500 focus:border-zinc-500 focus:bg-opacity-100 focus:placeholder-zinc-400 focus:outline-none focus:ring-0"
                      checked={
                        searchAfterQualityProfileChange &&
                        !replaceExistingFilesAfterQualityProfileChange
                      }
                      onChange={(event) => {
                        if (event.target.checked) {
                          props.onQualityProfileBehaviorChange?.(false, true)
                        } else {
                          props.onQualityProfileBehaviorChange?.(false, false)
                        }
                      }}
                    />
                    <label
                      htmlFor={`${props.type}-quality-search-only`}
                      className="text-center text-sm"
                    >
                      Search New
                    </label>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="checkbox"
                      id={`${props.type}-replace-and-search`}
                      className="border-zinc-600 hover:border-zinc-500 focus:border-zinc-500 focus:bg-opacity-100 focus:placeholder-zinc-400 focus:outline-none focus:ring-0"
                      checked={replaceExistingFilesAfterQualityProfileChange}
                      onChange={(event) => {
                        if (event.target.checked) {
                          props.onQualityProfileBehaviorChange?.(true, true)
                        } else {
                          props.onQualityProfileBehaviorChange?.(false, false)
                        }
                      }}
                    />
                    <label
                      htmlFor={`${props.type}-replace-and-search`}
                      className="text-center text-sm"
                    >
                      Replace Old
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
    </div>
  )
}
export default ArrAction
