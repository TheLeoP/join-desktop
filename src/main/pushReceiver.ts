import { PushReceiver } from '@eneris/push-receiver'
import * as fs from 'node:fs'
import { promises as afs } from 'node:fs'
import { MessageEnvelope } from '@eneris/push-receiver/dist/types'
import { BrowserWindow, clipboard, shell, Notification } from 'electron'
import type {
  JoinData,
  PushWrapper,
  NotificationClear,
  LocalNetworkRequest,
  DeviceNotOnLocalNetworkRequest,
  Status,
  RespondFile,
  MediaInfo,
  FolderInfo,
  FileInfo,
  LocationInfo,
  LocalNetworkTestRequest,
  DeviceRegistered,
} from '../preload/types'
import {
  scriptsDir,
  devicesFile,
  responseFileTypes,
  mediaRequests,
  contactRequests,
  smsRequests,
  smsChatRequests,
  folderRequests,
  fileRequests,
  persistentIdsFile,
  credentialsFile,
} from './consts'
import {
  drive,
  getContactsNonLocal,
  getSmsNonLocal,
  getSmsChatsNonLocal,
  getCachedDevicesInfo,
  getDevicesInfo,
} from './google'
import { notificationImage, batteryOkImage, batteryLowImage } from './images'
import { state } from './state'
import { mapReplacer } from './utils'
import { requestLocalNetworkTest, setClipboard, testLocalAddress } from './popup'

const notifications = new Map<string, Notification>()

const multiNotifications = new Map<string, string[]>()
let lastBatteryNotification: Notification | undefined
export async function handleGcm(data: JoinData, win: BrowserWindow) {
  let content: unknown
  try {
    content = JSON.parse(data.json)
  } catch (e) {
    // TODO: some kind of error message
    return
  }

  let n: Notification | undefined
  switch (data.type) {
    case 'GCMPush': {
      const push = (content as PushWrapper).push

      if (push.clipboard && push.clipboard !== 'Clipboard not set') {
        clipboard.writeText(push.clipboard)
        n = new Notification({
          title: 'Clipboard set',
          icon: notificationImage,
        })
      } else if (push.clipboard && push.clipboard === 'Clipboard not set') {
        const devicesInfo = await getCachedDevicesInfo()
        const deviceName = devicesInfo.find(
          (device) => device.deviceId === push.senderId,
        )?.deviceName
        n = new Notification({
          title: `${deviceName}'s clipboard is empty`,
          icon: notificationImage,
        })
      } else if (push.clipboardget) {
        n = new Notification({
          title: 'Clipboard requested',
          body: push.url,
          icon: notificationImage,
        })

        const devicesInfo = await getCachedDevicesInfo()

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
        n = new Notification({
          title: 'Received files',
          body: 'Openning now...',
          icon: notificationImage,
        })
        push.files
          .filter((file) => file.startsWith('https://'))
          .forEach((file) => {
            const url = new URL(file)
            const path = url.pathname
            const parts = path.split('/')
            const host = url.hostname

            if (host === 'drive.google.com') {
              // https://drive.google.com/file/d/1ts8nAlpuX6CCiB7tkv8PzjnEDd1banM5/view?usp=sharing
              const id = parts[3]
              shell.openExternal(`https://drive.google.com/uc?export=download&id=${id}`)
            } else if (host === 'www.googleapis.com') {
              // https://www.googleapis.com/drive/v2/files/1ts8nAlpuX6CCiB7tkv8PzjnEDd1banM5?alt=media
              const id = parts[4]
              shell.openExternal(`https://drive.google.com/uc?export=download&id=${id}`)
            } else {
              shell.openExternal(file)
            }
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
        n = new Notification({
          title: push.title,
          body: push.text,
          icon: notificationImage,
        })
      } else if (push.text && push.text !== undefined && push.values !== undefined) {
        const key = state.settings.scripts
          .keys()
          .find((command) => new RegExp(command).test(push.text as string))

        let ok = false
        if (key) {
          const scriptName = state.settings.scripts.get(key)
          try {
            const module = await import(scriptsDir + '/' + scriptName)
            const script = module.default as (values: string, valuesArray: string[]) => void
            script(push.values, push.valuesArray as string[])
            ok = true
          } catch (e) {}
        }
        n = new Notification({
          title: `Command received: ${push.text}`,
          body: ok ? 'Script executed correctly' : 'No script found, nothing was done',
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

      if (!state.devices.has(id)) return

      const device = state.devices.get(id)
      delete device?.secureServerAddress
      await afs.writeFile(devicesFile, JSON.stringify(state.devices, mapReplacer), 'utf-8')
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
        // do nothing on purpose, there's no need to notify a user that
        // starting charging their device, that their device is being
        // charged
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
        case responseFileTypes.media_infos: {
          const fileId = new URL(response.downloadUrl).searchParams.get('id')
          if (!fileId) break

          const file = (
            await drive.files.get({
              alt: 'media',
              fileId,
            })
          ).data

          // @ts-ignore: The google api has the incorrect type when using `alt: 'media'`
          const text = file.text ? await file.text() : file
          let mediaInfo: MediaInfo
          try {
            mediaInfo = JSON.parse(text) as MediaInfo
          } catch (e) {
            // TODO: some kind of error message
            return
          }
          response.request.deviceIds.forEach((deviceId) => {
            const mediaRequest = mediaRequests.get(deviceId)
            if (!mediaRequest) return

            mediaRequest(mediaInfo)
          })

          break
        }
        case responseFileTypes.sms_threads: {
          await Promise.all(
            response.request.deviceIds.map(async (deviceId) => {
              const contactRequest = contactRequests.get(deviceId)
              if (contactRequest) {
                const contactsInfo = await getContactsNonLocal(deviceId)
                contactRequest(contactsInfo)
              }
              const smsRequest = smsRequests.get(deviceId)
              if (smsRequest) {
                const smsInfo = await getSmsNonLocal(deviceId)
                smsRequest(smsInfo)
              }
            }),
          )

          break
        }
        case responseFileTypes.sms_conversation: {
          const address = response.request.payload
          if (!address) return

          await Promise.all(
            response.request.deviceIds.map(async (deviceId) => {
              const smsChatRequest = smsChatRequests.get(`${deviceId}${address}`)
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
    case 'GCMLocation': {
      const response = content as LocationInfo

      new Notification({
        title: `Devices's location received`,
        body: 'Showing location in Google maps',
      }).show()
      const location = `${response.latitude},${response.longitude}`
      shell.openExternal(`https://www.google.com/maps?q=${location}&ll=${location}&z=17`)

      break
    }
    case 'GCMLocalNetworkTestRequest': {
      if (!state.address) {
        new Notification({
          title: 'Local Network Test Requested',
          body: 'state.address is undefined. Nothing done.',
        }).show()
        return
      }

      const req = content as LocalNetworkTestRequest

      const devicesInfo = await getCachedDevicesInfo()
      const receiver = devicesInfo.find((device) => device.deviceId === req.senderId)
      if (!receiver) return
      if (!state.thisDeviceId) return

      requestLocalNetworkTest(receiver.deviceId, receiver.regId2)
      break
    }
    case 'GCMSmsSentResult': {
      // NOTE: do nothing. `SmsSentResult` doesn't have any information about
      // the SMS it reffers to, so I can't validate/invalidate tanstack query
      // cache based on it
      break
    }
    case 'GCMDeviceRegistered': {
      const info = content as DeviceRegistered
      // TODO: add/remove each device instead of invalidating the whole thing?
      getDevicesInfo()
      win.webContents.send('on-device-registered', info)
      break
    }
  }
}

export const handleNotification = async (
  notification: MessageEnvelope,
  win: BrowserWindow,
  persistentIds: string[],
) => {
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
    await handleNotification(
      {
        message: { data: { json: acc.join(''), type: rawData.type } },
        persistentId: notification.persistentId,
      },
      win,
      persistentIds,
    )
  } else if (rawData && rawData.json && typeof rawData.json === 'string') {
    const data = rawData as JoinData
    await handleGcm(data, win)
  }

  await afs.writeFile(persistentIdsFile, JSON.stringify(persistentIds), 'utf-8')
}

export async function startPushReceiver(win: BrowserWindow, onReady: () => Promise<void>) {
  if (!state.credentials) throw new Error('Credentials is null')

  const persistentIds = await new Promise<string[]>((res, rej) => {
    fs.readFile(persistentIdsFile, 'utf-8', (err, content) => {
      if (err && err.code == 'ENOENT') return res([])
      else if (err) rej(err)
      else {
        try {
          res(JSON.parse(content))
        } catch (e) {
          // TODO: some kind of error message
          res([])
        }
      }
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
    credentials: state.credentials,
  })
  instance.onReady(onReady)

  instance.onCredentialsChanged(async ({ oldCredentials: _oldCredentials, newCredentials }) => {
    state.credentials = newCredentials
    await afs.writeFile(credentialsFile, JSON.stringify(state.credentials), 'utf-8')
  })

  instance.onNotification(async (notification) => {
    await handleNotification(notification, win, persistentIds)
  })

  await instance.connect()
}
