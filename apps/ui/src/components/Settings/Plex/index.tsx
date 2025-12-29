import { useSettingsOutletContext } from '..'
import { PlexSettingsForm } from './PlexSettingsForm'

const PlexSettings = () => {
  const { settings } = useSettingsOutletContext()

  return (
    <>
      <title>Plex settings - Maintainerr</title>
      <PlexSettingsForm settings={settings} variant="settings" />
    </>
  )
}

export default PlexSettings
