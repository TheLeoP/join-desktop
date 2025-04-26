import { Toaster } from '@renderer/components/sonner'
import { cn, buttonVariants } from '@renderer/lib/utils'
import { useIsLoggedIn, useDeviceId } from '@renderer/util'
import {
  createRootRoute,
  ErrorComponentProps,
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
      <Toaster />
    </>
  )
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h1 className="text-4xl">Error:</h1>
      <span className="text-2xl text-red-600">{error.message}</span>
      <button
        className={cn(buttonVariants(), 'text-xl')}
        onClick={() => {
          router.invalidate()
        }}
      >
        Invalidate
      </button>
      <button
        className={cn(buttonVariants(), 'text-xl')}
        onClick={() => {
          reset()
        }}
      >
        retry
      </button>
    </div>
  )
}

export const Route = createRootRoute({
  component: Root,
  errorComponent: ErrorComponent,
})
