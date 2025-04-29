import { PushReceiver } from '@theleop/push-receiver'
import * as fs from 'node:fs'
import { promises as afs } from 'node:fs'
import { MessageEnvelope } from '@theleop/push-receiver/dist/types'
import { BrowserWindow, clipboard, shell, Notification, nativeImage, NativeImage } from 'electron'
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
  NewSmsReceived,
  JoinNotificationWrapper,
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
import {
  notificationImage,
  batteryOkImage,
  batteryLowImage,
  phoneIncomingImage,
  phoneOngoingImage,
  phoneMissedImage,
} from './images'
import { state } from './state'
import { error, mapReplacer } from './utils'
import { push, requestLocalNetworkTest, setClipboard, testLocalAddress } from './popup'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
const aexec = promisify(exec)

const notifications = new Map<string, Notification>()

const multiNotifications = new Map<string, string[]>()
let lastBatteryNotification: Notification | undefined
export async function handleGcm(data: JoinData, win: BrowserWindow) {
  let content: unknown
  try {
    content = JSON.parse(data.json)
  } catch (e) {
    error(e?.toString() || 'An error occurred', win)
    return
  }

  switch (data.type) {
    case 'GCMPush': {
      const pushInfo = (content as PushWrapper).push

      if (pushInfo.clipboard && pushInfo.clipboard !== 'Clipboard not set') {
        clipboard.writeText(pushInfo.clipboard)
        new Notification({
          title: 'Clipboard set',
          icon: notificationImage,
        }).show()
      } else if (pushInfo.clipboard && pushInfo.clipboard === 'Clipboard not set') {
        const devicesInfo = await getCachedDevicesInfo()
        const deviceName = devicesInfo.find(
          (device) => device.deviceId === pushInfo.senderId,
        )?.deviceName
        new Notification({
          title: `${deviceName}'s clipboard is empty`,
          icon: notificationImage,
        }).show()
      } else if (pushInfo.clipboardget) {
        new Notification({
          title: 'Clipboard requested',
          body: pushInfo.url,
          icon: notificationImage,
        }).show()

        const devicesInfo = await getCachedDevicesInfo()

        const receiver = devicesInfo.find((device) => device.deviceId === pushInfo.senderId)
        if (!receiver) return

        setClipboard(receiver.deviceId, receiver.regId2, clipboard.readText())
      } else if (pushInfo.url) {
        shell.openExternal(pushInfo.url)
        new Notification({
          title: 'Openning url',
          body: pushInfo.url,
          icon: notificationImage,
        }).show()
      } else if (pushInfo.files && pushInfo.files.length > 0) {
        new Notification({
          title: 'Received files',
          body: 'Openning now...',
          icon: notificationImage,
        }).show()
        pushInfo.files
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
      } else if (pushInfo.location) {
        // NOTE: doesn't work in Electron because it needs a Google API_KEY with location API access
        // see https://github.com/electron/electron/pull/22034
        new Notification({
          title: 'Location Requested',
          body: 'Not supported',
          icon: notificationImage,
        }).show()
      } else if (pushInfo.say) {
        win.webContents.send('on-speak', pushInfo.say, pushInfo.language)
        new Notification({
          title: `Saying Out Loud${pushInfo.language ? ` with language ${pushInfo.language}` : ''}`,
          body: pushInfo.say,
          icon: notificationImage,
        }).show()
      } else if (pushInfo.title) {
        new Notification({
          title: pushInfo.title,
          body: pushInfo.text,
          icon: notificationImage,
        }).show()
      } else if (pushInfo.text && pushInfo.text !== undefined && pushInfo.values !== undefined) {
        const key = state.settings.scripts
          .keys()
          .find((command) => new RegExp(command).test(pushInfo.text as string))

        let ok = false
        if (key) {
          const scriptName = state.settings.scripts.get(key)
          try {
            const module = await import(scriptsDir + '/' + scriptName)
            const script = module.default as (values: string, valuesArray: string[]) => void
            script(pushInfo.values, pushInfo.valuesArray as string[])
            ok = true
          } catch (e) {}
        }
        new Notification({
          title: `Command received: ${pushInfo.text}`,
          body: ok ? 'Script executed correctly' : 'No script found, nothing was done',
        }).show()
      } else if (pushInfo.commandLine && pushInfo.text) {
        new Notification({
          title: `Command line received.${pushInfo.commandName ? ` Name: ${pushInfo.commandName}` : ''}`,
          body: pushInfo.text,
          icon: notificationImage,
        }).show()

        const result = await aexec(pushInfo.text)
        if (pushInfo.commandResponse) {
          const command = `${pushInfo.commandResponse}=:=${result.stdout.trim()}`
          const receiver = (await getCachedDevicesInfo()).find(
            (device) => device.deviceId === pushInfo.senderId,
          )
          if (receiver) {
            push(receiver.deviceId, receiver.regId2, {
              text: command,
            })
          }
        }
      } else {
        new Notification({
          title: 'Unknown push received',
          body: `text: ${pushInfo.text}`,
          icon: notificationImage,
        }).show()
      }
      break
    }
    case 'GCMNotification': {
      const request = (content as JoinNotificationWrapper).requestNotification
      request.notifications.forEach(async (notification) => {
        const iconString: string | NativeImage =
          notification.statusBarIcon ?? notification.image ?? notification.appIcon
        let icon: NativeImage
        if (iconString === 'icons/phone_incoming.png') {
          icon = phoneIncomingImage
        } else if (iconString === 'icons/phone_ongoing.png') {
          icon = phoneOngoingImage
        } else if (iconString === 'icons/phone_missed.png') {
          icon = phoneMissedImage
        } else if (iconString.startsWith('icons/')) {
          icon = notificationImage
        } else if (iconString.startsWith('http')) {
          const res = await fetch(iconString)
          const arraybuffer = await res.arrayBuffer()
          const buffer = Buffer.from(arraybuffer)
          icon = nativeImage.createFromBuffer(buffer)
        } else {
          icon = nativeImage.createFromDataURL(`data:image/png;base64,${iconString}`)
        }

        const n = new Notification({
          title: notification.title,
          body: notification.text,
          icon,
        })
        n.show()
        notifications.set(notification.id, n)
        n.on('close', () => {
          notifications.delete(notification.id)
        })
      })
      break
    }
    case 'GCMNotificationClear': {
      const req = (content as NotificationClear).requestNotification
      if (!req.requestId) break

      notifications.get(req.requestId)?.close()
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
      if (status.batteryPercentage === 100 && status.charging) {
        n = new Notification({
          title: 'Battery charged',
          body: 'Battery at 100%',
          icon: batteryOkImage,
        })
      } else if (status.charging) {
        // NOTE: do nothing. There's no need to notify a user that
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
            await drive.files.get(
              {
                alt: 'media',
                fileId,
              },
              { responseType: 'json' },
            )
          ).data

          const mediaInfo = file as MediaInfo
          if (!mediaInfo) {
            error(`Couldn't parse MediaInfo from Google Drive with id ${fileId}`, win)
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
    case 'GCMNewSmsReceived': {
      const info = content as NewSmsReceived
      new Notification({
        title: `SMS from ${info.name}`,
        icon: notificationImage,
      }).show()
      win.webContents.send('on-new-sms', info)
      break
    }
  }
}

export const handleNotification = async (
  notification: MessageEnvelope,
  win: BrowserWindow,
  persistentIds: string[],
) => {
  // NOTE: only log incoming notifications in dev mode
  if (process.env['ELECTRON_RENDERER_URL']) {
    console.log('Notification received', notification)
  }

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

let instance: PushReceiver | undefined
export function stopPushReceiver() {
  if (!instance) return

  instance.destroy()
  instance = undefined
}

export async function startPushReceiver(win: BrowserWindow, onReady: () => Promise<void>) {
  const persistentIds = await new Promise<string[]>((res, rej) => {
    fs.readFile(persistentIdsFile, 'utf-8', (err, content) => {
      if (err && err.code == 'ENOENT') return res([])
      else if (err) rej(err)
      else {
        try {
          res(JSON.parse(content))
        } catch (e) {
          error(e?.toString() || 'An error occurred', win)
          res([])
        }
      }
    })
  })

  if (!instance) {
    instance = new PushReceiver({
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
  }
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
