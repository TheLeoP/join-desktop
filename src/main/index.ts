import { app, shell, BrowserWindow, ipcMain as m, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import joinIcon from '../../resources/join.png?asset'
import { promises as afs } from 'node:fs'
import * as https from 'node:https'
import { v4 as uuidv4 } from 'uuid'
import AutoLaunch from 'auto-launch'
import type {
  MediaInfo,
  FolderInfo,
  ContactInfo,
  SmsInfo,
  LocalNetworkRequest,
  GenericResponse,
  FoldersResponse,
  SmsResponse,
  Settings,
} from '../preload/types'
import { actions, Actions, fcmPush, smsSend, call, testLocalAddress } from './actions'
import { createPopup, applyShortcuts } from './popup'
import { getCachedDevicesInfo, state } from './state'
import {
  drive,
  fcm,
  getContactsNonLocal,
  getMediaInfoNonLocal,
  getPushHistoryNonLocal,
  getSmsNonLocal,
  jwtClient,
  logInWithGoogle,
  mediaActionNonLocal,
  oauth2Client,
} from './google'
import {
  contactRequests,
  credentialsFile,
  deviceIdFile,
  devicesFile,
  devicesTypes,
  fileRequests,
  folderRequests,
  responseFileTypes,
  settingsFile,
  shortcutsFile,
  smsChatRequests,
  smsRequests,
  tokenFile,
} from './consts'
import { mapReplacer, mapReviver } from './utils'
import { registerDevice, renameDevice, deleteDevice } from './joinApi'
import { start } from './server'
import { startPushReceiver } from './push-receiver'

let shortcuts: Map<string, keyof Actions>

const joinAutoLauncher = new AutoLaunch({ name: 'join-desktop', isHidden: true })

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
    if (!state.credentials) throw new Error('There are no credentials')
    return registerDevice(name, state.credentials, win)
  })
  m.handle('start-push-receiver', async () => {
    const address = await start(win)
    // TODO: create address file in google drive
    // TODO: handle GCMLocalNetworkTestRequest

    const devicesInfo = await getCachedDevicesInfo()
    devicesInfo
      .filter(
        (device) =>
          device.deviceId !== state.thisDeviceId &&
          (device.deviceType === devicesTypes.android_phone ||
            device.deviceType === devicesTypes.firefox),
      )
      .map((device) => {
        fcmPush(device.deviceId, device.regId2, {
          type: 'GCMLocalNetworkRequest',
          json: JSON.stringify({
            type: 'GCMLocalNetworkRequest',
            senderId: state.thisDeviceId,
            // NOTE: Join apps seem to asume that the url will have a trailing `/`
            secureServerAddress: address + '/',
          }),
        })
      })

    startPushReceiver(win, async () => {
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
        const info = devicesInfo.find((info) => info.deviceId === deviceId)
        if (!info) state.devices.delete(deviceId)
      })
      await afs.writeFile(devicesFile, JSON.stringify(state.devices, mapReplacer), 'utf-8')

      // TODO: it seems like Android devices use this information to list if we
      // are in a local network. Do they try to use the HTTP server or do they
      // always use an FCM push? Maybe we need to lie and say that we are other
      // kind of devices to make them try to use the HTTP server if we ever
      // implement it
      const resultsLocal = await Promise.all(
        devicesInfo
          .filter((info) => info.deviceId !== state.thisDeviceId)
          .map(async (info) => {
            const localInfo = state.devices.get(info.deviceId)
            if (!localInfo || !localInfo?.secureServerAddress) return { info, success: false }

            const success = await testLocalAddress(
              info.deviceId,
              localInfo.secureServerAddress,
              win,
            )
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
    })
  })
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
      state.credentials = JSON.parse(content)
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
      state.settings = JSON.parse(content, mapReviver)
    } catch {}
    applySettings(state.settings)
    win.webContents.send('on-settings', state.settings)
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
    state.settings = newSettings
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
