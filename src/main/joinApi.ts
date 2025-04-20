import { BrowserWindow } from 'electron'
import { promises as afs } from 'node:fs'
import type { GenericResponse } from '../preload/types'
import { joinUrl, deviceIdFile, devicesTypes } from './consts'
import { oauth2Client } from './google'
import { state } from './state'
import { Credentials } from '@eneris/push-receiver/dist/types'

export async function registerDevice(name: string, credentials: Credentials, win: BrowserWindow) {
  const token = await oauth2Client.getAccessToken()

  const res = await fetch(`${joinUrl}/registration/v1/registerDevice`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.token}`,
    },
    body: JSON.stringify({
      deviceId: state.thisDeviceId,
      regId: credentials.fcm.token,
      regId2: credentials.fcm.token,
      deviceName: name,
      // TODO: see if registering as an Android phone, other devices try to contact us via local network
      deviceType: devicesTypes.firefox,
    }),
  })
  const response = (await res.json()) as GenericResponse
  if (!response.success) throw new Error(response.errorMessage)
  const deviceId = (response as GenericResponse & { deviceId: string }).deviceId

  await afs.writeFile(deviceIdFile, deviceId, 'utf-8')
  state.thisDeviceId = deviceId
  win.webContents.send('on-device-id', state.thisDeviceId)
}

export async function renameDevice(deviceId: string, name: string) {
  const token = await oauth2Client.getAccessToken()

  const res = await fetch(`${joinUrl}/registration/v1/renameDevice`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.token}`,
    },
    body: JSON.stringify({
      deviceId: deviceId,
      newName: name,
    }),
  })
  const response = (await res.json()) as GenericResponse
  if (!response.success) throw new Error(response.errorMessage)
}

export async function deleteDevice(deviceId: string, win: BrowserWindow) {
  const token = await oauth2Client.getAccessToken()

  const res = await fetch(`${joinUrl}/registration/v1/unregisterDevice`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.token}`,
    },
    body: JSON.stringify({
      deviceId: deviceId,
    }),
  })
  const response = (await res.json()) as GenericResponse
  if (!response.success) throw new Error(response.errorMessage)

  if (deviceId === state.thisDeviceId) {
    state.thisDeviceId = null
    win.webContents.send('on-device-id', state.thisDeviceId)
    await afs.rm(deviceIdFile)
  }
}
