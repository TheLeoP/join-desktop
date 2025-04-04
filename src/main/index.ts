import {
  app,
  shell,
  BrowserWindow,
  ipcMain as m,
  clipboard,
  Notification,
  nativeImage,
  globalShortcut,
  Tray,
  Menu,
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import joinIcon from '../../resources/join.png?asset'
import batteryOkIcon from '../../resources/battery_ok.png?asset'
import batteryChargingIcon from '../../resources/battery_charging.png?asset'
import batteryLowIcon from '../../resources/battery_low.png?asset'
import * as fs from 'node:fs'
import { promises as afs } from 'node:fs'
import * as http from 'node:http'
import { URL } from 'node:url'
import { PushReceiver } from '@eneris/push-receiver'
import { type MessageEnvelope, type Credentials } from '@eneris/push-receiver/dist/types'
import { google } from 'googleapis'
import * as https from 'node:https'
import { v4 as uuidv4 } from 'uuid'
import AutoLaunch from 'auto-launch'
import {
  Data,
  MediaInfo,
  FolderInfo,
  FileInfo,
  ContactInfo,
  SmsInfo,
  JoinData,
  Push,
  NotificationClear,
  LocalNetworkRequest,
  DeviceNotOnLocalNetworkRequest,
  Status,
  RespondFile,
  DeviceInfo,
  GenericResponse,
  FoldersResponse,
  SmsResponse,
} from '../preload/types'

const joinUrl = 'https://joinjoaomgcd.appspot.com/_ah/api'

const dataDir = app.getPath('userData')
const credentialsFile = `${dataDir}/credentials.json`
const persistentIdsFile = `${dataDir}/persistentIds.json`
const tokenFile = `${dataDir}/token.json`
const devicesFile = `${dataDir}/devices.json`
const deviceIdFile = `${dataDir}/deviceId`
const notificationImage = nativeImage.createFromPath(joinIcon).resize({ width: 50 })
const batteryOkImage = nativeImage.createFromPath(batteryOkIcon).resize({ width: 50 })
const batteryChargingImage = nativeImage.createFromPath(batteryChargingIcon).resize({ width: 50 })
const batteryLowImage = nativeImage.createFromPath(batteryLowIcon).resize({ width: 50 })

const notifications = new Map<string, Notification>()
let devices: Map<string, { secureServerAddress?: string }>

const mediaRequests = new Map<string, (mediaInfo: MediaInfo | null) => void>()
const folderRequests = new Map<string, (folderInfo: FolderInfo | null) => void>()
const fileRequests = new Map<string, (folderInfo: FileInfo | null) => void>()
const contactRequests = new Map<string, (contactInfo: ContactInfo[] | null) => void>()
const smsThreadRequests = new Map<string, (smsThreadInfo: SmsInfo[] | null) => void>()
const smsChatRequests = new Map<string, (smsChatInfo: SmsInfo[] | null) => void>()

function mapReplacer(key, value: []) {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: [...value],
    }
  } else {
    return value
  }
}

function mapReviver(key, value) {
  if (typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value)
    }
  }
  return value
}

const devicesTypes = {
  android_phone: 1,
  android_tablet: 2,
  chrome_browser: 3,
  windows_10: 4,
  tasker: 5,
  firefox: 6,
  group: 7,
  android_tv: 8,
  google_assistant: 9,
  ios_phone: 10,
  ios_tablet: 11,
  ifttt: 12,
  ip: 13,
  mqtt: 14,
} as const

const joinAppId = '596310809542-giumrib7hohfiftljqmj7eaio3kl21ek.apps.googleusercontent.com'
const joinAppSecret = 'NTA9UbFpNhaIP74B_lpxGgvR'
const joinRedirectUri = 'http://127.0.0.1:9876'
const oauth2Client = new google.auth.OAuth2(joinAppId, joinAppSecret, joinRedirectUri)
google.options({ auth: oauth2Client })

const email = 'fcm-sender@join-external-gcm.iam.gserviceaccount.com'
const jwtSecret = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCybvuSZiNWISfi
BiCMLXMtak93LGyE3faxnKg7TSvx19YJ0Stcofq7jyuehcHMhoksYVwSzdfYm8yV
VIliNNVAysdI4bSELR8LTNF7wVzLi1UNfpjQGuxiWS0VIev1WuheqvHIbdiJtD38
tQ89cGlKLiN5DizQD5cg6GGcyFwZv35jOQAIYuQhhJZWl8RRkemcndiZ+semmf6E
TeSGnmbyFmhXyWySerdvyj+ZzvoPL4olo5deURlgoCg8uiv8ajVCOdOkOQ/E9J+n
2yIwvjGk/VSeMxXpzQw+5Qj2/gvtz6ufAlIBDb4HpSsE7+Ui7er7BCjSLXdEpS4y
3PsHKJodAgMBAAECggEAF0eolfCygo2/3Nrsyy0w3keFB6jpnaoyAflM77PBXIPK
/qvmKudNRcRHrh6Iau1Qn1QyhZeKpk2pcwA9Dm2TNyldt9IO0cHrT3edyzYuq7XJ
ioGuYVRp6+jzm1K6LOBH+fX2pq5CNrEn9z0OOHdenVmIskYZramjD52SArkXXxpn
elFcAIbAaiqY1OBU0swGadXuhoeC5fqk8axGEF9ZXbf/utXD0mFqhFI3zz9x/gwY
LzP5Fkd50UQmAb4PE+8q4etjCazvttr9864YlXMTKGwNx8Sh8SehDL4+B56pK1Kr
ano0v+Fj0cHh/UJSJit4RXSJiuxxGGQ5IO7koTWYIQKBgQDjz2BpCZ7OgB2iYsi2
xZEf8PWWXPpW2aYsn+KcTT4DA1L65aSaWRQVKBUUDHIT7cNzf+wjw7C7Y0ISG2yT
MfgQbAZMCIzLV3GsM3kV6yqciQczGlp/TqdaJVnGGXPVe5P0sC/Bfwgoi02EkK1K
+rm/rE5ueT+eHwgxNXeWZcc/8QKBgQDIg3Gltsh8xoMcgbBA/poiCrxSklQ22jq8
CqzyqrdUDC7pr5hp+DcEjOBiX3j5qp5diSoROrZmYW1go3MG5P6/HR7bitj4feW6
Yl9vblHch9fTaFGsZMJwchjaaN+2RklYUZ6/Nhr4TCnKQgMOyaaCyzCwzDpE2GOX
1Wktt8Do7QKBgQCKZF+4T6zW3AOks4glaG4aTmKTPtahzkTiFRswQshqQim1264c
SgMmOxxa+piOvMEguFS3AVmq7MilgV17Kj79kvJcXFFT8kJPD1H+28ceIyxpghf6
AMkvvUMFUk8JILKoUiQg01AceUvVPaLYyunuo/ldqXDZWRa79jQ4/ImHsQKBgEA1
75/sr7ldbMElOsclgUBjhbk/iN5j9ikflhDD4J92o1NMWxecWCoJ3xVBk6EIJVy4
vxLzZVPV4UvwK7bKgFW9QpN1nFO/JWERfZRWlLp1egUGRBlbzvRpZVIUAYgCbBxv
TtHWxr46zasqhoYmxz7dSMNlM0e2r/YAboUocgtlAoGAZgaKi0hH/JW1cSGTfbMI
1V4056YtrUgiX5AhKEtfC2sVLC5orwuZmJaa5JjdQT+2PnecMdDmatojDQjklE/e
vrpopN2oeBDqVA+ofcpVsFxgLTlWRD5uKb027tAcneViRN2CNHlO/Cw4c8ZIG0xe
QRBL0hYZ7DUaVIdmhvlALMw=
-----END PRIVATE KEY-----`
const jwtClient = new google.auth.JWT({
  email,
  key: jwtSecret,
  scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
})
const fcm = google.fcm('v1')
const drive = google.drive('v3')

const joinAutoLauncher = new AutoLaunch({ name: 'join-desktop', isHidden: true })
// TODO: allow disabling in settings
joinAutoLauncher.enable()

async function logInWithGoogle(win: BrowserWindow) {
  if (Object.keys(oauth2Client.credentials).length !== 0) return win.webContents.send('on-log-in')

  const scopes = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.readonly',
  ]
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  })

  const code = await new Promise<string | null>((res, rej) => {
    const server = http.createServer((req, resp) => {
      if (!req.url) return

      const code = new URL(`http://localhost${req.url}`).searchParams.get('code')
      res(code)

      resp.writeHead(200)
      resp.end(`<!DOCTYPE html>
<html>
  <body onload="window.close()">
    <h1>Everything done, you can close this<h1>
  </body>
</html>`)
      server.close()
    })
    server.listen(9876, () => shell.openExternal(authUrl))
  })
  if (!code) throw new Error('No code was received')

  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)
  await afs.writeFile(tokenFile, JSON.stringify(tokens), 'utf-8')

  win.webContents.send('on-log-in')
}

let thisDeviceId: string | undefined

async function registerDevice(name: string) {
  const token = await oauth2Client.getAccessToken()

  if (!credentials) throw new Error('There are no credentials')

  const res = await fetch(`${joinUrl}/registration/v1/registerDevice`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.token}`,
    },
    body: JSON.stringify({
      deviceId: thisDeviceId,
      regId: credentials.fcm.token,
      regId2: credentials.fcm.token,
      deviceName: name,
      deviceType: devicesTypes.firefox,
    }),
  })
  const out = await res.json()
  await afs.writeFile(deviceIdFile, out.deviceId, 'utf-8')
  thisDeviceId = out.deviceId
  const win = BrowserWindow.getFocusedWindow()
  if (!win) throw new Error("There's no win")
  win.webContents.send('on-device-id', thisDeviceId)
}

let credentials: Credentials | undefined

const respondFileTypes = {
  screenshot: 1,
  video: 2,
  sms_threads: 3,
  sms_conversation: 4,
  notifications: 5,
  // NOTE: there doesn't seem to be a type for 6 (?
  media_infos: 7,
} as const
const responseType = {
  push: 0,
  file: 1,
} as const

async function push(deviceId: string, regId2: string, data: Record<string, string>) {
  const device = devices.get(deviceId)
  if (device && device.secureServerAddress) {
    const url = device.secureServerAddress
    const token = await oauth2Client.getAccessToken()
    const body = JSON.stringify(data)

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
        const parsedData = JSON.parse(data) as GenericResponse
        // TODO: show some kind of error?
        if (!parsedData.success) return
      })
    })
    req.on('error', async (err: NodeJS.ErrnoException) => {
      if (err.code !== 'ECONNRESET' && err.code !== 'ECONNREFUSED') return
      delete device.secureServerAddress
      push(deviceId, regId2, data)
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

async function setClipboard(deviceId: string, regId2: string, text: string) {
  push(deviceId, regId2, {
    type: 'GCMPush',
    json: JSON.stringify({
      type: 'GCMPush',
      push: {
        clipboard: text,
        id: uuidv4(),
        senderId: thisDeviceId,
      },
      senderId: thisDeviceId,
    }),
  })
}

async function call(callnumber: string, deviceId: string, regId2: string) {
  push(deviceId, regId2, {
    type: 'GCMPush',
    json: JSON.stringify({
      type: 'GCMPush',
      push: {
        callnumber: callnumber,
        id: uuidv4(),
        senderId: thisDeviceId,
      },
      senderId: thisDeviceId,
    }),
  })
}

async function smsSend(deviceId: string, regId2: string, smsnumber: string, smstext: string) {
  push(deviceId, regId2, {
    type: 'GCMPush',
    json: JSON.stringify({
      type: 'GCMPush',
      push: {
        // TODO: do I need to send the empty mms fields?
        responseType: responseType.push,
        smsnumber,
        smstext,
        requestId: 'SMS',
        id: uuidv4(),
        senderId: thisDeviceId,
      },
      senderId: thisDeviceId,
    }),
  })
}

async function testLocalAddress(id: string, url: string, win: BrowserWindow) {
  const body = JSON.stringify({
    type: 'GCMLocalNetworkTest',
    json: JSON.stringify({
      type: 'GCMLocalNetworkTest',
      senderID: thisDeviceId,
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

  return new Promise<boolean>((res, rej) => {
    req.on('response', async () => {
      if (!devices.has(id)) {
        devices.set(id, { secureServerAddress: url })
      } else if (devices.has(id)) {
        const device = devices.get(id)
        device!.secureServerAddress = url
      }
      await afs.writeFile(devicesFile, JSON.stringify(devices, mapReplacer), 'utf-8')
      win.webContents.send('on-local-network', id, true)

      res(true)
    })
    req.on('error', async () => {
      if (!devices.has(id)) return

      const device = devices.get(id)
      delete device?.secureServerAddress
      await afs.writeFile(devicesFile, JSON.stringify(devices, mapReplacer), 'utf-8')
      win.webContents.send('on-local-network', id, false)

      res(false)
    })
  })
}

async function getContactsNonLocal(deviceId: string) {
  const contactsFileName = `contacts=:=${deviceId}`
  const response = await drive.files.list({
    q: `name = '${contactsFileName}' and trashed = false`,
  })
  const files = response.data.files
  if (!files) throw new Error(`No files with the name ${contactsFileName}`)

  // TODO: is this correct? This is what the join app does
  const fileInfo = files[0]
  if (!fileInfo) throw new Error(`No files with the name ${contactsFileName}`)
  if (!fileInfo.id)
    throw new Error(`Contacts file for deviceId ${deviceId} has no defined id on Google Drive`)

  const file = (
    await drive.files.get({
      alt: 'media',
      fileId: fileInfo.id,
    })
  ).data

  // @ts-ignore: The google api has the incorrect type when using `alt: 'media'`
  const text = await file.text()
  const contactsInfo = JSON.parse(text).contacts as ContactInfo[]
  return contactsInfo
}

async function getSmsThreadsNonLocal(deviceId: string) {
  const smssFileName = `lastsms=:=${deviceId}`
  const response = await drive.files.list({
    q: `name = '${smssFileName}' and trashed = false`,
  })
  const files = response.data.files
  if (!files) throw new Error(`No files with the name ${smssFileName}`)

  // TODO: is this correct? This is what the join app does
  const fileInfo = files[0]
  if (!fileInfo) throw new Error(`No files with the name ${smssFileName}`)
  if (!fileInfo.id)
    throw new Error(`Smss file for deviceId ${deviceId} has no defined id on Google Drive`)

  const file = (
    await drive.files.get({
      alt: 'media',
      fileId: fileInfo.id,
    })
  ).data

  // @ts-ignore: The google api has the incorrect type when using `alt: 'media'`
  const text = await file.text()
  const smssThreadInfo = JSON.parse(text) as SmsInfo[]
  return smssThreadInfo
}

async function getSmsChatsNonLocal(deviceId: string, address: string) {
  const smssFileName = `sms=:=${deviceId}=:=${address}`
  const response = await drive.files.list({
    q: `name = '${smssFileName}' and trashed = false`,
  })
  const files = response.data.files
  if (!files) throw new Error(`No files with the name ${smssFileName}`)

  // TODO: is this correct? This is what the join app does
  const fileInfo = files[0]
  if (!fileInfo) throw new Error(`No files with the name ${smssFileName}`)
  if (!fileInfo.id)
    throw new Error(`Smss file for deviceId ${deviceId} has no defined id on Google Drive`)

  const file = (
    await drive.files.get({
      alt: 'media',
      fileId: fileInfo.id,
    })
  ).data

  // @ts-ignore: The google api has the incorrect type when using `alt: 'media'`
  const text = await file.text()
  const smssChatInfo = JSON.parse(text) as { number: string; smses: SmsInfo[] }
  return smssChatInfo.smses
}

const multiNotifications = new Map<string, string[]>()
let lastBatteryNotification: Notification | undefined
async function startPushReceiver(win: BrowserWindow, onReady: () => Promise<void>) {
  const persistentIds = await new Promise<string[]>((res, rej) => {
    fs.readFile(persistentIdsFile, 'utf-8', (err, content) => {
      if (err && err.code == 'ENOENT') return res([])
      else if (err) rej(err)
      else res(JSON.parse(content))
    })
  })

  const instance = new PushReceiver({
    debug: false,
    persistentIds: persistentIds,
    firebase: {
      apiKey: 'AIzaSyBeI64VSoGCs20sXOwRG_kuDirugdScDIk',
      appId: '1:737484412860:web:5ddce9f690528241167db9',
      authDomain: 'join-external-gcm.firebaseapp.com',
      databaseURL: 'https://join-external-gcm.firebaseio.com',
      messagingSenderId: '737484412860',
      projectId: 'join-external-gcm',
      storageBucket: 'join-external-gcm.appspot.com',
    },
    credentials: credentials,
  })
  instance.onReady(onReady)

  instance.onCredentialsChanged(async ({ oldCredentials, newCredentials }) => {
    credentials = newCredentials
    await afs.writeFile(credentialsFile, JSON.stringify(credentials), 'utf-8')
  })

  const handleNotification = async (notification: MessageEnvelope) => {
    // TODO: remove
    console.log('Notification received', notification)

    const rawData = notification.message.data
    if (
      rawData &&
      rawData.multi &&
      typeof rawData.multi === 'string' &&
      rawData.value &&
      typeof rawData.value === 'string' &&
      rawData.id &&
      typeof rawData.id === 'string' &&
      !rawData.length
    ) {
      if (!multiNotifications.has(rawData.id)) multiNotifications.set(rawData.id, [])
      const acc = multiNotifications.get(rawData.id) as string[]
      acc[+rawData.multi] = rawData.value
    } else if (
      rawData &&
      rawData.multi &&
      typeof rawData.multi === 'string' &&
      rawData.id &&
      typeof rawData.id === 'string' &&
      rawData.value &&
      typeof rawData.value === 'string' &&
      rawData.type &&
      typeof rawData.type === 'string'
    ) {
      const acc = multiNotifications.get(rawData.id) as string[]
      acc[+rawData.multi] = rawData.value
      await handleNotification({
        message: { data: { json: acc.join(''), type: rawData.type } },
        persistentId: notification.persistentId,
      })
    } else if (rawData && rawData.json && typeof rawData.json === 'string') {
      const data = rawData as JoinData
      const content = JSON.parse(data.json)

      // TODO: support reading settings and modyfing behaviour accordingly?
      let n: Notification | undefined
      switch (data.type) {
        case 'GCMPush': {
          const push = (content as Push).push
          if (push.clipboard) {
            clipboard.writeText(push.clipboard)
            n = new Notification({
              title: 'Clipboard set',
              icon: notificationImage,
            })
          } else if (push.clipboardget) {
            n = new Notification({
              title: 'Clipboard requested',
              body: push.url,
              icon: notificationImage,
            })

            const devicesInfo = await getDevicesInfo()
            if (!devicesInfo) return

            const receiver = devicesInfo.find((device) => device.deviceId === push.senderId)
            if (!receiver) return

            setClipboard(receiver.deviceId, receiver.regId2, clipboard.readText())
          } else if (push.url) {
            shell.openExternal(push.url)
            n = new Notification({
              title: 'Openning url',
              body: push.url,
              icon: notificationImage,
            })
          } else if (push.files && push.files.length > 0) {
            // TODO: maybe handle base64 images?
            n = new Notification({
              title: 'Received files',
              body: 'Openning now...',
              icon: notificationImage,
            })
            push.files
              .filter((file) => file.startsWith('https://'))
              .forEach((file) => {
                return shell.openExternal(file)
              })
          } else if (push.location) {
            // doesn't work in Electron because it needs a Google API_KEY with location API access
            // see https://github.com/electron/electron/pull/22034
            n = new Notification({
              title: 'Location Requested not supported',
              icon: notificationImage,
            })
          } else if (push.say) {
            win.webContents.send('on-speak', push.say, push.language)
            n = new Notification({
              title: `Saying Out Loud${push.language ? ` with language ${push.language}` : ''}`,
              body: push.say,
              icon: notificationImage,
            })
          } else if (push.title) {
            // TODO: handle custom commands. They will be on `text` and there won't be any title
            n = new Notification({
              title: push.title,
              body: push.text,
              icon: notificationImage,
            })
          } else {
            // TODO: do something else?
            n = new Notification({
              title: 'Join',
              body: 'Receive push',
              icon: notificationImage,
            })
          }

          if (n) {
            n.show()
          }
          if (n && push.id) {
            notifications.set(push.id, n)
            n.on('close', () => {
              if (push.id) notifications.delete(push.id)
            })
          }
          break
        }
        case 'GCMNotificationClear': {
          // TODO: not all notification clear contain this information, like
          //
          //'{"requestNotification":{"deviceIds":["161358ee94
          // 5e4623bb91d6394477ef24","1d308d8af00040029c680c31091922f6","b
          // 0b34f7c345f4ffd882af69d9c4405ea","9396b8fc718447f9871b7578a90
          // edf6e","f8378458d99c4f95a4d750322c2c1d66","049ec31c6bc4468d95
          // 9c3461cccae932"],"requestId":"batteryevent","senderId":"54d62
          // 6ca229342bc8ae47db6a87aa02b"}}'
          const req = (content as NotificationClear).requestNotification
          if (!req.notificationId) break

          notifications.get(req.notificationId)?.close()
          break
        }
        case 'GCMLocalNetworkRequest': {
          const localReq = content as LocalNetworkRequest
          const url = localReq.secureServerAddress
          const id = localReq.senderId
          if (!url || !id) return

          testLocalAddress(id, url, win)

          break
        }
        case 'GCMDeviceNotOnLocalNetwork': {
          const req = content as DeviceNotOnLocalNetworkRequest
          const id = req.senderId

          if (!devices.has(id)) return

          const device = devices.get(id)
          delete device?.secureServerAddress
          await afs.writeFile(devicesFile, JSON.stringify(devices, mapReplacer), 'utf-8')
          win.webContents.send('on-local-network', id, false)
          break
        }
        case 'GCMStatus': {
          const statusWrapper = content as Status
          if (statusWrapper.request) return
          const status = statusWrapper.status

          let n: Notification | undefined
          if (status.batteryPercentage === 100) {
            n = new Notification({
              title: 'Battery charged',
              body: 'Battery at 100%',
              icon: batteryOkImage,
            })
          } else if (status.charging) {
            // TODO: only show first charging notification, ignore the next ones until the state is no longer charging
            n = new Notification({
              title: 'Battery charging',
              body: `Battery at ${status.batteryPercentage}%`,
              icon: batteryChargingImage,
            })
          } else if (status.batteryPercentage <= 30 && !status.charging) {
            n = new Notification({
              title: 'Battery low',
              body: `Battery at ${status.batteryPercentage}%`,
              icon: batteryLowImage,
            })
          }

          if (n) {
            if (lastBatteryNotification) lastBatteryNotification.close()
            n.show()
            lastBatteryNotification = n
          }

          break
        }
        case 'GCMRespondFile': {
          const response = (content as RespondFile).responseFile
          switch (response.request.requestType) {
            case respondFileTypes.media_infos: {
              const fileId = new URL(response.downloadUrl).searchParams.get('id')
              if (!fileId) break

              const file = (
                await drive.files.get({
                  alt: 'media',
                  fileId,
                })
              ).data

              // @ts-ignore: The google api has the incorrect type when using `alt: 'media'`
              const text = await file.text()
              const mediaInfo = JSON.parse(text) as MediaInfo
              response.request.deviceIds.forEach((deviceId) => {
                const mediaRequest = mediaRequests.get(deviceId)
                if (!mediaRequest) return

                mediaRequest(mediaInfo)
              })

              break
            }
            case respondFileTypes.sms_threads: {
              await Promise.all(
                response.request.deviceIds.map(async (deviceId) => {
                  const contactRequest = contactRequests.get(deviceId)
                  if (contactRequest) {
                    const contactsInfo = await getContactsNonLocal(deviceId)
                    contactRequest(contactsInfo)
                  }
                  const smsThreadRequest = smsThreadRequests.get(deviceId)
                  if (smsThreadRequest) {
                    const smsInfo = await getSmsThreadsNonLocal(deviceId)
                    smsThreadRequest(smsInfo)
                  }
                }),
              )

              break
            }
            case respondFileTypes.sms_conversation: {
              const address = response.request.payload
              if (!address) return

              await Promise.all(
                response.request.deviceIds.map(async (deviceId) => {
                  const smsChatRequest = smsChatRequests.get(deviceId)
                  if (!smsChatRequest) return

                  const smsInfo = await getSmsChatsNonLocal(deviceId, address)
                  smsChatRequest(smsInfo)
                }),
              )

              break
            }
          }
          break
        }
        case 'GCMFolder': {
          const response = content as FolderInfo

          const path = `/${response.pathSegments.join('/')}`
          const request = folderRequests.get(path)
          if (!request) return
          request(response)
          folderRequests.delete(path)
          break
        }
        case 'GCMFile': {
          const response = content as FileInfo

          const request = fileRequests.get(response.fileName)
          if (!request) return
          request(response)
          fileRequests.delete(response.fileName)
          break
        }
      }
    }

    await afs.writeFile(persistentIdsFile, JSON.stringify(persistentIds), 'utf-8')
  }
  instance.onNotification(handleNotification)

  await instance.connect()
}

// TODO: try to use something else?
let cachedDevicesInfo: DeviceInfo[]
async function getDevicesInfo() {
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
  if (!parsedRes.success) return

  const devicesInfo = parsedRes.records
  cachedDevicesInfo = devicesInfo
  return devicesInfo
}

function createWindow(tray: Tray) {
  // Create the browser window.
  const win = new BrowserWindow({
    // TODO: how does this look in windows? Start maximized instead?
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  m.handle('start-push-receiver', () =>
    startPushReceiver(win, async () => {
      const devicesInfo = await getDevicesInfo()
      if (!devicesInfo) return

      const resultsLocal = await Promise.all(
        devicesInfo.map(async (info) => {
          const localInfo = devices.get(info.deviceId)
          if (!localInfo || !localInfo?.secureServerAddress) return { info, success: false }

          const success = await testLocalAddress(info.deviceId, localInfo.secureServerAddress, win)
          return { info, success }
        }),
      )
      const resultsDrive = await Promise.all(
        resultsLocal
          .filter((result) => !result.success)
          .map(async ({ info }) => {
            const addressesFileName = `serveraddresses=:=${info.deviceId}`
            const response = await drive.files.list({
              q: `name = '${addressesFileName}' and trashed = false`,
            })
            const files = response.data.files
            if (!files) return

            // TODO: is this correct? This is what the join app does
            const fileInfo = files[0]
            if (!fileInfo || !fileInfo.id) return

            const file = (
              await drive.files.get({
                alt: 'media',
                fileId: fileInfo.id,
              })
            ).data

            // @ts-ignore: The google api has the incorrect type when using `alt: 'media'`
            const text = await file.text()
            const localReq = JSON.parse(text) as LocalNetworkRequest
            const url = localReq.secureServerAddress
            const id = localReq.senderId
            if (!url || !id) return

            const success = await testLocalAddress(id, url, win)
            return { info, success }
          }),
      )
      await Promise.all(
        resultsDrive
          .filter((result) => !!result)
          .filter((result) => !result?.success)
          .map(async ({ info }) => {
            await fcm.projects.messages.send({
              auth: jwtClient,
              parent: 'projects/join-external-gcm',
              requestBody: {
                message: {
                  token: info.regId2,
                  android: {
                    priority: 'high',
                  },
                  data: {
                    type: 'GCMLocalNetworkTestRequest',
                    json: JSON.stringify({
                      type: 'GCMLocalNetworkTestRequest',
                      senderId: thisDeviceId,
                    }),
                  },
                },
              },
            })
          }),
      )
    }),
  )
  m.on('log-in-with-google', () => {
    logInWithGoogle(win)
  })
  m.on('call', (_, callnumber, deviceId, regId2) => call(callnumber, deviceId, regId2))
  m.on(
    'open-remote-file',
    async (_, deviceId: string, regId: string, path: string, fileName: string) => {
      const device = devices.get(deviceId)
      if (device && device.secureServerAddress) {
        const url = device.secureServerAddress
        const token = await oauth2Client.getAccessToken()
        shell.openExternal(`${url}files${path}?token=${token.token}`)
      } else {
        await fcm.projects.messages.send({
          auth: jwtClient,
          parent: 'projects/join-external-gcm',
          requestBody: {
            message: {
              token: regId,
              android: {
                priority: 'high',
              },
              data: {
                type: 'GCMFolderRequest',
                json: JSON.stringify({
                  type: 'GCMFolderRequest',
                  path,
                  senderId: thisDeviceId,
                }),
              },
            },
          },
        })

        const request = fileRequests.get(fileName)
        if (request) request(null)

        fileRequests.set(fileName, (fileInfo) => {
          if (!fileInfo) return

          shell.openExternal(fileInfo.url)
        })
      }
    },
  )
  m.handle('get-remote-url', async (_, deviceId: string, path: string) => {
    const device = devices.get(deviceId)
    if (device && device.secureServerAddress) {
      const url = device.secureServerAddress
      const token = await oauth2Client.getAccessToken()
      const remoteUrl = `${url}files${path}?token=${token.token}`
      return remoteUrl
    } else {
      // NOTE: Can't preview file if device is outside of local network because google drive links are not public
      return null
    }
  })
  m.handle(
    'sms-send',
    async (_, deviceId, smsnumber, regId2, smstext) =>
      await smsSend(deviceId, smsnumber, regId2, smstext),
  )

  const showMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      role: 'unhide',
      click: () => {
        win.show()
      },
    },
  ])
  const hideMenu = Menu.buildFromTemplate([
    {
      label: 'Close',
      role: 'hide',
      click: (item, win, event) => {
        win?.hide()
      },
    },
  ])
  win.on('hide', () => tray.setContextMenu(showMenu))
  win.on('show', () => tray.setContextMenu(hideMenu))

  win.on('ready-to-show', async () => {
    // TODO: hide by default
    win.show()

    // TODO: can there be a race condition in here? Should I wait for an event after the website is shown?
    try {
      const content = await afs.readFile(credentialsFile, 'utf-8')
      credentials = JSON.parse(content)
    } catch {}
    try {
      const content = await afs.readFile(tokenFile, 'utf-8')
      const tokens = JSON.parse(content)
      oauth2Client.setCredentials(tokens)
      win.webContents.send('on-log-in')
    } catch {}
    try {
      const content = await afs.readFile(deviceIdFile, 'utf-8')
      thisDeviceId = content
      win.webContents.send('on-device-id', thisDeviceId)
    } catch (e) {}
    try {
      const content = await afs.readFile(devicesFile, 'utf-8')
      devices = JSON.parse(content, mapReviver)
    } catch {
      devices = new Map()
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createPopup() {
  // TODO: change size of screen based on number of devices?
  const win = new BrowserWindow({
    width: 900,
    height: 300,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
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
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/popup.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/popup.html'))
  }

  return win
}

async function selectDevice(win: BrowserWindow) {
  if (!cachedDevicesInfo) await getDevicesInfo()
  win.show()
  return new Promise<DeviceInfo>((res) => {
    const onSelected = (_: Electron.IpcMainEvent, device: DeviceInfo) => {
      res(device)
      win.hide()
      m.off('pop-up-selected', onSelected)
      m.off('pop-up-selected', onClose)
    }
    m.on('pop-up-selected', onSelected)
    const onClose = (_: Electron.IpcMainEvent) => {
      win.hide()
      m.off('pop-up-selected', onSelected)
      m.off('pop-up-selected', onClose)
    }
    m.on('pop-up-close', onClose)
    win.webContents.send(
      'on-pop-up-devices',
      cachedDevicesInfo.filter((device) => device.deviceId !== thisDeviceId),
    )
  })
}

async function requestContactsAndLastSmSCreation(deviceId: string, regId: string) {
  push(deviceId, regId, {
    type: 'GCMRequestFile',
    json: JSON.stringify({
      type: 'GCMRequestFile',
      requestFile: {
        requestType: respondFileTypes.sms_threads,
        senderId: thisDeviceId,
        deviceIds: [deviceId],
      },
      senderId: thisDeviceId,
    }),
  })
}

async function requestSmsChatCreationOrUpdate(deviceId: string, regId2: string, address: string) {
  push(deviceId, regId2, {
    type: 'GCMRequestFile',
    json: JSON.stringify({
      type: 'GCMRequestFile',
      requestFile: {
        requestType: respondFileTypes.sms_conversation,
        payload: address,
        senderId: thisDeviceId,
        deviceIds: [deviceId],
      },
      senderId: thisDeviceId,
    }),
  })
}

async function getMediaInfoNonLocal(deviceId: string, regId2: string) {
  await fcm.projects.messages.send({
    auth: jwtClient,
    parent: 'projects/join-external-gcm',
    requestBody: {
      message: {
        token: regId2,
        android: {
          priority: 'high',
        },
        data: {
          type: 'GCMRequestFile',
          json: JSON.stringify({
            type: 'GCMRequestFile',
            requestFile: {
              requestType: respondFileTypes.media_infos,
              senderId: thisDeviceId,
              deviceIds: [deviceId],
            },
            senderId: thisDeviceId,
          }),
        },
      },
    },
  })

  return await new Promise((res, rej) => {
    const mediaRequest = mediaRequests.get(deviceId)
    if (mediaRequest) mediaRequest(null)

    mediaRequests.set(deviceId, (mediaInfo) => {
      res(mediaInfo)
    })
    setTimeout(() => {
      mediaRequests.delete(deviceId)
      rej(new Error('Media request timed out'))
    }, 30 * 1000)
  })
}

async function mediaActionNonLocal(regId2: string, data: Record<string, string>) {
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

Menu.setApplicationMenu(null)
app.whenReady().then(() => {
  const tray = new Tray(joinIcon)
  tray.setToolTip('Join desktop app')

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-tdeviceIdoolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  m.handle('register-device', (_, name) => {
    return registerDevice(name)
  })
  // TODO: does this throw sometimes? Before login in?

  m.handle('get-access-token', async () => (await oauth2Client.getAccessToken()).token)
  // TODO: handle local connection failling and removing secureServerAddress if it fails
  m.handle('media', async (_, deviceId, regId2) => {
    const device = devices.get(deviceId)
    if (device && device.secureServerAddress) {
      const url = device.secureServerAddress
      const token = await oauth2Client.getAccessToken()
      const req = https.request(`${url}media?token=${token.token}`, {
        rejectUnauthorized: false,
        insecureHTTPParser: true,
      })
      req.end()
      return new Promise((res, rej) => {
        req.on('response', (resp) => {
          resp.setEncoding('utf8')
          const body: string[] = []
          resp.on('data', (data) => {
            body.push(data)
          })
          resp.on('end', () => {
            const data = body.join('')
            const parsedData = JSON.parse(data) as GenericResponse
            if (!parsedData.success) return rej(parsedData.errorMessage)
            const mediaInfo = parsedData.payload as MediaInfo
            res(mediaInfo)
          })
        })
        req.on('error', async (err: NodeJS.ErrnoException) => {
          if (err.code !== 'ECONNRESET' && err.code !== 'ECONNREFUSED') return rej(err)
          delete device.secureServerAddress
          const mediaInfo = await getMediaInfoNonLocal(deviceId, regId2)
          res(mediaInfo)
        })
      })
    } else {
      return await getMediaInfoNonLocal(deviceId, regId2)
    }
  })
  m.handle('folders', async (_, deviceId, regId, path) => {
    const device = devices.get(deviceId)
    if (device && device.secureServerAddress) {
      const url = device.secureServerAddress
      const token = await oauth2Client.getAccessToken()
      const req = https.request(`${url}folders${path}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.token}`,
        },
        rejectUnauthorized: false,
        insecureHTTPParser: true,
      })
      req.end()
      return new Promise<FolderInfo>((res, rej) => {
        req.on('response', (resp) => {
          resp.setEncoding('utf8')
          const body: string[] = []
          resp.on('data', (data) => {
            body.push(data)
          })
          resp.on('end', () => {
            const data = body.join('')
            const parsedData = JSON.parse(data) as FoldersResponse
            if (!parsedData.success) return rej(parsedData.errorMessage)

            const foldersInfo = parsedData.payload
            res(foldersInfo)
          })
        })
        req.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED')
            delete device.secureServerAddress
          // NOTE: don't request folders remotely if local fails because it may
          // return so many items that the service will only be receiving
          // folder related pushes for a while
          // TODO: disable remote folders on frontend unless on local network? give some kind of warning?
          rej(err)
        })
      })
    } else {
      await fcm.projects.messages.send({
        auth: jwtClient,
        parent: 'projects/join-external-gcm',
        requestBody: {
          message: {
            token: regId,
            android: {
              priority: 'high',
            },
            data: {
              type: 'GCMFolderRequest',
              json: JSON.stringify({
                type: 'GCMFolderRequest',
                path,
                senderId: thisDeviceId,
              }),
            },
          },
        },
      })

      return await new Promise((res, rej) => {
        const request = folderRequests.get(path)
        if (request) request(null)

        folderRequests.set(path, (folderInfo) => {
          res(folderInfo)
        })
        setTimeout(
          () => {
            folderRequests.delete(path)
            rej(new Error('Folder request timed out'))
          },
          2 * 60 * 1000,
        )
      })
    }
  })
  m.handle('media-action', async (_, deviceId, regId2, action) => {
    const device = devices.get(deviceId)
    const data = {
      type: 'GCMPush',
      json: JSON.stringify({
        type: 'GCMPush',
        push: {
          ...action,
          id: uuidv4(),
          senderId: thisDeviceId,
        },
        senderId: thisDeviceId,
      }),
    }
    if (device && device.secureServerAddress) {
      const url = device.secureServerAddress
      const body = JSON.stringify(data)
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
      return new Promise<void>((res, rej) => {
        req.on('response', (resp) => {
          resp.setEncoding('utf8')
          const body: string[] = []
          resp.on('data', (data) => {
            body.push(data)
          })
          resp.on('end', () => {
            const data = body.join('')
            const parsedData = JSON.parse(data) as GenericResponse
            if (!parsedData.success) return rej(parsedData.errorMessage)

            res()
          })
        })
        req.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code !== 'ECONNRESET' && err.code !== 'ECONNREFUSED') return rej(err)
          delete device.secureServerAddress
          mediaActionNonLocal(regId2, data)
        })
      })
    } else {
      mediaActionNonLocal(regId2, data)
    }
  })
  m.handle('contacts', async (_, deviceId, regId) => {
    const device = devices.get(deviceId)
    if (device && device.secureServerAddress) {
      const url = device.secureServerAddress
      const token = await oauth2Client.getAccessToken()
      const req = https.request(`${url}contacts`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.token}`,
        },
        rejectUnauthorized: false,
        insecureHTTPParser: true,
      })
      req.end()
      return new Promise<ContactInfo[]>((res, rej) => {
        req.on('response', (resp) => {
          resp.setEncoding('utf8')
          const body: string[] = []
          resp.on('data', (data) => {
            body.push(data)
          })
          resp.on('end', () => {
            const data = body.join('')
            const parsedData = JSON.parse(data) as GenericResponse
            if (!parsedData.success) return rej(parsedData.errorMessage)

            const contactsInfo = parsedData.payload as ContactInfo[]
            res(contactsInfo)
          })
        })
        req.on('error', (err) => {
          rej(err)
        })
      })
    } else {
      // when the contacts file doesn't exists yet, we need to send a message to the device to create it
      // TODO: the file won't be updated unless requested to. Add button to do so? Or do it always like on sms chats?
      try {
        const contactsInfo = await getContactsNonLocal(deviceId)
        return contactsInfo
      } catch (e) {
        await requestContactsAndLastSmSCreation(deviceId, regId)

        return await new Promise((res, rej) => {
          const request = contactRequests.get(deviceId)
          if (request) request(null)

          contactRequests.set(deviceId, (contactInfo) => {
            res(contactInfo)
          })
          setTimeout(
            () => {
              contactRequests.delete(deviceId)
              rej(new Error('Contact request timed out'))
            },
            2 * 60 * 1000,
          )
        })
      }
    }
  })
  m.handle('sms', async (_, deviceId, regId) => {
    const device = devices.get(deviceId)
    if (device && device.secureServerAddress) {
      const url = device.secureServerAddress
      const token = await oauth2Client.getAccessToken()
      const req = https.request(`${url}sms`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.token}`,
        },
        rejectUnauthorized: false,
        insecureHTTPParser: true,
      })
      req.end()
      return new Promise<SmsInfo[]>((res, rej) => {
        req.on('response', (resp) => {
          resp.setEncoding('utf8')
          const body: string[] = []
          resp.on('data', (data) => {
            body.push(data)
          })
          resp.on('end', () => {
            const data = body.join('')
            const parsedData = JSON.parse(data) as SmsResponse
            if (!parsedData.success) return rej(parsedData.errorMessage)

            const smsInfo = parsedData.payload
            res(smsInfo)
          })
        })
        req.on('error', (err) => {
          rej(err)
        })
      })
    } else {
      // when the lastsms file doesn't exists yet, we need to send a message to the device to create it
      // TODO: the file won't be updated unless requested to. Add button to do so? Or do it always like on sms chats?
      try {
        const smsThreadsInfo = await getSmsThreadsNonLocal(deviceId)
        return smsThreadsInfo
      } catch (e) {
        await requestContactsAndLastSmSCreation(deviceId, regId)

        return await new Promise((res, rej) => {
          const request = smsThreadRequests.get(deviceId)
          if (request) request(null)

          smsThreadRequests.set(deviceId, (smsThreadInfo) => {
            res(smsThreadInfo)
          })
          setTimeout(
            () => {
              smsThreadRequests.delete(deviceId)
              rej(new Error('SmsThread request timed out'))
            },
            2 * 60 * 1000,
          )
        })
      }
    }
  })
  m.handle('sms-chat', async (_, deviceId: string, regId2: string, address: string) => {
    const device = devices.get(deviceId)
    if (device && device.secureServerAddress) {
      const url = device.secureServerAddress
      const token = await oauth2Client.getAccessToken()
      const req = https.request(`${url}sms?address=${encodeURIComponent(address)}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.token}`,
        },
        rejectUnauthorized: false,
        insecureHTTPParser: true,
      })
      req.end()
      return new Promise<SmsInfo[]>((res, rej) => {
        req.on('response', (resp) => {
          resp.setEncoding('utf8')
          const body: string[] = []
          resp.on('data', (data) => {
            body.push(data)
          })
          resp.on('end', () => {
            const data = body.join('')
            const parsedData = JSON.parse(data) as SmsResponse
            if (!parsedData.success) return rej(parsedData.errorMessage)

            const smsInfo = parsedData.payload
            res(smsInfo)
          })
        })
        req.on('error', (err) => {
          rej(err)
        })
      })
    } else {
      // NOTE: there is no way of knowing if the conversation file on Google
      // Drive is updated or not and the Join app doesn't seem to update it
      // unless it's request to do so. So, we always ask it to update the file
      // before using it
      await requestSmsChatCreationOrUpdate(deviceId, regId2, address)

      return await new Promise((res, rej) => {
        const request = smsChatRequests.get(deviceId)
        if (request) request(null)

        smsChatRequests.set(deviceId, (smsChatInfo) => {
          res(smsChatInfo)
        })
        setTimeout(
          () => {
            smsChatRequests.delete(deviceId)
            rej(new Error('SmsChat request timed out'))
          },
          2 * 60 * 1000,
        )
      })
    }
  })

  createWindow(tray)
  const popupWin = createPopup()
  globalShortcut.register('Super+I', async () => {
    const device = await selectDevice(popupWin)
    setClipboard(device.deviceId, device.regId2, 'hey')
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow(tray)
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

const allowedCertificate = `-----BEGIN CERTIFICATE-----
MIICqDCCAZCgAwIBAgIIEUtpg+YQm5MwDQYJKoZIhvcNAQELBQAwEzERMA8GA1UE
AwwIbXlzZXJ2ZXIwIBcNMTkwNjAyMTEyNTE2WhgPOTk5OTEyMzEyMzU5NTlaMBMx
ETAPBgNVBAMMCG15c2VydmVyMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC
AQEAtjZatdrTDq4DyYpPhy4MhTB26OyiSeIpAvOK+5zA7fG7o6mLsD56LyAIDeWP
HnW3/a9YuntELGpjt99HUFSH9Bs8nTAZuI+k6eYnAapGZau0M+No/78BQhE2O0Kl
t9UUzaImKYEOl1VuRNMj4MMfGgUEo21LGmMFRD3SxpEhQ5GS8Gk+yKUsyqqTENBK
J7cqkw76IIgSa3u5E9/YLk/HCIpLVeN8nU5XGoIw3YhAUQQz62+D2NqKylmmWS6N
pHZ66Bfp2pCltJx+wMS2KSOFcMCfUVIcTcwvAU5VicX5BdJZ04d6CW9dLHGqY0Bi
uc4Derg1UB7penScdgXclvVN5QIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQBSkGo0
lgEqfVEtAb2IzidUurZZrTlP/bCR+UGOiQtO9J6wW+xU/sOvMXLpagAOAvg3a1Rl
dkdKONd53gzd028n4qcFe7lV0VyOV4iJ9e3ldNj3//sv1M/8Fn1sz8+3ZtWRbA6c
lqIxyNjA4HqLFgzTqey9rrIX5LEPLBDtIgKlkFruAvmCnW3mMi1lP4cSHDpVKLZI
vagajVA2QTXFjzAtV02L5fbfeMrDFydA1LBTCIY6358aaAyGULQMj9ZqiiLFOyfp
A2Hz/E5sLFU810D/F86EtJWa2hadF7VPrfQ5sCZ2WeMwtKG2Z6ghCXDCWxS09gxb
cy+aLqr1fhkBl/9o
-----END CERTIFICATE-----
`
app.on('certificate-error', (event, webContents, url, error, certificate, cb) => {
  cb(certificate.data === allowedCertificate)
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
