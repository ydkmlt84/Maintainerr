import { NextPage } from 'next'
import SettingsWrapper from '../../../components/Settings'
import ServicesSettings from '../../../components/Settings/arrServices'

const SettingsServices: NextPage = () => {
  return (
    <SettingsWrapper>
      <ServicesSettings />
    </SettingsWrapper>
  )
}

export default SettingsServices
