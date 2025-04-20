import type { Settings } from '../preload/types'
import type { Credentials } from '@eneris/push-receiver/dist/types'

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
