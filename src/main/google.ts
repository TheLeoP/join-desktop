import { google } from 'googleapis'
import { getCachedDevicesInfo } from './state'

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
