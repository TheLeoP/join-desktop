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
