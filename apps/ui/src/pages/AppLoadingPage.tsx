import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const AppLoadingPage = () => {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      try {
        const res = await fetch('/api/app/status', {
          cache: 'no-store',
          credentials: 'include',
        })
        if (!cancelled && res.ok) {
          const json = (await res.json()) as { status?: number }
          if (json.status) {
            navigate('/', { replace: true })
            return
          }
        }
      } catch {
        // ignore, keep retrying
      }

      if (!cancelled) setTimeout(tick, 750)
    }

    tick()
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-900">
      <div className="rounded-lg bg-zinc-800 p-6 text-center text-zinc-100 shadow-lg">
        <div className="text-lg font-semibold">Starting Maintainerr…</div>
        <div className="mt-2 text-sm text-zinc-300">
          Waiting for the API to become available.
        </div>
      </div>
    </div>
  )
}

export default AppLoadingPage
