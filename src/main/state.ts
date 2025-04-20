import type { Settings } from '../preload/types'
import type { Credentials } from '@eneris/push-receiver/dist/types'

export const state: {
  thisDeviceId: string | null
  devices: Map<string, { secureServerAddress?: string }>
  settings: Settings
  credentials: Credentials | null
  address: string | null
} = {
  devices: new Map(),
  settings: {
    autostart: true,
    scripts: new Map<string, string>(),
  },
  thisDeviceId: null,
  credentials: null,
  address: null,
}
