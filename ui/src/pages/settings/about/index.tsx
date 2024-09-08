import { NextPage } from 'next'
import SettingsWrapper from '../../../components/Settings'
import AboutSettings from '../../../components/Settings/About'

const SettingsAbout: NextPage = () => {
  return (
    <SettingsWrapper>
      <AboutSettings></AboutSettings>
    </SettingsWrapper>
  )
}

export default SettingsAbout
