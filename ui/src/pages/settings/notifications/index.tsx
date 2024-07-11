import { NextPage } from 'next'
import SettingsWrapper from '../../../components/Settings'
import NotificationSettings from '../../../components/Settings/Notifications'

const SettingsNotifications: NextPage = () => {
  return (
    <SettingsWrapper>
      <NotificationSettings />
    </SettingsWrapper>
  )
}

export default SettingsNotifications
