import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  deviceIdContext,
  devicesOnLocalNetworkContext,
  isLoggedInContext,
  queryClient,
  ReverseDeviceType,
  settingsContext,
  shortcutsContext,
} from './util'
import { Settings, type DeviceInfo } from 'src/preload/types'

export function JoinProvider({ children }: { children: ReactNode }) {
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

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  useEffect(() => {
    const removeListener = window.api.onLogIn(async () => {
      setIsLoggedIn(true)
      await window.api.startPushReceiver()
    })
    return () => removeListener()
  }, [])

  const [shortcuts, setShortcuts] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    const removeListener = window.api.onShortcuts(async (newShortcuts) => {
      setShortcuts(newShortcuts)
    })
    return () => removeListener()
  }, [])

  const onOnlineCbs = useRef<(() => void)[] | null>(null)
  if (onOnlineCbs.current === null) onOnlineCbs.current = []

  useEffect(() => {
    const onOnline = () => {
      // NOTE: tanstack query always start as `online`. Starting the app
      // offline and then triggering `online` won't invalidate (nor refecth)
      // queries, because tanstack queries things the online status hasn't
      // changed. So, we always manually invalidate all queries when `online`
      // is triggered
      queryClient.invalidateQueries()

      if (!onOnlineCbs.current) return
      onOnlineCbs.current.forEach((cb) => cb())
      onOnlineCbs.current.length = 0
    }
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('online', onOnline)
    }
  }, [])

  const [deviceId, setDeviceId] = useState<string | null>(null)
  useEffect(() => {
    const removeListener = window.api.onDeviceId(async (id) => {
      setDeviceId(id)
      await window.api.stopHttpServer()
      if (!id) return

      try {
        await window.api.startHttpServer()
      } catch (e) {
        if (!onOnlineCbs.current) return
        onOnlineCbs.current.push(async () => {
          await window.api.startHttpServer()
        })
      }
    })

    return () => removeListener()
  }, [])

  const [settings, setSettings] = useState<Settings | null>(null)
  useEffect(() => {
    const removeListener = window.api.onSettings((newSettings) => {
      setSettings(newSettings)
    })

    return () => removeListener()
  }, [])

  useEffect(() => {
    const removeListener = window.api.onDeviceRegistered((deviceRegistered) => {
      // TODO: add/remove each device instead of invalidating the whole thing?
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    })

    return () => removeListener()
  }, [])

  return (
    <devicesOnLocalNetworkContext.Provider value={devicesOnLocalNetwork}>
      <isLoggedInContext.Provider value={isLoggedIn}>
        <shortcutsContext.Provider value={[shortcuts, setShortcuts]}>
          <deviceIdContext.Provider value={deviceId}>
            <settingsContext.Provider value={[settings, setSettings]}>
              {children}
            </settingsContext.Provider>
          </deviceIdContext.Provider>
        </shortcutsContext.Provider>
      </isLoggedInContext.Provider>
    </devicesOnLocalNetworkContext.Provider>
  )
}

export function PhotoOrChar({ photo, char }: { photo: string | undefined; char: string }) {
  return photo ? (
    <img className="h-20 w-20" src={photo} />
  ) : (
    <div className="flex h-20 w-20 items-center justify-center bg-orange-400 text-center text-6xl text-white">
      {char}
    </div>
  )
}

export function PopUp() {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  useEffect(() => {
    const removeListener = window.api.onPopUpDevices((newDevices) => {
      setDevices(newDevices)
    })
    return () => removeListener()
  }, [])
  const [safeKeys, setSafeKeys] = useState<string[]>([])
  useEffect(() => {
    const removeListener = window.api.onPopUpSafeKeys((newSafeKeys) => {
      setSafeKeys(newSafeKeys.split('\n'))
    })
    return () => removeListener()
  }, [])
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const code = e.code
      if (code === 'KeyQ' || code === 'Escape') return window.api.popUpClose()

      const matches = code.match(/^Key(.*)$/)
      if (!matches) return
      const key = matches[1].toLowerCase()

      const i = safeKeys.indexOf(key)
      if (i === -1) return
      const selectedDevice = devices[i]
      if (!selectedDevice) return

      window.api.popUpSelected(selectedDevice)
    }

    document.addEventListener('keydown', f)
    return () => {
      document.removeEventListener('keydown', f)
    }
  }, [devices])

  return (
    <div className="flex h-screen flex-wrap items-center justify-center p-1">
      {devices.map((device, i) => (
        <div
          className="mx-auto flex h-full w-1/5 flex-col items-center justify-center space-y-1 border border-gray-400 p-1"
          key={device.id}
        >
          <img
            src={`./${ReverseDeviceType[device.deviceType]}.png`}
            className="h-1/3 rounded-full bg-orange-300 p-2"
          />
          <div className="flex h-1/3 items-center space-x-1">
            <h2 className="text-center text-xl">{device.deviceName}</h2>
          </div>
          <div className="items center flex aspect-square h-1/3 justify-center bg-orange-400">
            <div className="my-auto text-6xl text-white">{safeKeys[i]}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
