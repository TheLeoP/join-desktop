import { useIsLoggedIn, useDeviceId } from '@renderer/util'
import {
  createRootRoute,
  Link,
  Outlet,
  useCanGoBack,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useEffect } from 'react'

function Root() {
  useEffect(() => {
    const removeListener = window.api.onSpeak(async (say, language) => {
      const utter = new SpeechSynthesisUtterance(say)
      utter.lang = language ?? 'en-US'
      window.speechSynthesis.speak(utter)
    })
    return () => removeListener()
  }, [])

  const navigate = useNavigate()
  const router = useRouter()
  const canGoBack = useCanGoBack()

  const isLoggedIn = useIsLoggedIn()
  const deviceId = useDeviceId()

  useEffect(() => {
    if (!isLoggedIn || (isLoggedIn && !deviceId)) {
      navigate({ from: '/', to: '/login' })
    } else if (isLoggedIn && deviceId) {
      navigate({ from: '/', to: '/devices' })
    }
  }, [deviceId, isLoggedIn, navigate])

  return (
    <>
      {isLoggedIn && (
        <>
          <div className="flex gap-2 p-2">
            {/* TODO: maybe show all buttons and a selector for avilable devices */}
            <button
              className="cursor-pointer text-xl"
              onClick={() => router.history.back()}
              disabled={!canGoBack}
            >
              Go back
            </button>
            <Link to="/devices" className="text-xl [&.active]:font-bold">
              Devices
            </Link>
            <Link to="/shortcuts" className="text-xl [&.active]:font-bold">
              Shortcuts
            </Link>
            <Link to="/settings" className="text-xl [&.active]:font-bold">
              Settings
            </Link>
          </div>
          <hr />
        </>
      )}
      <Outlet />
      <TanStackRouterDevtools />
    </>
  )
}

export const Route = createRootRoute({
  component: Root,
})
