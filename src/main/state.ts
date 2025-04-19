import type { Data, DeviceInfo, Settings } from '../preload/types'
import { type Credentials } from '@eneris/push-receiver/dist/types'
import { joinUrl } from './consts'
import { oauth2Client } from './google'

export const state: {
  thisDeviceId?: string
  devices: Map<string, { secureServerAddress?: string }>
  settings: Settings
  credentials: Credentials | undefined
} = {
  devices: new Map(),
  settings: {
    autostart: true,
    scripts: new Map<string, string>(),
  },
  credentials: undefined,
}
export let cachedDevicesInfo: DeviceInfo[]

export async function getDevicesInfo() {
  const token = await oauth2Client.getAccessToken()
  const res = await fetch(
    `${joinUrl}/registration/v1/listDevices`,

    {
      headers: {
        Authorization: `Bearer ${token.token}`,
      },
    },
  )
  const parsedRes = (await res.json()) as Data<DeviceInfo>
  // TODO: toast in frontend with errors? Notifications?
  if (!parsedRes.success) throw new Error(parsedRes.errorMessage)

  const devicesInfo = parsedRes.records
  cachedDevicesInfo = devicesInfo
  return devicesInfo
}

export async function getCachedDevicesInfo() {
  if (cachedDevicesInfo) return cachedDevicesInfo

  return await getDevicesInfo()
}
