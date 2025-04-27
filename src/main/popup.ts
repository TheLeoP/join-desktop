import { is } from '@electron-toolkit/utils'
import mime from 'mime'
import { v4 as uuidv4 } from 'uuid'
import { promises as afs } from 'node:fs'
import * as fs from 'node:fs'
import * as https from 'node:https'
import {
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain as m,
  Notification,
} from 'electron'
import { basename, join } from 'path'
import joinIcon from '../../resources/join.png?asset'
import type { DeviceInfo, DeviceTypes, GenericResponse, Push } from '../preload/types'
import { state } from './state'
import { devicesFile, responseType, devicesTypes, responseFileTypes } from './consts'
import {
  oauth2Client,
  fcm,
  jwtClient,
  drive,
  joinDirNonLocal,
  deviceDirNonLocal,
  dirNonLocal,
  getCachedDevicesInfo,
} from './google'
import { notificationImage } from './images'
import { mapReplacer, error } from './utils'

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
      m.off('pop-up-close', onClose)
    }
    m.on('pop-up-selected', onSelected)
    const onClose = (_: Electron.IpcMainEvent) => {
      res(undefined)
      win.hide()
      m.off('pop-up-selected', onSelected)
      m.off('pop-up-close', onClose)
    }
    m.on('pop-up-close', onClose)

    let filteredDevices = devicesInfo.filter((device) => device.deviceId !== state.thisDeviceId)
    if (predicate) filteredDevices = filteredDevices.filter(predicate)
    win.webContents.send('on-pop-up-devices', filteredDevices)
    win.webContents.send('on-pop-up-safe-keys', state.settings.safeKeys)
  })
}

export async function fcmPush(deviceId: string, regId2: string, data: Record<string, string>) {
  const device = state.devices.get(deviceId)
  if (device && device.secureServerAddress) {
    const url = device.secureServerAddress
    const token = await oauth2Client.getAccessToken()
    const body = JSON.stringify(data)

    await new Promise<void>((res, rej) => {
      const req = https.request(`${url}gcm?token=${token.token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
        },
        rejectUnauthorized: false,
        insecureHTTPParser: true,
      })
      req.write(body)
      req.end()
      req.on('response', async (resp) => {
        resp.setEncoding('utf8')
        const body: string[] = []
        resp.on('data', (partial) => {
          body.push(partial)
        })
        resp.on('end', () => {
          const received = body.join('')
          try {
            const parsedData = JSON.parse(received) as GenericResponse

            if (!parsedData.success && parsedData.errorMessage)
              error(parsedData.errorMessage, state.win)
            res()
          } catch (e) {
            error(e?.toString() || 'An error occurred', state.win)
          }
        })
      })
      req.on('error', async (err: NodeJS.ErrnoException) => {
        if (err.code !== 'ECONNRESET' && err.code !== 'ECONNREFUSED') return rej(err)
        delete device.secureServerAddress
        await fcmPush(deviceId, regId2, data)
      })
    })
  } else {
    await fcm.projects.messages.send({
      auth: jwtClient,
      parent: 'projects/join-external-gcm',
      requestBody: {
        message: {
          token: regId2,
          android: {
            priority: 'high',
          },
          data: data,
        },
      },
    })
  }
}

export async function push(deviceId: string, regId2: string, data: Push) {
  await fcmPush(deviceId, regId2, {
    type: 'GCMPush',
    json: JSON.stringify({
      type: 'GCMPush',
      push: {
        id: uuidv4(),
        senderId: state.thisDeviceId,
        ...data,
      },
      senderId: state.thisDeviceId,
    }),
  })

  const pushesFileName = `pushes=:=${deviceId}`
  const pushesFiles = await drive.files.list({
    q: `name = '${pushesFileName}' and trashed = false`,
  })
  const files = pushesFiles.data.files
  if (!files) throw new Error(`\`files\` is undefined for the name ${pushesFileName}`)

  let pushesFile = files[0]

  if (!pushesFile) {
    const joinDirId = await joinDirNonLocal()
    const deviceDirId = await deviceDirNonLocal(deviceId, joinDirId)
    const historyDirId = await dirNonLocal('Push History Files', [deviceDirId])
    pushesFile = (
      await drive.files.create({
        requestBody: {
          name: pushesFileName,
          parents: [historyDirId],
        },
        media: {
          mimeType: 'application/json',
          body: '',
        },
        fields: 'id',
      })
    ).data
  }
  if (!pushesFile.id)
    throw new Error(`Push history file for deviceId ${deviceId} has no defined id on Google Drive`)

  const pushesFileContent = (
    await drive.files.get({
      alt: 'media',
      fileId: pushesFile.id,
    })
  ).data

  // @ts-ignore: The google api has the incorrect type when using `alt: 'media'`
  const text = pushesFileContent.text ? await pushesFileContent.text() : pushesFileContent
  let pushHistory: {
    apiLevel: number
    deviceId: string
    deviceType: DeviceTypes[keyof DeviceTypes]
    pushes: Push[]
  }
  try {
    pushHistory = JSON.parse(text)
  } catch (e) {
    const devicesInfo = await getCachedDevicesInfo()

    const deviceType = devicesInfo.find((device) => device.deviceId === deviceId)?.deviceType
    if (!deviceType) throw new Error(`Device with id ${deviceId} is not in cache`)

    pushHistory = {
      apiLevel: 0,
      deviceId: deviceId,
      deviceType,
      pushes: [],
    }
  }
  pushHistory.pushes.push(data)
  await drive.files.update({ fileId: pushesFile.id, media: { body: JSON.stringify(pushHistory) } })
}

export async function testLocalAddress(id: string, url: string, win: BrowserWindow) {
  const body = JSON.stringify({
    type: 'GCMLocalNetworkTest',
    json: JSON.stringify({
      type: 'GCMLocalNetworkTest',
      senderId: state.thisDeviceId,
    }),
  })

  const token = await oauth2Client.getAccessToken()
  const req = https.request(`${url}gcm?token=${token.token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': body.length,
    },
    rejectUnauthorized: false,
    insecureHTTPParser: true,
  })
  req.write(body)
  req.end()

  return new Promise<boolean>((res) => {
    req.on('response', async () => {
      if (!state.devices.has(id)) {
        state.devices.set(id, { secureServerAddress: url })
      } else if (state.devices.has(id)) {
        const device = state.devices.get(id)
        device!.secureServerAddress = url
      }
      await afs.writeFile(devicesFile, JSON.stringify(state.devices, mapReplacer), 'utf-8')
      win.webContents.send('on-local-network', id, true)

      res(true)
    })
    req.on('error', async () => {
      if (!state.devices.has(id)) return

      const device = state.devices.get(id)

      delete device?.secureServerAddress
      await afs.writeFile(devicesFile, JSON.stringify(state.devices, mapReplacer), 'utf-8')
      win.webContents.send('on-local-network', id, false)

      res(false)
    })
    setTimeout(() => {
      // NOTE: timeout in case the https server of the Android app doesn't send a response
      res(false)
    }, 60 * 1000)
  })
}

export async function setClipboard(deviceId: string, regId2: string, text: string) {
  await push(deviceId, regId2, {
    clipboard: text,
  })
}
export async function getClipboard(deviceId: string, regId2: string) {
  await push(deviceId, regId2, {
    clipboardget: true,
  })
}

export async function call(deviceId: string, regId2: string, callnumber: string) {
  await push(deviceId, regId2, {
    callnumber: callnumber,
  })
}

export async function smsSend(
  deviceId: string,
  regId2: string,
  smsnumber: string,
  smstext: string,
) {
  await push(deviceId, regId2, {
    // TODO: do I need to send the empty mms fields?
    responseType: responseType.push,
    smsnumber,
    smstext,
    requestId: 'SMS',
  })
}

export async function openUrl(deviceId: string, regId2: string, url: string) {
  await push(deviceId, regId2, {
    url,
  })
}

export async function sendFile(deviceId: string, regId2: string, path: string) {
  const filename = basename(path)
  const mimeType = mime.getType(path) ?? 'application/octet-stream'

  let fileUri: string
  const device = state.devices.get(deviceId)
  if (device && device.secureServerAddress) {
    const url = device.secureServerAddress
    const token = await oauth2Client.getAccessToken()
    const content = await afs.readFile(path)
    const req = https.request(`${url}files`, {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        'Content-Length': content.length,
        'Content-Disposition': `filename*=UTF-8''${encodeURIComponent(filename)}`,
        Authorization: `Bearer ${token.token}`,
      },
      rejectUnauthorized: false,
      insecureHTTPParser: true,
    })
    req.write(content)
    req.end()
    fileUri = await new Promise<string>((res, rej) => {
      req.on('response', (resp) => {
        resp.setEncoding('utf8')
        const body: string[] = []
        resp.on('data', (data) => {
          body.push(data)
        })
        resp.on('end', () => {
          const data = body.join('')
          try {
            const parsedData = JSON.parse(data) as GenericResponse
            if (!parsedData.success) return rej(parsedData.errorMessage)
            const info = parsedData.payload as { path: string }[]
            const file = info[0]
            res(file.path)
          } catch (e) {
            rej(e)
          }
        })
      })
      req.on('error', (err) => {
        rej(err)
      })
    })
  } else {
    const body = fs.createReadStream(path)
    fileUri = await UploadFileNonLocal(filename, mimeType, body)
  }

  new Notification({
    title: `File ${filename} uploaded`,
    body: `Available at ${fileUri}`,
    // TODO: use a file-esque icon(?
    icon: notificationImage,
  }).show()
  await push(deviceId, regId2, {
    files: [fileUri],
  })
}

export async function ring(deviceId: string, regId2: string) {
  await push(deviceId, regId2, {
    find: true,
  })
}

export async function locate(deviceId: string, regId2: string) {
  await push(deviceId, regId2, {
    location: true,
  })
}

export async function playPause(deviceId: string, regId2: string) {
  await push(deviceId, regId2, {
    playpause: true,
  })
}

export async function next(deviceId: string, regId2: string) {
  await push(deviceId, regId2, {
    next: true,
  })
}

export async function back(deviceId: string, regId2: string) {
  await push(deviceId, regId2, {
    back: true,
  })
}

async function UploadFileNonLocal(filename: string, mimeType: string, body: fs.ReadStream) {
  if (!state.thisDeviceId) throw new Error('thisDeviceId is undefined')

  const joinDirId = await joinDirNonLocal()
  const deviceDirId = await deviceDirNonLocal(state.thisDeviceId, joinDirId)

  // TODO: check if file exists first?
  const file = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [deviceDirId],
    },
    media: {
      mimeType,
      body,
    },
    fields: 'id',
  })

  return `https://www.googleapis.com/drive/v3/files/${file.data.id}/download`
}

export async function requestContactsAndLastSmSCreation(deviceId: string, regId2: string) {
  await fcmPush(deviceId, regId2, {
    type: 'GCMRequestFile',
    json: JSON.stringify({
      type: 'GCMRequestFile',
      requestFile: {
        requestType: responseFileTypes.sms_threads,
        senderId: state.thisDeviceId,
        deviceIds: [deviceId],
      },
      senderId: state.thisDeviceId,
    }),
  })
}

export async function requestSmsChatCreationOrUpdate(
  deviceId: string,
  regId2: string,
  address: string,
) {
  await fcmPush(deviceId, regId2, {
    type: 'GCMRequestFile',
    json: JSON.stringify({
      type: 'GCMRequestFile',
      requestFile: {
        requestType: responseFileTypes.sms_conversation,
        payload: address,
        senderId: state.thisDeviceId,
        deviceIds: [deviceId],
      },
      senderId: state.thisDeviceId,
    }),
  })
}

export async function requestLocalNetworkTest(deviceId: string, regId2: string) {
  if (!state.thisDeviceId) throw new Error('thisDeviceId is undefined')
  if (!state.address) throw new Error('address is undefined')

  await fcmPush(deviceId, regId2, {
    type: 'GCMLocalNetworkRequest',
    json: JSON.stringify({
      type: 'GCMLocalNetworkRequest',
      senderId: state.thisDeviceId,
      secureServerAddress: state.address,
    }),
  })
}

export const actions: Record<string, (popupWin: BrowserWindow) => Promise<void>> = {
  copy: async (popupWin: BrowserWindow) => {
    const device = await selectDevice(popupWin)
    if (!device) return

    getClipboard(device.deviceId, device.regId2)
  },
  paste: async (popupWin: BrowserWindow) => {
    const device = await selectDevice(popupWin)
    if (!device) return
    setClipboard(device.deviceId, device.regId2, clipboard.readText())
  },
  'open url': async (popupWin: BrowserWindow) => {
    const device = await selectDevice(popupWin)
    if (!device) return
    openUrl(device.deviceId, device.regId2, clipboard.readText())
  },
  call: async (popupWin: BrowserWindow) => {
    const device = await selectDevice(
      popupWin,
      (device) =>
        device.deviceType === devicesTypes.android_phone ||
        device.deviceType === devicesTypes.android_tablet,
    )
    if (!device) return
    call(device.deviceId, device.regId2, clipboard.readText())
  },
  'send file': async (popupWin: BrowserWindow) => {
    const device = await selectDevice(popupWin)
    if (!device) return
    const selected = await dialog.showOpenDialog(popupWin, {
      properties: ['openFile', 'multiSelections', 'showHiddenFiles', 'dontAddToRecent'],
    })
    if (selected.canceled) return

    selected.filePaths.forEach((path) => sendFile(device.deviceId, device.regId2, path))
  },
  ring: async (popupWin: BrowserWindow) => {
    const device = await selectDevice(popupWin)
    if (!device) return
    ring(device.deviceId, device.regId2)
  },
  locate: async (popupWin: BrowserWindow) => {
    const device = await selectDevice(popupWin)
    if (!device) return
    locate(device.deviceId, device.regId2)
  },
  'toggle win': async (_popupWin: BrowserWindow) => {
    if (!state.win) return

    if (state.win.isVisible()) state.win.hide()
    else state.win.show()
  },
  'play/pause': async (popupWin: BrowserWindow) => {
    const device = await selectDevice(
      popupWin,
      (device) =>
        device.deviceType === devicesTypes.android_phone ||
        device.deviceType === devicesTypes.android_tablet,
    )
    if (!device) return

    playPause(device.deviceId, device.regId2)
  },
  next: async (popupWin: BrowserWindow) => {
    const device = await selectDevice(
      popupWin,
      (device) =>
        device.deviceType === devicesTypes.android_phone ||
        device.deviceType === devicesTypes.android_tablet,
    )
    if (!device) return

    next(device.deviceId, device.regId2)
  },
  back: async (popupWin: BrowserWindow) => {
    const device = await selectDevice(
      popupWin,
      (device) =>
        device.deviceType === devicesTypes.android_phone ||
        device.deviceType === devicesTypes.android_tablet,
    )
    if (!device) return

    back(device.deviceId, device.regId2)
  },
} as const
export type Actions = typeof actions
