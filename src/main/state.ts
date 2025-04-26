import { BrowserWindow } from 'electron'
import type { Settings } from '../preload/types'
import type { Credentials } from '@theleop/push-receiver/dist/types'

export const state: {
  thisDeviceId: string | null
  devices: Map<string, { secureServerAddress?: string }>
  settings: Settings
  credentials: Credentials | null
  address: string | null
  win: BrowserWindow | null
} = {
  devices: new Map(),
  settings: {
    safeKeys: `a
s
d
f
g
h
j
k
l
q
w
e
r
t
y
u
i
o
p
`,

    autostart: true,
    showOnStart: true,
    scripts: new Map<string, string>(),
  },
  thisDeviceId: null,
  credentials: null,
  address: null,
  win: null,
}
