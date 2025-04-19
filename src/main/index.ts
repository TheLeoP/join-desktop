import {
  app,
  shell,
  BrowserWindow,
  ipcMain as m,
  clipboard,
  Notification,
  Tray,
  Menu,
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import joinIcon from '../../resources/join.png?asset'
import * as fs from 'node:fs'
import { promises as afs } from 'node:fs'
import { URL } from 'node:url'
import { PushReceiver } from '@eneris/push-receiver'
import { type MessageEnvelope, type Credentials } from '@eneris/push-receiver/dist/types'
import * as https from 'node:https'
import { v4 as uuidv4 } from 'uuid'
import AutoLaunch from 'auto-launch'
import type {
  MediaInfo,
  FolderInfo,
  FileInfo,
  ContactInfo,
  SmsInfo,
  JoinData,
  PushWrapper,
  NotificationClear,
  LocalNetworkRequest,
  DeviceNotOnLocalNetworkRequest,
  Status,
  RespondFile,
  GenericResponse,
  FoldersResponse,
  SmsResponse,
  LocationInfo,
  Settings,
} from '../preload/types'
import { actions, Actions, fcmPush, setClipboard, smsSend, call } from './actions'
import { createPopup, applyShortcuts } from './popup'
import { getCachedDevicesInfo, state } from './state'
import {
  drive,
  fcm,
  getContactsNonLocal,
  getMediaInfoNonLocal,
  getPushHistoryNonLocal,
  getSmsChatsNonLocal,
  getSmsNonLocal,
  jwtClient,
  logInWithGoogle,
  mediaActionNonLocal,
  oauth2Client,
} from './google'
import { notificationImage, batteryOkImage, batteryLowImage } from './images'
import {
  contactRequests,
  credentialsFile,
  deviceIdFile,
  devicesFile,
  fileRequests,
  folderRequests,
  mediaRequests,
  persistentIdsFile,
  responseFileTypes,
  scriptsDir,
  settingsFile,
  shortcutsFile,
  smsChatRequests,
  smsRequests,
  tokenFile,
} from './consts'
import { mapReplacer, mapReviver } from './utils'
import { registerDevice, renameDevice, deleteDevice } from './joinApi'

const notifications = new Map<string, Notification>()
let shortcuts: Map<string, keyof Actions>
let settings: Settings

const joinAutoLauncher = new AutoLaunch({ name: 'join-desktop', isHidden: true })

let credentials: Credentials | undefined

async function testLocalAddress(id: string, url: string, win: BrowserWindow) {
  const body = JSON.stringify({
    type: 'GCMLocalNetworkTest',
    json: JSON.stringify({
      type: 'GCMLocalNetworkTest',
      senderID: state.thisDeviceId,
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

  return new Promise<boolean>((res, _rej) => {
    req.on('response', async () => {
      if (!state.devices.has(id)) {
        state.devices.set(id, { secureServerAddress: url })
      } else if (state.devices.has(id)) {
        const device = state.devices.get(id)
        device!.secureServerAddress = url
      }
      await afs.writeFile(devicesFile, JSON.stringify(state.devices, mapReplacer), 'utf-8')
      win.webContents.send('on-local-network', id, true)

      res(true)
    })
    req.on('error', async () => {
      if (!state.devices.has(id)) return

      const device = state.devices.get(id)

      delete device?.secureServerAddress
      await afs.writeFile(devicesFile, JSON.stringify(state.devices, mapReplacer), 'utf-8')
      win.webContents.send('on-local-network', id, false)

      res(false)
    })
  })
}

const multiNotifications = new Map<string, string[]>()
let lastBatteryNotification: Notification | undefined
async function startPushReceiver(win: BrowserWindow, onReady: () => Promise<void>) {
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
    ...(credentials ? { credentials } : {}),
  })
  instance.onReady(onReady)

  instance.onCredentialsChanged(async ({ oldCredentials: _oldCredentials, newCredentials }) => {
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
            const key = settings.scripts
              .keys()
              .find((command) => new RegExp(command).test(push.text as string))

            let ok = false
            if (key) {
              const scriptName = settings.scripts.get(key)
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
              const text = await file.text()
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
      }
    }

    await afs.writeFile(persistentIdsFile, JSON.stringify(persistentIds), 'utf-8')
  }
  instance.onNotification(handleNotification)

  await instance.connect()
}

async function saveShortcuts(newShortcuts: Map<string, keyof Actions>) {
  await afs.writeFile(shortcutsFile, JSON.stringify(newShortcuts, mapReplacer), 'utf-8')
}

async function saveSettings(newSettings: Settings) {
  await afs.writeFile(settingsFile, JSON.stringify(newSettings, mapReplacer), 'utf-8')
}

function applySettings(settings: Settings) {
  // TODO: mention in README that the app needs to be opened at least once in order for autostart to work?
  if (settings.autostart) joinAutoLauncher.enable()
  else joinAutoLauncher.disable()
}

function createWindow(tray: Tray) {
  const win = new BrowserWindow({
    // TODO: how does this look in windows? Start maximized instead?
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon: joinIcon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  m.handle('register-device', (_, name) => {
    if (!credentials) throw new Error('There are no credentials')
    return registerDevice(name, credentials, win)
  })
  m.handle('start-push-receiver', () =>
    startPushReceiver(win, async () => {
      const devicesInfo = await getCachedDevicesInfo()
      if (!devicesInfo) return

      // TODO: if this code path if followed, devices on local network seem to work fine, but the local Network isn't shown. Why?
      const isThisDeviceRegistered = devicesInfo.some(
        (device) => device.deviceId === state.thisDeviceId,
      )
      if (!isThisDeviceRegistered) {
        win.webContents.send('on-device-id', null)
        return
      }

      state.devices.forEach((_, deviceId) => {
        const deviceInfo = devicesInfo.find((deviceInfo) => deviceInfo.deviceId === deviceId)
        if (!deviceInfo) state.devices.delete(deviceId)
      })
      await afs.writeFile(devicesFile, JSON.stringify(state.devices, mapReplacer), 'utf-8')

      // TODO: check how this is working and if it always is failing and then requesting an address
      const resultsLocal = await Promise.all(
        devicesInfo.map(async (info) => {
          const localInfo = state.devices.get(info.deviceId)
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
                      senderId: state.thisDeviceId,
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
  m.on('call', (_, callnumber, deviceId, regId2) => call(deviceId, regId2, callnumber))
  m.on(
    'open-remote-file',
    async (_, deviceId: string, regId2: string, path: string, fileName: string) => {
      const device = state.devices.get(deviceId)
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
              token: regId2,
              android: {
                priority: 'high',
              },
              data: {
                type: 'GCMFolderRequest',
                json: JSON.stringify({
                  type: 'GCMFolderRequest',
                  path,
                  senderId: state.thisDeviceId,
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
    const device = state.devices.get(deviceId)
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
      click: () => {
        win.hide()
      },
    },
  ])
  win.on('hide', () => tray.setContextMenu(showMenu))
  win.on('show', () => tray.setContextMenu(hideMenu))

  win.on('ready-to-show', async () => {
    // TODO: hide by default and make it configurable
    win.show()

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
      state.thisDeviceId = content
      win.webContents.send('on-device-id', state.thisDeviceId)
    } catch (e) {}
    try {
      const content = await afs.readFile(devicesFile, 'utf-8')
      state.devices = JSON.parse(content, mapReviver)
    } catch {}
    createPopup()
    try {
      const content = await afs.readFile(shortcutsFile, 'utf-8')
      shortcuts = JSON.parse(content, mapReviver)
      applyShortcuts(shortcuts)
    } catch {
      shortcuts = new Map()
    }
    win.webContents.send('on-shortcuts', shortcuts)
    // TODO: maybe read all of these files before ready-to-show, but send the UI a notification after ready-to-show
    try {
      const content = await afs.readFile(settingsFile, 'utf-8')
      settings = JSON.parse(content, mapReviver)
    } catch {
      settings = {
        autostart: true,
        scripts: new Map<string, string>(),
      }
    }
    applySettings(settings)
    win.webContents.send('on-settings', settings)
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

async function requestContactsAndLastSmSCreation(deviceId: string, regId2: string) {
  fcmPush(deviceId, regId2, {
    type: 'GCMRequestFile',
    json: JSON.stringify({
      type: 'GCMRequestFile',
      requestFile: {
        requestType: responseFileTypes.sms_threads,
        senderId: state.thisDeviceId,
        deviceIds: [deviceId],
      },
      senderId: state.thisDeviceId,
    }),
  })
}

async function requestSmsChatCreationOrUpdate(deviceId: string, regId2: string, address: string) {
  fcmPush(deviceId, regId2, {
    type: 'GCMRequestFile',
    json: JSON.stringify({
      type: 'GCMRequestFile',
      requestFile: {
        requestType: responseFileTypes.sms_conversation,
        payload: address,
        senderId: state.thisDeviceId,
        deviceIds: [deviceId],
      },
      senderId: state.thisDeviceId,
    }),
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

  m.handle('rename-device', async (_, deviceId: string, name: string) => {
    await renameDevice(deviceId, name)
  })
  m.handle('delete-device', async (_, deviceId: string) => {
    await deleteDevice(deviceId)
  })
  m.handle('get-access-token', async () => (await oauth2Client.getAccessToken()).token)
  m.handle('media', async (_, deviceId, regId2) => {
    const device = state.devices.get(deviceId)
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
            let parsedData: GenericResponse
            try {
              parsedData = JSON.parse(data) as GenericResponse
            } catch (e) {
              return rej(e)
            }
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
  m.handle('folders', async (_, deviceId, regId2, path) => {
    const device = state.devices.get(deviceId)
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
            let parsedData: FoldersResponse
            try {
              parsedData = JSON.parse(data) as FoldersResponse
            } catch (e) {
              return rej(e)
            }
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
            token: regId2,
            android: {
              priority: 'high',
            },
            data: {
              type: 'GCMFolderRequest',
              json: JSON.stringify({
                type: 'GCMFolderRequest',
                path,
                senderId: state.thisDeviceId,
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
    const device = state.devices.get(deviceId)
    const data = {
      type: 'GCMPush',
      json: JSON.stringify({
        type: 'GCMPush',
        push: {
          ...action,
          id: uuidv4(),
          senderId: state.thisDeviceId,
        },
        senderId: state.thisDeviceId,
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
            let parsedData: GenericResponse
            try {
              parsedData = JSON.parse(data) as GenericResponse
            } catch (e) {
              return rej(e)
            }
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
  m.handle('contacts', async (_, deviceId, regId2) => {
    const device = state.devices.get(deviceId)
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
            let parsedData: GenericResponse
            try {
              parsedData = JSON.parse(data) as GenericResponse
            } catch (e) {
              return rej(e)
            }
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
        await requestContactsAndLastSmSCreation(deviceId, regId2)

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
  m.handle('sms', async (_, deviceId, regId2) => {
    const device = state.devices.get(deviceId)
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
            let parsedData: SmsResponse
            try {
              parsedData = JSON.parse(data) as SmsResponse
            } catch (e) {
              return rej(e)
            }
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
      try {
        const smsInfo = await getSmsNonLocal(deviceId)
        return smsInfo
      } catch (e) {
        await requestContactsAndLastSmSCreation(deviceId, regId2)

        return await new Promise((res, rej) => {
          const request = smsRequests.get(deviceId)
          if (request) request(null)

          smsRequests.set(deviceId, (smsInfo) => {
            res(smsInfo)
          })
          setTimeout(
            () => {
              smsRequests.delete(deviceId)
              rej(new Error('Sms request timed out'))
            },
            2 * 60 * 1000,
          )
        })
      }
    }
  })
  m.handle('sms-chat', async (_, deviceId: string, regId2: string, address: string) => {
    const device = state.devices.get(deviceId)
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
            let parsedData: SmsResponse
            try {
              parsedData = JSON.parse(data) as SmsResponse
            } catch (e) {
              return rej(e)
            }
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
        const request = smsChatRequests.get(`${deviceId}${address}`)
        if (request) request(null)

        smsChatRequests.set(`${deviceId}${address}`, (smsChatInfo) => {
          res(smsChatInfo)
        })
        setTimeout(
          () => {
            smsChatRequests.delete(`${deviceId}${address}`)
            rej(new Error('SmsChat request timed out'))
          },
          2 * 60 * 1000,
        )
      })
    }
  })
  m.handle('actions', () => {
    return Object.keys(actions)
  })
  m.handle('push-history', async (_, deviceId: string) => {
    return await getPushHistoryNonLocal(deviceId)
  })
  m.handle('shortcuts-save', async (_, newShortcuts: Map<string, keyof Actions>) => {
    shortcuts = newShortcuts
    saveShortcuts(newShortcuts)
    applyShortcuts(newShortcuts)
  })
  m.handle('settings-save', async (_, newSettings: Settings) => {
    settings = newSettings
    saveSettings(newSettings)
    applySettings(newSettings)
  })

  createWindow(tray)

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
app.on('certificate-error', (_event, _webContents, _url, _error, certificate, cb) => {
  cb(certificate.data === allowedCertificate)
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
