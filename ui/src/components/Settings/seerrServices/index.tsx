import { useEffect } from 'react'
import DocsButton from '../../Common/DocsButton'
import JellyseerrSettings from './Jellyseerr'
import OverseerrSettings from './Overseerr'

const RequestServices = () => {
  useEffect(() => {
    document.title = 'Maintainerr - Settings - Request Services'
  }, [])

  return (
    <div className="h-full w-full">
      <div className="flex flex-row items-center justify-center md:justify-start">
        <span className="flex space-x-2 rounded-md shadow-sm">
          <DocsButton page="Configuration/#jellyseerr" text="Jellyseerr Docs" />
          <DocsButton page="Configuration/#overseerr" text="Overseerr Docs" />
        </span>
      </div>
      {/* Overseerr Form */}
      <div className="section mt-8">
        <OverseerrSettings />
      </div>

      {/* Jellyseerr Form */}
      <div className="section mt-12">
        <JellyseerrSettings />
      </div>
    </div>
  )
}

export default RequestServices
