import { UseMutateFunction, useMutation, useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { JSX } from 'react/jsx-runtime'
import debounce from 'lodash.debounce'
import type { ReactNode, SVGProps } from 'react'
import { Outlet, Link, useNavigate } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { queryClient } from './query'

const Google = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 256 262"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid"
    {...props}
  >
    <path
      d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
      fill="#4285F4"
    />
    <path
      d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
      fill="#34A853"
    />
    <path
      d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782"
      fill="#FBBC05"
    />
    <path
      d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
      fill="#EB4335"
    />
  </svg>
)
const LocalNetwork = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    {...props}
  >
    <path d="M10,2C8.89,2 8,2.89 8,4V7C8,8.11 8.89,9 10,9H11V11H2V13H6V15H5C3.89,15 3,15.89 3,17V20C3,21.11 3.89,22 5,22H9C10.11,22 11,21.11 11,20V17C11,15.89 10.11,15 9,15H8V13H16V15H15C13.89,15 13,15.89 13,17V20C13,21.11 13.89,22 15,22H19C20.11,22 21,21.11 21,20V17C21,15.89 20.11,15 19,15H18V13H22V11H13V9H14C15.11,9 16,8.11 16,7V4C16,2.89 15.11,2 14,2H10M10,4H14V7H10V4M5,17H9V20H5V17M15,17H19V20H15V17Z"></path>
  </svg>
)
const Previous = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M19.496 4.136l-12 7a1 1 0 0 0 0 1.728l12 7a1 1 0 0 0 1.504 -.864v-14a1 1 0 0 0 -1.04 -.864z" />
    <path d="M4 4a1 1 0 0 1 .993 .883l.007 .117v14a1 1 0 0 1 -1.993 .117l-.007 -.117v-14a1 1 0 0 1 1 -1z" />
  </svg>
)
const Pause = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M9 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z" />
    <path d="M17 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z" />
  </svg>
)
const Play = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 4v16a1 1 0 0 0 1.24 .852l13 -8a1 1 0 0 0 0 -1.704l-13 -8a1 1 0 0 0 -1.524 .852z" />
  </svg>
)
const Next = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 5v14a1 1 0 0 0 1.504 .864l12 -7a1 1 0 0 0 0 -1.728l-12 -7a1 1 0 0 0 -1.504 .864z" />
    <path d="M20 4a1 1 0 0 1 .993 .883l.007 .117v14a1 1 0 0 1 -1.993 .117l-.007 -.117v-14a1 1 0 0 1 1 -1z" />
  </svg>
)

type MediaInfo = {
  extraInfo: {
    maxMediaVolume: number
    mediaVolume: number
  }
  mediaInfosForClients: {
    appIcon: string
    appName: string
    artist: string
    date: number
    packageName: string
    playing: boolean
    track: string

    art?: string
    album?: string
  }[]
}

function useDeviceId() {
  const [deviceId, setDeviceId] = useState<string | null>(null)
  useEffect(() => {
    const removeListener = window.api.onDeviceId((id) => {
      setDeviceId(id)
    })

    return () => removeListener()
  }, [])

  return deviceId
}

const DeviceType = {
  android_phone: 1,
  android_tablet: 2,
  chrome_browser: 3,
  windows_10: 4,
  tasker: 5,
  firefox: 6,
  group: 7,
  android_tv: 8,
  google_assistant: 9,
  ios_phone: 10,
  ios_tablet: 11,
  ifttt: 12,
  ip: 13,
  mqtt: 14,
} as const

type DeviceTypeKey = keyof typeof DeviceType
type DeviceTypeValue = (typeof DeviceType)[DeviceTypeKey]

const ReverseDeviceType = {
  1: 'android_phone',
  2: 'android_tablet',
  3: 'chrome_browser',
  4: 'windows_10',
  5: 'tasker',
  6: 'firefox',
  7: 'group',
  8: 'android_tv',
  9: 'google_assistant',
  10: 'ios_phone',
  11: 'ios_tablet',
  12: 'ifttt',
  13: 'ip',
  14: 'mqtt',
} as const

type Data<T> = {
  success: boolean
  userAuthError: boolean
  records: T[]
}

type DeviceType = {
  id: string
  regId: string
  regId2: string
  userAccount: string
  deviceId: string
  deviceName: string
  deviceType: DeviceTypeValue
  apiLevel: number // TODO: enum?
  hasTasker: boolean
}

type MediaAction = {
  play?: boolean
  pause?: boolean
  back?: boolean
  next?: boolean
  mediaAppPackage?: string
  mediaVolume?: string
}

function Volume({
  max,
  initialValue,
  type,
  deviceId,
  regId2,
}: {
  max: number
  initialValue: number
  type: string
  deviceId: string
  regId2: string
}) {
  // TODO: make this actually change the value in the device
  const [volume, setVolume] = useState(initialValue)

  const { mutate: mediaAction } = useMediaAction(deviceId, regId2)
  const debouncedMediaAction = useRef<UseMutateFunction<
    unknown,
    Error,
    {
      action: MediaAction
    },
    unknown
  > | null>(null)
  if (debouncedMediaAction.current === null) {
    debouncedMediaAction.current = debounce(mediaAction, 250)
  }

  return (
    <div className="flex space-x-1">
      <img className="float-left w-5" src={`src/assets/${type}.svg`} />
      <input
        className="w-2/3"
        type="range"
        min={0}
        max={max}
        value={volume}
        onChange={(e) => {
          setVolume(+e.target.value)
          if (!debouncedMediaAction.current) return

          debouncedMediaAction.current({ action: { mediaVolume: e.target.value } })
        }}
      />
      {volume}
    </div>
  )
}

function useMediaAction(deviceId: string, regId2: string) {
  return useMutation<
    unknown,
    Error,
    {
      action: MediaAction
    }
  >({
    mutationFn: async ({ action }) => {
      await window.api.mediaAction(deviceId, regId2, action)
    },
    onMutate: async ({ action }) => {
      await queryClient.cancelQueries({ queryKey: ['mediaInfo', deviceId, regId2] })

      queryClient.setQueryData(['mediaInfo', deviceId, regId2], (old: MediaInfo) => {
        const newValue = { ...old }
        const currentInfo = newValue.mediaInfosForClients.find(
          (info) => info.packageName === action.mediaAppPackage,
        )
        if (currentInfo && action.play) {
          currentInfo.playing = true
        } else if (currentInfo && action.pause) {
          currentInfo.playing = false
        }
        return newValue
      })
    },
    // NOTE: can't simply invalidate and refetch the query because Join (the
    // mobile app) won't deliver updated information
  })
}

function Media({ deviceId, regId2 }: { deviceId: string; regId2: string }) {
  const {
    data: mediaInfo,
    error,
    isPending,
    isError,
    refetch,
  } = useQuery<MediaInfo>({
    refetchOnWindowFocus(query) {
      return !query.state.error
    },
    retryOnMount: false,
    staleTime: 60 * 1000,
    retry: false,
    queryKey: ['mediaInfo', deviceId, regId2],
    queryFn: async () => {
      return await window.api.media(deviceId, regId2)
    },
  })
  const onLocalNetwork = useOnLocalNetwork(deviceId)
  useEffect(
    () => void queryClient.invalidateQueries({ queryKey: ['mediaInfo', deviceId, regId2] }),
    [deviceId, regId2, onLocalNetwork],
  )

  const { mutate: mediaAction } = useMediaAction(deviceId, regId2)

  let info: JSX.Element
  if (isPending) {
    info = <div>Loading...</div>
  } else if (isError) {
    info = <div>Error: {error.message}</div>
  } else {
    info = (
      <div className="space-y-1">
        <Volume
          initialValue={mediaInfo.extraInfo.mediaVolume}
          max={mediaInfo.extraInfo.maxMediaVolume}
          type="media"
          deviceId={deviceId}
          regId2={regId2}
        />
        {mediaInfo.mediaInfosForClients
          .sort((a, b) => b.date - a.date)
          .map((info) => (
            <div key={info.packageName} className="rounded-sm bg-orange-100 p-1">
              <h1 className="text-center text-xl underline">{info.appName}</h1>
              {info.art && (
                <div className="flex flex-col items-center">
                  <img
                    src={
                      info.art?.startsWith('http') ? info.art : `data:image/png;base64,${info.art}`
                    }
                  />
                </div>
              )}
              {info.album && (
                <div>
                  <b>Album:</b> {info.album}
                </div>
              )}
              <div>
                <b>Artist:</b> {info.artist}
              </div>
              <div className="flex">
                <button
                  className="m-auto cursor-pointer hover:fill-gray-500 active:fill-gray-700"
                  onClick={() => {
                    mediaAction({
                      action: { back: true, mediaAppPackage: info.packageName },
                    })
                  }}
                >
                  <Previous />
                </button>

                <button
                  className="m-auto cursor-pointer hover:fill-gray-500 active:fill-gray-700"
                  onClick={() => {
                    mediaAction({
                      action: info.playing
                        ? { pause: true, mediaAppPackage: info.packageName }
                        : { play: true, mediaAppPackage: info.packageName },
                    })
                  }}
                >
                  {info.playing ? <Pause /> : <Play />}
                </button>
                <button
                  className="m-auto cursor-pointer hover:fill-gray-500 active:fill-gray-700"
                  onClick={() => {
                    mediaAction({
                      action: { next: true, mediaAppPackage: info.packageName },
                    })
                  }}
                >
                  <Next />
                </button>
              </div>
              <div>
                <b>Track:</b> {info.track}
              </div>
            </div>
          ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center space-y-1">
      {info}
      <button
        className="w-10 cursor-pointer bg-orange-100 stroke-black hover:stroke-gray-500 active:stroke-gray-700"
        onClick={async () => await refetch()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
          <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
        </svg>
      </button>
    </div>
  )
}

function Device({
  thisDeviceId,
  deviceId,
  regId2,
  deviceType,
  deviceName,
}: DeviceType & { thisDeviceId: string | null }) {
  const onLocalNetwork = useOnLocalNetwork(deviceId)

  return (
    <div className="flex w-60 flex-col items-center">
      <img
        src={`src/assets/${ReverseDeviceType[deviceType]}.png`}
        className="max-w-40 rounded-full bg-orange-300 p-2"
      />
      <div className="flex items-center space-x-1">
        <h2 className="text-center text-2xl">
          {thisDeviceId === deviceId ? `${deviceName} (this device)` : deviceName}
        </h2>
        {onLocalNetwork && (
          <div className="rounded-full bg-orange-300 fill-white p-1">
            <LocalNetwork />
          </div>
        )}
      </div>
      {/* NOTE: Join does this, I don't know if it's correct */}
      {(deviceType == DeviceType.android_phone || deviceType === DeviceType.android_tablet) && (
        <Media deviceId={deviceId} regId2={regId2} />
      )}
    </div>
  )
}

export function Devices() {
  const deviceId = useDeviceId()

  const {
    data: devices,
    error,
    isPending,
    isError,
  } = useQuery<Data<DeviceType>>({
    queryKey: ['devices'],
    queryFn: async () => {
      const joinUrl = 'https://joinjoaomgcd.appspot.com/_ah/api'
      const token = await window.api.getAccessToken()
      const res = await fetch(`${joinUrl}/registration/v1/listDevices`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      return await res.json()
    },
  })

  if (isPending) {
    return <div>Loading...</div>
  }

  if (isError) {
    return <div>Error: {error.message}</div>
  }

  return (
    <div className="flex h-screen w-full flex-wrap justify-center space-x-1 p-2">
      {devices.records.map((device) => (
        <Device key={device.id} {...device} thisDeviceId={deviceId} />
      ))}
    </div>
  )
}

export function LogIn() {
  const isLoggedIn = useIsLoggedIn()
  const deviceId = useDeviceId()

  const [deviceName, setDeviceName] = useState<string | null>(null)

  return (
    <div className="flex h-screen flex-col">
      <h1 className="pt-10 text-center text-9xl">Join Desktop</h1>
      {!isLoggedIn && (
        <div className="flex grow flex-col items-center justify-center">
          <button
            className="flex cursor-pointer items-center justify-center space-x-2 rounded-md bg-orange-200 p-4 hover:bg-orange-300 active:bg-orange-400"
            onClick={window.api.logInWithGoogle}
          >
            <Google className="w-10" />
            <p className="text-4xl">Log in with Google</p>
          </button>
        </div>
      )}

      {isLoggedIn && !deviceId && (
        <form
          className="flex grow items-center justify-center"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!deviceName) return
            await window.api.registerDevice(deviceName)
          }}
        >
          <div className="flex w-full max-w-xs flex-col space-y-2 rounded-md bg-orange-200 p-10 shadow-md">
            <label>
              <p className="text-2xl font-bold">Device name</p>
              <input
                placeholder="PC"
                className="w-full appearance-none border px-3 py-2 leading-tight shadow focus:outline-none"
                type="text"
                onChange={(e) => {
                  setDeviceName(e.target.value)
                }}
              />
            </label>

            <button className="mt-8 cursor-pointer rounded-md bg-white p-2 text-2xl hover:bg-gray-50 active:bg-gray-100">
              Register device
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

const devicesOnLocalNetworkContext = createContext<Record<string, boolean> | null>(null)
function useOnLocalNetwork(deviceId: string) {
  const devicesOnLocalNetwork = useContext(devicesOnLocalNetworkContext)
  const onLocalNetwork = devicesOnLocalNetwork ? devicesOnLocalNetwork[deviceId] : false
  return onLocalNetwork
}

export function DevicesOnLocalNetworkProvider({ children }: { children: ReactNode }) {
  const [devicesOnLocalNetwork, setDevicesOnLocalNetwork] = useState<Record<string, boolean>>({})
  useEffect(() => {
    const removeListener = window.api.onLocalNetwork((deviceId, onLocalNetwork) => {
      setDevicesOnLocalNetwork((devicesOnLocalNetwork) => ({
        ...devicesOnLocalNetwork,
        [deviceId]: onLocalNetwork,
      }))
    })
    return () => removeListener()
  }, [])

  return (
    <devicesOnLocalNetworkContext.Provider value={devicesOnLocalNetwork}>
      {children}
    </devicesOnLocalNetworkContext.Provider>
  )
}

function useIsLoggedIn() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  useEffect(() => {
    const removeListener = window.api.onLogIn(async () => {
      setIsLoggedIn(true)
      await window.api.startPushReceiver()
    })
    return () => removeListener()
  }, [])
  return isLoggedIn
}

export function Root() {
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

  // TODO: the navigation makes this flash. Maybe add some loading screen for x amount of seconds to aviod it
  useEffect(() => {
    if (!isLoggedIn || (isLoggedIn && !deviceId)) {
      navigate({ from: '/', to: '/login' })
    } else if (isLoggedIn && deviceId) {
      navigate({ from: '/', to: '/devices' })
    }
  }, [deviceId, isLoggedIn, navigate])

  return (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  )
}

export function Index() {
  return <></>
}
