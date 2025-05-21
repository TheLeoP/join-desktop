import { Toaster } from '@renderer/components/sonner'
import { cn, buttonVariants } from '@renderer/lib/utils'
import { useIsLoggedIn, useDeviceId, useDevices } from '@renderer/util'
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
import { zodValidator } from '@tanstack/zod-adapter'
import { useEffect } from 'react'
import { z } from 'zod'

const searchSchema = z.object({
  deviceId: z.string().optional(),
})

export const Route = createRootRoute({
  component: Root,
  errorComponent: ErrorComponent,
  validateSearch: zodValidator(searchSchema),
})

function CurrentDevice() {
  const { deviceId: selectedDeviceId } = Route.useSearch()

  const { data: devices, error, isPending, isError } = useDevices()

  if (!selectedDeviceId) return

  if (isPending) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  }

  const selectedDevice = devices.records.find((device) => device.deviceId === selectedDeviceId)
  if (!selectedDevice) return

  return (
    <div className="absolute right-1 rounded-md bg-orange-200 p-1 dark:bg-orange-600">
      <span className="font-bold">Current device:</span> {selectedDevice.deviceName}
    </div>
  )
}

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
  const thisDeviceId = useDeviceId()

  useEffect(() => {
    if (!isLoggedIn || (isLoggedIn && !thisDeviceId)) {
      navigate({ from: '/', to: '/login' })
    } else if (isLoggedIn && thisDeviceId) {
      navigate({ from: '/', to: '/devices' })
    }
  }, [thisDeviceId, isLoggedIn, navigate])

  const { deviceId: selectedDeviceId } = Route.useSearch()

  return (
    <>
      {isLoggedIn && thisDeviceId && (
        <>
          <div className="flex gap-2 bg-white p-2 text-black dark:bg-neutral-800 dark:text-white">
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

            {selectedDeviceId && <CurrentDevice />}
          </div>
          <hr className="border-black dark:border-white" />
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
