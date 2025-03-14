import { useQuery } from '@tanstack/react-query'
import { removeListener } from 'process'
import { useEffect, useState } from 'react'

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

type Device = {
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

function Devices() {
  const deviceId = useDeviceId()

  const {
    data: devices,
    error,
    isPending,
    isError,
  } = useQuery<Data<Device>>({
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
    <div className="flex space-x-1 flex-wrap">
      {devices.records.map((device) => (
        <div key={device.id} className="max-w-40">
          <img
            src={`src/assets/${ReverseDeviceType[device.deviceType]}.png`}
            className="bg-orange-300 rounded-full p-2 max-w-40"
          />
          <h2 className="text-2xl text-center">
            {deviceId === device.deviceId
              ? `${device.deviceName} (this device)`
              : device.deviceName}
          </h2>
        </div>
      ))}
    </div>
  )
}

function App(): JSX.Element {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  useEffect(() => {
    const removeListener = window.api.onLogIn(async () => {
      setIsLoggedIn(true)
      await window.api.startPushReceiver()
    })
    return () => removeListener()
  }, [])
  const deviceId = useDeviceId()

  const [deviceName, setDeviceName] = useState<string | null>(null)

  useEffect(() => {
    const removeListener = window.api.onSpeak(async (say, language) => {
      const utter = new SpeechSynthesisUtterance(say)
      utter.lang = language ?? 'en-US'
      window.speechSynthesis.speak(utter)
    })
    return () => removeListener()
  }, [])

  return (
    <>
      <Devices />
      {!isLoggedIn && <button onClick={window.api.logInWithGoogle}>Log in with Google</button>}
      {isLoggedIn && !deviceId && (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!deviceName) return
            await window.api.registerDevice(deviceName)
          }}
        >
          <input
            type="text"
            onChange={(e) => {
              setDeviceName(e.target.value)
            }}
          />
          <button>Register device</button>
        </form>
      )}
    </>
  )
}

export default App
