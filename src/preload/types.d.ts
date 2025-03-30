export type MediaAction = {
  play?: boolean
  pause?: boolean
  back?: boolean
  next?: boolean
  mediaAppPackage?: string
  mediaVolume?: string
}

export type Data<T> = {
  success: boolean
  userAuthError: boolean
  records: T[]
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
type DeviceTypes = typeof devicesTypes

export type DeviceInfo = {
  id: string
  regId: string
  regId2: string
  userAccount: string
  deviceId: string
  deviceName: string
  deviceType: DeviceTypes[keyof DeviceTypes]
  apiLevel: number // TODO: enum?
  hasTasker: boolean
}

export type MediaAction = {
  play?: boolean
  pause?: boolean
  back?: boolean
  next?: boolean
  mediaAppPackage?: string
  mediaVolume?: string
}

export type MediaInfo = {
  extraInfo: {
    maxMediaVolume: number
    mediaVolume: number
  }
  mediaInfosForClients: {
    appIcon: string
    appName: string
    artist: string
    date: number
    packageName: string
    playing: boolean
    track: string

    art?: string
    album?: string
  }[]
}

export type ContactInfo = {
  name: string
  number: string
  photo: string
}

export type SmsInfo = {
  address: string
  date: number
  isMMS: boolean
  received: boolean
  text: string
  id: string // it's a number on a string
}

export type File = {
  date: number
  isFolder: boolean
  name: string
  size: number //bytes
}

export type FolderInfo = {
  files: File[]
  pathSegments: string[]
}

export type JoinData = {
  json: string
  type:
    | 'GCMPush'
    | 'GCMNotificationClear'
    | 'GCMLocalNetworkRequest'
    | 'GCMLocalNetworkTestRequest' // TODO: do I need to handle this?
    | 'GCMDeviceNotOnLocalNetwork'
    | 'GCMStatus'
    | 'GCMRespondFile'
    | 'GCMFolder'
    | 'GCMFile'
    | ''
}

type Push = {
  push: {
    language?: string
    say?: string
    title?: string
    url?: string
    areLocalFiles: boolean
    back: boolean
    clipboard?: string
    clipboardget?: boolean
    commandLine: boolean
    date: number
    deviceId: string
    files?: string[]
    find: boolean
    fromTasker: boolean
    id?: string
    localFilesChecked: boolean
    location: boolean
    next: boolean
    pause: boolean
    play: boolean
    playpause: boolean
    senderId: string
    text: string
    toTasker: boolean
  }
}

export type NotificationClear = {
  requestNotification: {
    deviceIds: string[]
    requestId: string[]
    senderId: string[]
    notificationId: string | undefined
  }
}

export type LocalNetworkRequest = {
  secureServerAddress: string | undefined // https Includes trailling `/`
  senderId: string
  serverAddress: string | undefined // http Includes trailling `/`
  webSocketServerAddress: string | undefined // Includes trailling `/`
}

export type DeviceNotOnLocalNetworkRequest = {
  senderId: string
}

export type DeviceStatus = {
  alarmVolume: number
  batteryPercentage: number
  canChangeInterruptionFilter: boolean
  charging: boolean
  internalStorageAvailable: number
  internalStorageTotal: number
  interruptionFilter: number
  maxAlarmVolume: number
  maxMediaVolume: number
  maxRingVolume: number
  mediaVolume: number
  ringVolume: number
}
export type Status = {
  deviceId: string
  request: boolean
  status: DeviceStatus
}

const respondFileTypes = {
  screenshot: 1,
  video: 2,
  sms_threads: 3,
  sms_conversation: 4,
  notifications: 5,
  // NOTE: there doesn't seem to be a type for 6 (?
  media_infos: 7,
} as const
export type RespondFileTypes = typeof respondFileTypes

export type RespondFile = {
  responseFile: {
    description: string
    downloadUrl: string
    fileId: string
    request: {
      deviceIds: string[]
      requestType: RespondFileTypes[keyof RespondFileTypes]
      senderId: string
      requestId: string
      payload?: string
    }
    senderId: string
    viewUrl: string
    success: boolean
    userAuthError: boolean
  }
}

export type MediaInfo = {
  extraInfo: {
    maxMediaVolume: number
    mediaVolume: number
  }
  mediaInfosForClients: {
    appIcon: string
    appName: string
    artist: string
    date: number
    packageName: string
    playing: boolean
    track: string

    art?: string
    album?: string
  }[]
}

export type GenericResponse = {
  success: boolean
  userAuthError: boolean
  errorMessage?: string
  payload?: unknown
}

export type FolderInfo = {
  files: File[]
  pathSegments: string[]
}
export type FoldersResponse = {
  payload: FolderInfo
} & GenericResponse

export type File = {
  date: number
  isFolder: boolean
  name: string
  size: number // bytes
}

export type FileInfo = {
  fileName: string
  url: string
}

export type ContactInfo = {
  name: string
  number: string
  photo: string
}

export type SmsInfo = {
  address: string
  date: number
  isMMS: boolean
  received: boolean
  text: string
  id: string // it's a number on a string
}

export type SmsResponse = {
  payload: SmsInfo[]
} & GenericResponse
