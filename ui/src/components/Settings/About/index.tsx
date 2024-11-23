import { InformationCircleIcon } from '@heroicons/react/solid'
import React, { useContext, useEffect, useRef, useState } from 'react'
import GetApiHandler from '../../../utils/ApiHandler'
import Releases from './Releases'

interface VersionResponse {
  status: 1 | 0
  version: string
  commitTag: string
  updateAvailable: boolean
}

const AboutSettings = () => {
  useEffect(() => {
    document.title = 'Maintainerr - Settings - About'
  }, [])
  // Timezone
  const getBrowserTimezone = (): string => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  }
  // End Timezone
  // Maintainerr Version
  const [version, setVersion] = useState<string>('')
  const [commitTag, setCommitTag] = useState<string>('')

  useEffect(() => {
    GetApiHandler('/app/status').then((resp: VersionResponse) => {
      if (resp.status) {
        setVersion(resp.version)
        setCommitTag(resp.commitTag)
      }
    })
  }, [])
  // End Maintainerr Version

  return (
    <div className="h-full w-full">
      <div className="mt-6 rounded-md border border-amber-600 bg-amber-500 bg-opacity-20 p-4 backdrop-blur">
        <div className="flex">
          <div className="flex-shrink-0">
            <InformationCircleIcon className="h-5 w-5 text-gray-100" />
          </div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-sm leading-5 text-gray-100">
              This is BETA software. Features may be broken and/or unstable.
              Please report any issues on GitHub!'
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
      {/* Maintainerr Portion */}
      <div className="section h-full w-full mb-2">
        <h3 className="heading">About Maintainerr</h3>
      </div>
      <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700"></hr>
      <div className="section my-2">
        <div className="form-row my-2">
          <label htmlFor="name" className="text-label">
            Version
          </label>
          <div className="form-input">
            <div className="form-input-field">
              <span className="">
                <code>{commitTag === 'local' ? 'local' : <>{version}</>}</code>
              </span>
            </div>
          </div>
        </div>
        <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700"></hr>
        <div className="form-row my-2">
          <label htmlFor="name" className="text-label">
            Container Config Path
          </label>
          <div className="form-input">
            <div className="form-input-field">
              <span className="">
                <code>/opt/data</code>
              </span>
            </div>
          </div>
        </div>
        <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700"></hr>
        <div className="form-row my-2">
          <label htmlFor="name" className="text-label">
            Time Zone
          </label>
          <div className="form-input">
            <div className="form-input-field">
              <span className="">
                <code>{getBrowserTimezone()}</code>
              </span>
            </div>
          </div>
        </div>
        <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700"></hr>
        <div className="form-row my-2">
          <label htmlFor="name" className="text-label">
            Number Of Rules
          </label>
          <div className="form-input">
            <div className="form-input-field">
              <span className="">
                <code>"Value goes here"</code>
              </span>
            </div>
          </div>
        </div>
        <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700"></hr>
        <div className="form-row my-2">
          <label htmlFor="name" className="text-label">
            Total Media in Collections
          </label>
          <div className="form-input">
            <div className="form-input-field">
              <span className="">
                <code>"Value goes here"</code>
              </span>
            </div>
          </div>
        </div>
      </div>
      <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700"></hr>
      {/* End Maintainerr Portion */}
      {/* Useful Links */}
      <div className="section h-full w-full mb-2">
        <h3 className="heading">Useful Links</h3>
      </div>
      <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700"></hr>
      <div className="section my-2">
        <div className="form-row my-2">
          <label className="text-label"> Documentation </label>
          <div className="form-input">
            <div className="form-input-field text-amber-600 font-bold underline">
              <a href="https://docs.maintainerr.info" target="_blank">
                https://docs.maintainerr.info
              </a>
            </div>
          </div>
        </div>
      </div>
      <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700"></hr>
      <div className="section my-2">
        <div className="form-row my-2">
          <label className="text-label"> Discord </label>
          <div className="form-input">
            <div className="form-input-field text-amber-600 font-bold underline">
              <a href="https://discord.gg/WP4ZW2QYwk" target="_blank">
                https://discord.gg/WP4ZW2QYwk
              </a>
            </div>
          </div>
        </div>
      </div>
      <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700"></hr>
      <div className="section my-2">
        <div className="form-row my-2">
          <label className="text-label"> Releases </label>
          <div className="form-input">
            <div className="form-input-field text-amber-600 font-bold underline">
              <a
                href="https://github.com/jorenn92/Maintainerr/releases"
                target="_blank"
              >
                https://github.com/jorenn92/Maintainerr/releases
              </a>
            </div>
          </div>
        </div>
      </div>
      <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700"></hr>
      <div className="section my-2">
        <div className="form-row my-2">
          <label className="text-label"> Feature Requests </label>
          <div className="form-input">
            <div className="form-input-field text-amber-600 font-bold underline">
              <a href="https://features.maintainerr.info" target="_blank">
                https://features.maintainerr.info
              </a>
            </div>
          </div>
        </div>
      </div>
      <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700"></hr>
      <div className="section my-2">
        <div className="form-row my-2">
          <label className="text-label"> Services Status </label>
          <div className="form-input">
            <div className="form-input-field text-amber-600 font-bold underline">
              <a href="https://status.maintainerr.info" target="_blank">
                https://status.maintainerr.info
              </a>
            </div>
          </div>
        </div>
      </div>
      <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700"></hr>
      {/* End Userful Links */}
      {/* Useful Links */}
      <div className="section h-full w-full mb-2">
        <h3 className="heading">Loving Maintainerr?</h3>
      </div>
      <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700"></hr>
      <div className="section my-2">
        <div className="form-row my-2">
          <label className="text-label"> Donations Welcome </label>
          <div className="form-input">
            <div className="form-input-field text-amber-600 font-bold underline">
              <a
                className="my-2 pr-2"
                href="https://github.com/sponsors/jorenn92"
                target="_blank"
              >
                Github Sponsors
              </a>
            </div>
          </div>
        </div>
      </div>
      <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700"></hr>
      <div className="section my-2">
        <div className="form-row my-2">
          <label className="text-label"></label>
          <div className="form-input">
            <div className="form-input-field text-amber-600 font-bold underline">
              <a href="https://ko-fi.com/maintainerr_app" target="_blank">
                Ko-fi
              </a>
            </div>
          </div>
        </div>
      </div>
      {/* End Userful Links */}
      {/* Show Releases */}
      <div className="section">
        <Releases currentVersion={version} />
      </div>
      {/* End Showing Releases */}
    </div>
  )
}
export default AboutSettings