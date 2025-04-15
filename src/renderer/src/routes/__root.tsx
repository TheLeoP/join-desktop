import { useIsLoggedIn, useDeviceId } from '@renderer/util'
import { createRootRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
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

            {/* TODO: some kind of back button (? */}
            <Link to="/devices" className="text-xl [&.active]:font-bold">
              Devices
            </Link>
            <Link to="/shortcuts" className="text-xl [&.active]:font-bold">
              Shortcuts
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
