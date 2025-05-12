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
import {
  createPopup,
  applyShortcuts,
  Actions,
  actions,
  smsSend,
  call,
  testLocalAddress,
  requestContactsAndLastSmSCreation,
  requestLocalNetworkTest,
  requestSmsChatCreationOrUpdate,
} from './popup'
import { state } from './state'
import {
  deviceDirNonLocal,
  dirNonLocal,
  drive,
  fcm,
  getCachedDevicesInfo,
  getContactsNonLocal,
  getDevicesInfo,
  getMediaInfoNonLocal,
  getPushHistoryNonLocal,
  getSmsChatsNonLocal,
  getSmsNonLocal,
  joinDirNonLocal,
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
  joinCertificate,
  ownCertificate,
  settingsFile,
  shortcutsFile,
  smsChatRequests,
  smsRequests,
  tokenFile,
} from './consts'
import { mapReplacer, mapReviver } from './utils'
import { registerDevice, renameDevice, deleteDevice } from './joinApi'
import { start, stop } from './server'
import { startPushReceiver, stopPushReceiver } from './pushReceiver'

const joinAutoLauncher = new AutoLaunch({ name: 'join-desktop', isHidden: true })

async function saveShortcuts(newShortcuts: Map<string, keyof Actions>) {
  await afs.writeFile(shortcutsFile, JSON.stringify(newShortcuts, mapReplacer), 'utf-8')
}

async function saveSettings(newSettings: Settings) {
  await afs.writeFile(settingsFile, JSON.stringify(newSettings, mapReplacer), 'utf-8')
}

function applySettings(settings: Settings) {
  if (settings.autostart && !process.env['ELECTRON_RENDERER_URL']) joinAutoLauncher.enable()
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
  state.win = win
  win.on('close', (e) => {
    e.preventDefault()
    win.hide()
  })

  m.handle('register-device', async (_, name) => {
    if (!state.credentials) throw new Error('There are no credentials')
    await registerDevice(name, state.credentials, win)
    // NOTE: update cache after registering this device
    await getDevicesInfo()
  })
  m.handle('delete-device', async (_, deviceId: string) => {
    await deleteDevice(deviceId, win)
    // NOTE: update cache after deleting this device
    await getDevicesInfo()
  })
  m.handle('stop-http-server', async () => {
    await stop()
  })
  m.handle('start-http-server', async () => {
    if (!state.thisDeviceId) throw new Error('thisDeviceId is undefined')

    // NOTE: Join apps seem to asume that the url will have a trailing `/`
    state.address = (await start(win)) + '/'
    const addresses = {
      senderId: state.thisDeviceId,
      secureServerAddress: state.address,
    }

    const addressesFileName = `serveraddresses=:=${state.thisDeviceId}`
    const addressesFiles = await drive.files.list({
      q: `name = '${addressesFileName}' and trashed = false`,
    })
    const files = addressesFiles.data.files
    if (!files) throw new Error(`\`files\` is undefined for the name ${addressesFileName}`)

    const addressesFile = files[0]
    if (addressesFile && addressesFile.id) {
      await drive.files.update({
        fileId: addressesFile.id,
        media: {
          mimeType: 'application/json',
          body: JSON.stringify(addresses),
        },
      })
    } else if (!addressesFile) {
      const joinDirId = await joinDirNonLocal()
      const deviceDirId = await deviceDirNonLocal(state.thisDeviceId, joinDirId)
      const settingsDirId = await dirNonLocal('Settings Files', [deviceDirId])
      await drive.files.create({
        requestBody: {
          name: addressesFileName,
          parents: [settingsDirId],
        },
        media: {
          mimeType: 'application/json',
          body: JSON.stringify(addresses),
        },
      })
    }

    const devicesInfo = await getCachedDevicesInfo()
    await Promise.all(
      devicesInfo
        .filter(
          (device) =>
            device.deviceId !== state.thisDeviceId &&
            (device.deviceType === devicesTypes.android_phone ||
              device.deviceType === devicesTypes.firefox),
        )
        .map(async (device) => {
          await requestLocalNetworkTest(device.deviceId, device.regId2)
        }),
    )
  })
  m.handle('stop-push-receiver', async () => {
    stopPushReceiver()
  })
  m.handle('start-push-receiver', async () => {
    const devicesInfo = await getCachedDevicesInfo()

    startPushReceiver(win, async () => {
      if (!devicesInfo) return

      state.devices.forEach((_, deviceId) => {
        const info = devicesInfo.find((info) => info.deviceId === deviceId)
        if (!info) state.devices.delete(deviceId)
      })
      await afs.writeFile(devicesFile, JSON.stringify(state.devices, mapReplacer), 'utf-8')

      // NOTE: it seems like Android devices use this information to list if we
      // are in a local network
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
              await drive.files.get(
                {
                  alt: 'media',
                  fileId: fileInfo.id,
                },
                { responseType: 'json' },
              )
            ).data

            const localReq = file as LocalNetworkRequest
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
  m.on('call', (_, deviceId, regId2, callnumber) => call(deviceId, regId2, callnumber))
  m.handle(
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
    async (_, deviceId, regId2, smsnumber, smstext) =>
      await smsSend(deviceId, regId2, smsnumber, smstext),
  )

  const quit = () => {
    app.quit()
  }

  const showMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      role: 'unhide',
      click: () => {
        win.show()
      },
    },
    {
      label: 'Quit',
      role: 'quit',
      click: quit,
    },
  ])
  const hideMenu = Menu.buildFromTemplate([
    {
      label: 'Hide',
      role: 'hide',
      click: () => {
        win.hide()
      },
    },
    {
      label: 'Quit',
      role: 'quit',
      click: quit,
    },
  ])
  win.on('hide', () => {
    if (tray.isDestroyed()) return

    return tray.setContextMenu(showMenu)
  })
  win.on('show', () => {
    tray.setContextMenu(hideMenu)
  })

  win.on('ready-to-show', async () => {
    if (state.settings.showOnStart) {
      win.maximize()
      win.show()
    } else tray.setContextMenu(showMenu)

    applyShortcuts(shortcuts)

    if (isLoggedIn) win.webContents.send('on-log-in')
    if (state.thisDeviceId) win.webContents.send('on-device-id', state.thisDeviceId)
    win.webContents.send('on-shortcuts', shortcuts)
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

try {
  const content = await afs.readFile(credentialsFile, 'utf-8')
  state.credentials = JSON.parse(content)
} catch {}
let isLoggedIn = false
try {
  const content = await afs.readFile(tokenFile, 'utf-8')
  const tokens = JSON.parse(content)
  oauth2Client.setCredentials(tokens)
  isLoggedIn = true
} catch {}
try {
  const content = await afs.readFile(deviceIdFile, 'utf-8')
  state.thisDeviceId = content
} catch (e) {}
try {
  const content = await afs.readFile(devicesFile, 'utf-8')
  state.devices = JSON.parse(content, mapReviver)
} catch {}
let shortcuts: Map<string, keyof Actions>
try {
  const content = await afs.readFile(shortcutsFile, 'utf-8')
  shortcuts = JSON.parse(content, mapReviver)
} catch {
  shortcuts = new Map()
}
try {
  const content = await afs.readFile(settingsFile, 'utf-8')
  state.settings = JSON.parse(content, mapReviver)
} catch {}
applySettings(state.settings)

Menu.setApplicationMenu(null)
app.whenReady().then(() => {
  const tray = new Tray(joinIcon)
  tray.setToolTip('Join desktop app')
  tray.on('click', () => {
    tray.popUpContextMenu()
  })

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
      return new Promise<MediaInfo>((res, rej) => {
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

      return await new Promise<FolderInfo>((res, rej) => {
        const request = folderRequests.get(path)
        if (request) request(null)

        folderRequests.set(path, (folderInfo) => {
          if (folderInfo === null) return rej(new Error('A new FolderInfo request was created'))

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

            const contactsInfo = (parsedData.payload || []) as ContactInfo[]
            res(contactsInfo)
          })
        })
        req.on('error', (err) => {
          rej(err)
        })
      })
    } else {
      // NOTE: when the contacts file doesn't exists yet, we need to send
      // a message to the device to create it
      try {
        const contactsInfo = await getContactsNonLocal(deviceId)
        return contactsInfo
      } catch (e) {
        await requestContactsAndLastSmSCreation(deviceId, regId2)

        return await new Promise<ContactInfo[]>((res, rej) => {
          const request = contactRequests.get(deviceId)
          if (request) request(null)

          contactRequests.set(deviceId, (contactInfo) => {
            if (contactInfo === null) return rej(new Error('A new ContactInfo request was created'))

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

        return await new Promise<SmsInfo[]>((res, rej) => {
          const request = smsRequests.get(deviceId)
          if (request) request(null)

          smsRequests.set(deviceId, (smsInfo) => {
            if (smsInfo === null) return rej(new Error('A new SmsInfo request was created'))

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
      // NOTE: when the smsChat file doesn't exists yet, we need to send
      // a message to the device to create it
      try {
        const smsChatInfo = await getSmsChatsNonLocal(deviceId, address)
        return smsChatInfo
      } catch (e) {
        await requestSmsChatCreationOrUpdate(deviceId, regId2, address)

        return await new Promise<SmsInfo[]>((res, rej) => {
          const request = smsChatRequests.get(`${deviceId}${address}`)
          if (request) request(null)

          smsChatRequests.set(`${deviceId}${address}`, (smsChatInfo) => {
            if (smsChatInfo === null) return rej(new Error('A new SmsChatInfo request was created'))

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
    }
  })
  m.handle('actions', () => {
    return Object.keys(actions)
  })
  m.handle('push-history', async (_, deviceId: string) => {
    try {
      return await getPushHistoryNonLocal(deviceId)
    } catch (e) {
      return []
    }
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
  createPopup()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow(tray)
  })

  app.on('before-quit', () => {
    tray.destroy()
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

app.on('certificate-error', (_event, _webContents, _url, _error, certificate, cb) => {
  cb(certificate.data === joinCertificate || certificate.data === ownCertificate)
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
