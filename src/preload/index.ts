import { contextBridge, ipcRenderer as r } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { DeviceInfo, MediaAction } from './types'

// Custom APIs for renderer
export const api = {
  logInWithGoogle: () => r.send('log-in-with-google'),
  openRemoteFile: (deviceId: string, regId: string, path: string, fileName: string) =>
    r.send('open-remote-file', deviceId, regId, path, fileName),
  getRemoteUrl: (deviceId: string, path: string) => r.invoke('get-remote-url', deviceId, path),

  startPushReceiver: () => r.invoke('start-push-receiver'),
  registerDevice: (name: string) => r.invoke('register-device', name),
  isLoggedInWithGoogle: () => r.invoke('is-logged-in-with-google'),
  getAccessToken: () => r.invoke('get-access-token'),

  mediaAction: (deviceId: string, regId: string, action: MediaAction) =>
    r.invoke('media-action', deviceId, regId, action),
  media: (deviceId: string, regId: string) => r.invoke('media', deviceId, regId),

  folders: (deviceId: string, regId: string, path: string) =>
    r.invoke('folders', deviceId, regId, path),
  contacts: (deviceId: string, regId: string) => r.invoke('contacts', deviceId, regId),
  sms: (deviceId: string, regId: string) => r.invoke('sms', deviceId, regId),
  smsChat: (deviceId: string, regId2: string, address: string) =>
    r.invoke('sms-chat', deviceId, regId2, address),
  smsSend: (deviceId: string, regId: string, smsnumber: string, smstext: string) =>
    r.invoke('sms-send', deviceId, regId, smsnumber, smstext),
  call: (callnumber: string, deviceId: string, regId2: string) =>
    r.send('call', callnumber, deviceId, regId2),
  actions: () => r.invoke('actions') as Promise<string[]>,
  shortcutsSave: (shortcuts: Map<string, string>) => r.invoke('shortcuts-save', shortcuts),

  onLocalNetwork: (cb: (deviceId: string, onLocalNetwork: boolean) => void) => {
    const f = (_, deviceId: string, onLocalNetwork: boolean) => {
      cb(deviceId, onLocalNetwork)
    }

    r.on('on-local-network', f)
    return () => {
      r.off('on-local-network', f)
    }
  },
  onDeviceId: (cb: (deviceId: string) => void) => {
    const f = (_, deviceId: string) => cb(deviceId)

    r.on('on-device-id', f)
    return () => {
      r.off('on-device-id', f)
    }
  },
  onLogIn: (cb: () => void) => {
    const f = (_) => cb()
    r.on('on-log-in', f)
    return () => {
      r.off('on-log-in', f)
    }
  },
  onSpeak: (cb: (say: string, language: string | undefined) => void) => {
    const f = (_, say: string, language: string) => cb(say, language)
    r.on('on-speak', f)
    return () => {
      r.off('on-speak', f)
    }
  },
  onShortcuts: (cb: (shortcuts: Map<string, string>) => void) => {
    const f = (_, shortcuts: Map<string, string>) => cb(shortcuts)
    r.on('on-shortcuts', f)
    return () => {
      r.off('on-shortcuts', f)
    }
  },

  onPopUpDevices: (cb: (devices: DeviceInfo[]) => void) => {
    const f = (_, devices: DeviceInfo[]) => cb(devices)
    r.on('on-pop-up-devices', f)
    return () => {
      r.off('on-pop-up-devices', f)
    }
  },
  popUpSelected: (device: DeviceInfo) => r.send('pop-up-selected', device),
  popUpClose: () => r.send('pop-up-close'),
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
