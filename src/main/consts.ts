import { app } from 'electron'
import type { MediaInfo, FolderInfo, FileInfo, ContactInfo, SmsInfo } from '../preload/types'

export const joinUrl = 'https://joinjoaomgcd.appspot.com/_ah/api'

export const dataDir = app.getPath('userData')
export const credentialsFile = `${dataDir}/credentials.json`
export const persistentIdsFile = `${dataDir}/persistentIds.json`
export const tokenFile = `${dataDir}/token.json`
export const devicesFile = `${dataDir}/devices.json`
export const deviceIdFile = `${dataDir}/deviceId`
export const shortcutsFile = `${dataDir}/shortcuts.json`
export const settingsFile = `${dataDir}/settings.json`
export const scriptsDir = `${dataDir}/scripts`

export const devicesTypes = {
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

export const responseType = {
  push: 0,
  file: 1,
} as const

export const responseFileTypes = {
  screenshot: 1,
  video: 2,
  sms_threads: 3,
  sms_conversation: 4,
  notifications: 5,
  // NOTE: there doesn't seem to be a type for 6 (?
  media_infos: 7,
} as const

export const mediaRequests = new Map<string, (mediaInfo: MediaInfo | null) => void>()
export const folderRequests = new Map<string, (folderInfo: FolderInfo | null) => void>()
export const fileRequests = new Map<string, (folderInfo: FileInfo | null) => void>()
export const contactRequests = new Map<string, (contactInfo: ContactInfo[] | null) => void>()
export const smsRequests = new Map<string, (smsInfo: SmsInfo[] | null) => void>()
export const smsChatRequests = new Map<string, (smsChatInfo: SmsInfo[] | null) => void>()

export const joinCertificate = `-----BEGIN CERTIFICATE-----
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

export const ownCertificate = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUFCWNSTUhoYVBoN0Mvreh4pGpkCIwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI1MDQxOTE5MzQwMloXDTI1MDUx
OTE5MzQwMlowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAhnuYjSbVIomMYt3/KKZv4IswvfT/E+jZO4FfGRWfZLk7
3Htz7raCQwOPwz6Avfg2NHx//ntX/+/F9C0MFytA35jiebU/u3lAxTqdoAg6zyCp
UgJvASvwQ/Uuq8fT8sde424LiOzBnTtKFYTLaTBqwkuYOWaInqeKTe0BjWhtN1Ap
IDewmccxHP7vPd8U5l4t7i9LucxoJRmeWq9+oHmbLmZK7Abyf8/ueMS9bNw8RJj0
MS1K3jtv+abdWk0jY8vb4w8+ZfDENhozRTL3qc24XcLRuf3xD1aU2cNY0kFIRIwW
oVpsFe5B6sUn4U72LwbaEp6cKtc1fwglEMxlZrcGMwIDAQABo1MwUTAdBgNVHQ4E
FgQU+7rKzbrlmN/KfDS5Zw3xpULJbNMwHwYDVR0jBBgwFoAU+7rKzbrlmN/KfDS5
Zw3xpULJbNMwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAGDZ0
yOLQEdlKZT+wQ7qaDi0u/N9/ir/7BF+OjQgkU/qudKEMPR9OniUcFMKhQCwcU3/f
2DWxkJnVPS+wdn+N1F3J/DKiZ6wy2QVEQL8PWgaPMrfeMbt1Ygt5Y81WKkU1C0CG
7pHWbZZ/UOYW7s5xsbubHL4d19he5OT42ICzfc7NEsK1fp7po6giMY6/xbkkkAUu
bb66jlpyppnZvZLNPTcW63w9KLIJ3s3iozdfnK1HPLylfiR8BClmZlemlrkw7MQk
VH4qDu6cnLr+kbpU3UXOXfzaaYtSS2Ato+kbtBylPr4E/UwEiHIJaDRkzIaTjiQb
ut3hJCBnf1l8Xwj/gw==
-----END CERTIFICATE-----`
export const ownPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCGe5iNJtUiiYxi
3f8opm/gizC99P8T6Nk7gV8ZFZ9kuTvce3PutoJDA4/DPoC9+DY0fH/+e1f/78X0
LQwXK0DfmOJ5tT+7eUDFOp2gCDrPIKlSAm8BK/BD9S6rx9Pyx17jbguI7MGdO0oV
hMtpMGrCS5g5Zoiep4pN7QGNaG03UCkgN7CZxzEc/u893xTmXi3uL0u5zGglGZ5a
r36geZsuZkrsBvJ/z+54xL1s3DxEmPQxLUreO2/5pt1aTSNjy9vjDz5l8MQ2GjNF
MvepzbhdwtG5/fEPVpTZw1jSQUhEjBahWmwV7kHqxSfhTvYvBtoSnpwq1zV/CCUQ
zGVmtwYzAgMBAAECggEAFS2EhgHuAXzYsz8TbgLbzmgM+nUI8Ek0YGcMo0Yg7jsv
XpbAWIC8PbJjYtNGceQTISvT+i7RWlgXe87WPxXMJwoL7C+rRCohlY2YAfoZzMFv
eJ8yfOQ+92y2d03GJk7YNgd/4IWsLccG8SGS6NM7lLJT3AI2FIn8wS3IF00xGcsW
5CZP1n54Yk+pyK4ryjnMH6Q+6yv2zi+vFZGCfNgJdjT9SqWisUgoMSxFpni7hjVA
ZYboEbzKN/ITtbprv2zoQw50v4fHxNUjXRU8DAXgWCUDtwSOSxKnACjcYs/+TtNW
r1gt6AcEThzb9O8XzCjqIn89t+1lXEexRiY+h0dQwQKBgQC802sjWeEDBGdybfSw
PmidQBU2NJ4anOHITxctLoh9K7ktKzF7IIFxVPiByoQ0DBIAXLjvn7hkw09W+bum
oIGm23uNQxm1A3QJT5shOB27/2m+73aEwHy6+ax1iAmZhqAg7Zk6Zq97n8G9am8V
2X/t/3A0CP4g/CAL6+YiuwkOwQKBgQC2UxguuPojgn7alDYJadhpHhyzEjzG8ueY
/nIt11TpncIgR6z2tfdy3/HRILpvA6LUp892efxBKEUnJ9ky/yDKYaNyrWzGYUW6
xyGDvOK9eZZbjkiI4VNrJobRvG9kQcgN5RhdcqYEY52m0e60Nk3/8igQUX7bcW4h
dS4tmSRF8wKBgH2qtsLwLjAz3iTpyM8CudztqTBKFG7hueH1wRbwwSWM09CbznKD
T6J9SmYWwaVh4xkanHndcnqdAVCBI8HhUGgb6j45SgKOKcuIj1WsYx2a/mV0OQxg
jqJhR8Vwo/LpBejkN/YGIQPFbssA6q0/80QRnDsFQRvyr+E/PgofMAgBAoGAecvg
p7WiQ/50x4ei4X73tqELAwT33N9/n1C67ayfaMCeYfn/rX+5od/AJrf6UxbWu8Cu
crLitJQ2PgX8rniIayn2ijEYLR3l+vPzi5Gu1mxW6SqPggEkPLwr7Ag5UXwwLDgS
orpn9R6mvj4XfAOa75PQ97W5TNblfyxMgOGAvckCgYBy7paNXYLs336YbUnMDKjd
P5/IZ7AzYJDyohlDqaBK/dWVh2GkzHdDSHxPLxCE3wfQhvBuWw2gj9lZa7D13QPb
U7ez5s6I/FhDi+Fmn/7NMHHrCPUJYcH+icKHNNffW9lq6J01QOk6ut9uIYubgVxv
lQP0yPLNeHqObxDmNGeRqA==
-----END PRIVATE KEY-----`
