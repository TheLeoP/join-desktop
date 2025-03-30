import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { devicesOnLocalNetworkContext, ReverseDeviceType } from './util'
import { type DeviceInfo } from 'src/preload/types'

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

export function PhotoOrChar({ photo, char }: { photo: string | undefined; char: string }) {
  return photo ? (
    <img className="h-20 w-20" src={photo} />
  ) : (
    <div className="flex h-20 w-20 items-center justify-center bg-orange-400 text-center text-6xl text-white">
      {char}
    </div>
  )
}

// TODO: make configurable
const safeKeys = [
  // home row
  'a',
  's',
  'd',
  'f',
  'g',
  'h',
  'j',
  'k',
  'l',
  // upper row
  'q',
  'w',
  'e',
  'r',
  't',
  'y',
  'u',
  'i',
  'o',
  'p',
]
export function PopUp() {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  useEffect(() => {
    const removeListener = window.api.onPopUpDevices((newDevices) => {
      setDevices(newDevices)
    })
    return () => removeListener()
  }, [])
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const code = e.code
      const matches = code.match(/^Key(.*)$/)
      if (!matches) return
      const key = matches[1].toLowerCase()

      if (key === 'q') return window.api.popUpClose()

      const i = safeKeys.indexOf(key)
      if (i === -1) return
      const selectedDevice = devices[i]
      if (!selectedDevice) return

      // TODO: send null on <esc>
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
            src={`src/assets/${ReverseDeviceType[device.deviceType]}.png`}
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
