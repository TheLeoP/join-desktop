import { BrowserWindow, clipboard, dialog, Notification } from 'electron'
import { promises as afs } from 'node:fs'
import mime from 'mime'
import { v4 as uuidv4 } from 'uuid'
import * as https from 'node:https'
import * as fs from 'node:fs'
import { type DeviceTypes, type GenericResponse, type Push } from '../preload/types'
import { basename } from 'node:path'
import { selectDevice } from './popup'
import { getCachedDevicesInfo, state } from './state'
import {
  oauth2Client,
  jwtClient,
  drive,
  fcm,
  deviceDirNonLocal,
  dirNonLocal,
  joinDirNonLocal,
} from './google'
import { notificationImage } from './images'
import { responseType, devicesTypes } from './consts'

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
        resp.on('data', (data) => {
          body.push(data)
        })
        resp.on('end', () => {
          const data = body.join('')
          try {
            const parsedData = JSON.parse(data) as GenericResponse
            // TODO: show some kind of error?
            if (!parsedData.success) return rej(new Error(parsedData.errorMessage))
            res()
          } catch (e) {
            // TODO: show some kind of error? x2
          }
        })
      })
      req.on('error', async (err: NodeJS.ErrnoException) => {
        if (err.code !== 'ECONNRESET' && err.code !== 'ECONNREFUSED') return rej(err)
        delete device.secureServerAddress
        fcmPush(deviceId, regId2, data)
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
  if (!files) throw new Error(`No files with the name ${pushesFileName}`)

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
  const text = await pushesFileContent.text()
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

export async function setClipboard(deviceId: string, regId2: string, text: string) {
  push(deviceId, regId2, {
    clipboard: text,
  })
}
export async function getClipboard(deviceId: string, regId2: string) {
  push(deviceId, regId2, {
    clipboardget: true,
  })
}

export async function call(deviceId: string, regId2: string, callnumber: string) {
  push(deviceId, regId2, {
    callnumber: callnumber,
  })
}

export async function smsSend(
  deviceId: string,
  regId2: string,
  smsnumber: string,
  smstext: string,
) {
  push(deviceId, regId2, {
    // TODO: do I need to send the empty mms fields?
    responseType: responseType.push,
    smsnumber,
    smstext,
    requestId: 'SMS',
  })
}

export async function openUrl(deviceId: string, regId2: string, url: string) {
  push(deviceId, regId2, {
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
  push(deviceId, regId2, {
    files: [fileUri],
  })
}

export async function ring(deviceId: string, regId2: string) {
  push(deviceId, regId2, {
    find: true,
  })
}

export async function locate(deviceId: string, regId2: string) {
  push(deviceId, regId2, {
    location: true,
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
} as const
export type Actions = typeof actions
