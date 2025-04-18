import { is } from '@electron-toolkit/utils'
import { BrowserWindow, globalShortcut, ipcMain as m, Notification } from 'electron'
import { join } from 'path'
import { actions, Actions } from './actions'
import joinIcon from '../../resources/join.png?asset'
import { DeviceInfo } from '../preload/types'
import { getCachedDevicesInfo, state } from './state'

let popupWin: BrowserWindow

export function applyShortcuts(shortcuts: Map<string, keyof Actions>) {
  globalShortcut.unregisterAll()
  shortcuts.forEach((action, accelerator) => {
    globalShortcut.register(accelerator, async () => {
      await actions[action](popupWin)
    })
  })
}

export function createPopup() {
  // TODO: change size of screen based on number of devices?
  popupWin = new BrowserWindow({
    width: 900,
    height: 300,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon: joinIcon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
    ...(process.platform === 'linux'
      ? { type: 'toolbar' }
      : process.platform === 'darwin'
        ? { type: 'panel' }
        : {}),
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    fullscreenable: false,
    frame: false,
    titleBarStyle: 'hidden',
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    popupWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/popup.html`)
  } else {
    popupWin.loadFile(join(__dirname, '../renderer/popup.html'))
  }
}

export async function selectDevice(
  win: BrowserWindow,
  predicate?: (device: DeviceInfo, index: number, array: DeviceInfo[]) => boolean,
) {
  if (win.isVisible()) {
    new Notification({
      title: 'Popup window already opened',
      body: "You can't open multiple popup windows. Doing nothing",
    }).show()
    return
  }
  const devicesInfo = await getCachedDevicesInfo()

  win.show()
  return new Promise<DeviceInfo | undefined>((res) => {
    const onSelected = (_: Electron.IpcMainEvent, device: DeviceInfo) => {
      res(device)
      win.hide()
      m.off('pop-up-selected', onSelected)
      m.off('pop-up-selected', onClose)
    }
    m.on('pop-up-selected', onSelected)
    const onClose = (_: Electron.IpcMainEvent) => {
      res(undefined)
      win.hide()
      m.off('pop-up-selected', onSelected)
      m.off('pop-up-selected', onClose)
    }
    m.on('pop-up-close', onClose)

    let filteredDevices = devicesInfo.filter((device) => device.deviceId !== state.thisDeviceId)
    if (predicate) filteredDevices = filteredDevices.filter(predicate)
    win.webContents.send('on-pop-up-devices', filteredDevices)
  })
}
