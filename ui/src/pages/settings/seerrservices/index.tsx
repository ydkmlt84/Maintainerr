import { NextPage } from 'next'
import SettingsWrapper from '../../../components/Settings'
import SeerrServicesSettings from '../../../components/Settings/seerrServices'

const SettingsServices: NextPage = () => {
  return (
    <SettingsWrapper>
      <SeerrServicesSettings />
    </SettingsWrapper>
  )
}

export default SettingsServices
