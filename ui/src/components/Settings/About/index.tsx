import { RefreshIcon, SaveIcon } from '@heroicons/react/solid'
import { InformationCircleIcon } from '@heroicons/react/solid';
import React, { useContext, useEffect, useRef, useState } from 'react'
import SettingsContext from '../../../contexts/settings-context'
import GetApiHandler, { PostApiHandler } from '../../../utils/ApiHandler'
import VersionStatus from '../../VersionStatus'
import { radarrfetcher } from '../../../utils/SWRfetcher';
import { sonarrfetcher } from '../../../utils/SWRfetcher';
import useSWR from 'swr';

const AboutSettings = () => {

  useEffect(() => {
    document.title = 'Maintainerr - Settings - About'
  }, [])

  interface versiontype {
    version: string;
  }

  const { data } = useSWR('api/app/status')

  function sonarrswr() {
    const { data } = useSWR('/api/v3/diskspace', sonarrfetcher)
    return (data)
  }
  return (
    <div className="h-full w-full">
      <div className="mt-6 rounded-md border border-amber-600 bg-amber-500 bg-opacity-20 p-4 backdrop-blur">
        <div className="flex">
          <div className="flex-shrink-0">
            <InformationCircleIcon className="h-5 w-5 text-gray-100" />
          </div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-sm leading-5 text-gray-100">
              This is BETA software. Features may be broken and/or unstable. Please report any issues on GitHub!'
            </p>
            <p className="mt-3 text-sm leading-5 md:mt-0 md:ml-6">
              <a
                href="http://github.com/jorenn92/maintainerr"
                className="whitespace-nowrap font-medium text-gray-100 transition duration-150 ease-in-out hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                GitHub &rarr;
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className="section h-full w-full">
        <h3 className="heading">About Maintainerr</h3>
      </div>
      <div className="section">
        <div className="form-row p-4">
          <label htmlFor="name" className="text-label">
            Version
          </label>
          <div className="form-input p-2">
            <div className="form-input-field">
              <span className="">
                <VersionStatus />
              </span>
            </div>
          </div>
        </div>
        <div className="form-row p-4">
          <label htmlFor="name" className="text-label">
            Container Config Path
          </label>
          <div className="form-input p-2">
            <div className="form-input-field">
              <span className="p-2">
                <code>/opt/data</code>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="section h-full w-full">
        <h3 className="heading">Radarr Statistics</h3>
      </div>
      <div className="section">
        <div className='form-row'>
          <label className='text-label'> Version </label>
          <div className='form-input'>
            <div className='form-input-field'>{sonarrswr()}</div>
          </div>
        </div>
      </div>

    </div>
  )
}
export default AboutSettings
