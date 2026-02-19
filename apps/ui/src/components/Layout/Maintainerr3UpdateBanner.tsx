import { ExclamationIcon, XIcon } from '@heroicons/react/solid'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from '../Common/Button'

const BANNER_DISMISSED_KEY = 'maintainerr_3_update_banner_dismissed'

const readBannerDismissed = () => {
  try {
    return window.localStorage.getItem(BANNER_DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

const writeBannerDismissed = () => {
  try {
    window.localStorage.setItem(BANNER_DISMISSED_KEY, 'true')
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

const Maintainerr3UpdateBanner = () => {
  const [isVisible, setIsVisible] = useState(() => !readBannerDismissed())
  const location = useLocation()
  const navigate = useNavigate()
  const showPrepPointerContext =
    location.pathname === '/settings/main' &&
    new URLSearchParams(location.search).get('fromBanner') === '1'

  const dismissBanner = () => {
    setIsVisible(false)
    writeBannerDismissed()
  }

  const goToPrep = () => {
    navigate('/settings/main?fromBanner=1#prepare-maintainerr-3')
  }

  if (!isVisible || showPrepPointerContext) {
    return null
  }

  return (
    <div className="mb-3 rounded-md border border-amber-500/50 bg-amber-600/90 px-3 py-2 text-zinc-900 shadow-md">
      <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap sm:items-center">
        <ExclamationIcon className="mt-0.5 h-4 w-4 flex-shrink-0 sm:mt-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold sm:text-sm">
            View Maintainerr 3.0 preparation information.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <Button
            buttonType="warning"
            className="!border-zinc-900 !bg-zinc-900 !text-amber-200 hover:!border-zinc-800 hover:!bg-zinc-800"
            onClick={goToPrep}
          >
            View 3.0 Prep
          </Button>
          <button
            aria-label="Dismiss banner"
            className="rounded-md p-1 text-zinc-900/90 transition hover:bg-zinc-900/10 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/40"
            onClick={dismissBanner}
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default Maintainerr3UpdateBanner
