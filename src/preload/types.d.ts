export type MediaAction = {
  play?: boolean
  pause?: boolean
  back?: boolean
  next?: boolean
  mediaAppPackage?: string
  mediaVolume?: string
}

export type Data<T> = {
  records: T[]
} & GenericResponse

const _devicesTypes = {
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
export type DeviceTypes = typeof _devicesTypes

export type DeviceInfo = {
  id: string
  regId: string
  regId2: string
  userAccount: string
  deviceId: string
  deviceName: string
  deviceType: DeviceTypes[keyof DeviceTypes]
  apiLevel: number
  hasTasker: boolean
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

export type PushType =
  | 'GCMPush'
  | 'GCMNotification'
  | 'GCMNotificationClear'
  | 'GCMLocalNetworkRequest'
  | 'GCMLocalNetworkTestRequest'
  | 'GCMDeviceNotOnLocalNetwork'
  | 'GCMStatus'
  | 'GCMRespondFile'
  | 'GCMFolder'
  | 'GCMFile'
  | 'GCMLocation'
  | 'GCMRequestFile'
  | 'GCMSmsSentResult'
  | 'GCMDeviceRegistered'
  | 'GCMNewSmsReceived'

export type JoinData = {
  json: string
  type: PushType
}

export type Push = {
  language?: string
  say?: string
  title?: string
  url?: string
  areLocalFiles?: boolean
  back?: boolean
  clipboard?: string
  clipboardget?: boolean
  commandLine?: boolean
  date?: number
  deviceId?: string
  files?: string[]
  find?: boolean
  fromTasker?: boolean
  id?: string
  localFilesChecked?: boolean
  location?: boolean
  next?: boolean
  pause?: boolean
  play?: boolean
  playpause?: boolean
  senderId?: string
  text?: string
  toTasker?: boolean
  callnumber?: string
  responseType?: ResponseType[keyof ResponseType]
  smsnumber?: string
  smstext?: string
  requestId?: 'SMS' | 'batteryevent' | string
  values?: string
  valuesArray?: string[]

  commandName?: string
  commandResponse?: string
  dismissOnTouch?: boolean
}
export type PushWrapper = {
  push: Push
}

const _respondFileType = {
  screenshot: 1,
  video: 2,
  sms_threads: 3,
  sms_conversation: 4,
  notifications: 5,
  // NOTE: there doesn't seem to be a type for 6 (?
  media_infos: 7,
} as const
const _responseType = {
  push: 0,
  file: 1,
} as const

export type ResponseFileType = typeof _respondFileType
export type ResponseType = typeof _responseType

export type NotificationClear = {
  requestNotification: {
    group: string
    deviceIds: string[]
    requestId: string
    senderId: string
  }
}

export type LocalNetworkRequest = {
  secureServerAddress: string | undefined // https Includes trailling `/`
  senderId: string
  serverAddress: string | undefined // http Includes trailling `/`
  webSocketServerAddress: string | undefined // Includes trailling `/`
}

export type SmsSentResult = {
  forTasker: boolean
  requestId: 'SMS'
  success: boolean
}

export type DeviceRegistered = {
  device: DeviceInfo
  deleted: boolean
}

export type NewSmsReceived = {
  date: number
  name: string
  number: string
  photo: string
  senderId: string
  text: string
  urgent: boolean
}

export type LocalNetworkTestRequest = {
  senderId: string
  // TODO: add this to other similar types for completion's sake?
  type: string
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

export type RespondFile = {
  responseFile: {
    description: string
    downloadUrl: string
    fileId: string
    request: {
      deviceIds: string[]
      requestType: ResponseFileType[keyof ResponseFileType]
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

export type LocationInfo = {
  accuracy: number
  forTasker: boolean
  latitude: number
  longitude: number
}

export type JoinNotificationWrapper = {
  requestNotification: JoinNotification
}
export type JoinNotification = {
  authToken: string
  notifications: [
    {
      actionId?: string
      color?: string
      group?: string
      lines?: string
      // TODO: is this specific to a certain notification type?
      messages?: {
        sender: string
        text: string
      }[]

      appIcon: string
      statusBarIcon?: string
      appName: string
      appPackage: string
      buttons: { actionId: string; icon: string; text: string }[]

      date: number
      id: string
      priority: number
      sound: boolean
      text: string
      title: string
      vibration: number[]

      image?: string
    },
  ]
  deviceIds: string[]
  senderId: string
}

export type Settings = {
  autostart: boolean
  showOnStart: boolean
  safeKeys: string
  scripts: Map<string, string>
}
