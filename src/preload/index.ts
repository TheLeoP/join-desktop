import { contextBridge, ipcRenderer as r } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type MediaAction = {
  play?: boolean
  pause?: boolean
  back?: boolean
  next?: boolean
  mediaAppPackage?: string
  mediaVolume?: string
}

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

  // TODO: add refactoring scope for this

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
