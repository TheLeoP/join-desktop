import { google } from 'googleapis'
import { promises as afs } from 'node:fs'
import * as http from 'node:http'
import { state } from './state'
import { BrowserWindow, shell } from 'electron'
import { joinUrl, mediaRequests, responseFileTypes, tokenFile } from './consts'
import type { ContactInfo, SmsInfo, Push, DeviceInfo, Data, MediaInfo } from '../preload/types'
import { error } from './utils'

const joinAppId = '596310809542-giumrib7hohfiftljqmj7eaio3kl21ek.apps.googleusercontent.com'
const joinAppSecret = 'NTA9UbFpNhaIP74B_lpxGgvR'
const joinRedirectUri = 'http://127.0.0.1:9876'
export const oauth2Client = new google.auth.OAuth2(joinAppId, joinAppSecret, joinRedirectUri)
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
export const jwtClient = new google.auth.JWT({
  email,
  key: jwtSecret,
  scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
})
export const fcm = google.fcm('v1')
export const drive = google.drive('v3')
export const oauth2 = google.oauth2('v2')

const dirMime = 'application/vnd.google-apps.folder'

export async function dirNonLocal(name: string, parents?: string[]) {
  const query = `name = '${name}' and trashed = false and mimeType = '${dirMime}'${parents ? ` ${parents.map((parent) => `and '${parent}' in parents`).join(' ')}` : ''}`
  const dir = await drive.files.list({
    q: query,
  })
  const dirFiles = dir.data.files
  if (!dirFiles) throw new Error(`No directories with the name ${name}`)

  let dirInfo = dirFiles[0]
  if (!dirInfo) {
    const deviceDirCreate = await drive.files.create({
      requestBody: {
        name,
        mimeType: dirMime,
        ...(parents ? { parents } : {}),
      },
      fields: 'id',
    })
    dirInfo = deviceDirCreate.data
  }

  if (!dirInfo) throw new Error(`No directories with the name ${name}`)
  if (!dirInfo.id) throw new Error(`${name} directory does not have an id on Google Drive`)
  return dirInfo.id
}

export async function joinDirNonLocal() {
  return await dirNonLocal('Join files')
}

export async function deviceDirNonLocal(deviceId: string, joinDirId: string) {
  const devicesInfo = await getCachedDevicesInfo()

  const deviceName = devicesInfo.find((device) => device.deviceId === deviceId)?.deviceName
  if (!deviceName) throw new Error(`There is no device with id ${deviceId} in cache`)

  return await dirNonLocal(`from ${deviceName}`, [joinDirId])
}

// TODO: Should I  handle the errors from this functions outside it?
export async function getContactsNonLocal(deviceId: string) {
  const contactsFileName = `contacts=:=${deviceId}`
  const response = await drive.files.list({
    q: `name = '${contactsFileName}' and trashed = false`,
  })
  const files = response.data.files
  if (!files) throw new Error(`\`files\` is undefined for the name ${contactsFileName}`)

  const fileInfo = files[0]
  if (!fileInfo) throw new Error(`\`files\` is undefined for the name ${contactsFileName}`)
  if (!fileInfo.id)
    throw new Error(`Contacts file for deviceId ${deviceId} has no defined id on Google Drive`)

  const file = (
    await drive.files.get({
      alt: 'media',
      fileId: fileInfo.id,
    })
  ).data

  // @ts-ignore: The google api has the incorrect type when using `alt: 'media'`
  const text = file.text ? await file.text() : file
  const contactsInfo = JSON.parse(text).contacts as ContactInfo[]
  return contactsInfo
}

export async function getSmsNonLocal(deviceId: string) {
  const smssFileName = `lastsms=:=${deviceId}`
  const response = await drive.files.list({
    q: `name = '${smssFileName}' and trashed = false`,
  })
  const files = response.data.files
  if (!files) throw new Error(`\`files\` is undefined for the name ${smssFileName}`)

  const fileInfo = files[0]
  if (!fileInfo) throw new Error(`\`files\` is undefined for the name ${smssFileName}`)
  if (!fileInfo.id)
    throw new Error(`Smss file for deviceId ${deviceId} has no defined id on Google Drive`)

  const file = (
    await drive.files.get({
      alt: 'media',
      fileId: fileInfo.id,
    })
  ).data

  // @ts-ignore: The google api has the incorrect type when using `alt: 'media'`
  const text = file.text ? await file.text() : file
  const smssThreadInfo = JSON.parse(text) as SmsInfo[]
  return smssThreadInfo
}

export async function getSmsChatsNonLocal(deviceId: string, address: string) {
  const smsFileName = `sms=:=${deviceId}=:=${address}`
  const smsFiles = await drive.files.list({
    q: `name = '${smsFileName}' and trashed = false`,
  })
  const files = smsFiles.data.files
  if (!files) throw new Error(`\`files\` is undefined for the name ${smsFileName}`)

  const smsFile = files[0]
  if (!smsFile) throw new Error(`\`files\` is undefined for the name ${smsFileName}`)
  if (!smsFile.id)
    throw new Error(`Smss file for deviceId ${deviceId} has no defined id on Google Drive`)

  const smsFileContent = (
    await drive.files.get({
      alt: 'media',
      fileId: smsFile.id,
    })
  ).data

  // @ts-ignore: The google api has the incorrect type when using `alt: 'media'`
  const text = smsFileContent.text ? await smsFileContent.text() : smsFileContent
  const smssChats = JSON.parse(text) as { number: string; smses: SmsInfo[] }
  return smssChats.smses
}

export async function getPushHistoryNonLocal(deviceId: string) {
  const pushesFileName = `pushes=:=${deviceId}`
  const pushesFiles = await drive.files.list({
    q: `name = '${pushesFileName}' and trashed = false`,
  })
  const files = pushesFiles.data.files
  if (!files) throw new Error(`\`files\` is undefined for the name ${pushesFileName}`)

  const pushesFile = files[0]
  if (!pushesFile) throw new Error(`\`files\` is undefined for the name ${pushesFileName}`)
  if (!pushesFile.id)
    throw new Error(`Smss file for deviceId ${deviceId} has no defined id on Google Drive`)

  const pushesFileContent = (
    await drive.files.get({
      alt: 'media',
      fileId: pushesFile.id,
    })
  ).data

  // @ts-ignore: The google api has the incorrect type when using `alt: 'media'`
  const text = pushesFileContent.text ? await pushesFileContent.text() : pushesFileContent
  const pushHistory = JSON.parse(text) as {
    apiLevel: number
    deviceId: string
    deviceType: number
    pushes: Push[]
  }
  return pushHistory.pushes
}

export async function getMediaInfoNonLocal(deviceId: string, regId2: string) {
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
              requestType: responseFileTypes.media_infos,
              senderId: state.thisDeviceId,
              deviceIds: [deviceId],
            },
            senderId: state.thisDeviceId,
          }),
        },
      },
    },
  })

  return await new Promise<MediaInfo>((res, rej) => {
    const mediaRequest = mediaRequests.get(deviceId)
    if (mediaRequest) mediaRequest(null)

    mediaRequests.set(deviceId, (mediaInfo) => {
      if (mediaInfo === null) return rej(new Error('A new MediaInfo request was created'))

      res(mediaInfo)
    })
    setTimeout(() => {
      mediaRequests.delete(deviceId)
      rej(new Error('Media request timed out'))
    }, 30 * 1000)
  })
}

export async function mediaActionNonLocal(regId2: string, data: Record<string, string>) {
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

export async function logInWithGoogle(win: BrowserWindow) {
  if (Object.keys(oauth2Client.credentials).length !== 0) return win.webContents.send('on-log-in')

  const scopes = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.file',
  ]
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  })

  const code = await new Promise<string | null>((res, _rej) => {
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

let cachedDevicesInfo: DeviceInfo[]
export async function getDevicesInfo() {
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
  if (!parsedRes.success && parsedRes.errorMessage) {
    error(parsedRes.errorMessage, state.win)
    return cachedDevicesInfo
  }

  const devicesInfo = parsedRes.records
  cachedDevicesInfo = devicesInfo
  return devicesInfo
}

export async function getCachedDevicesInfo() {
  if (cachedDevicesInfo) return cachedDevicesInfo

  return await getDevicesInfo()
}
