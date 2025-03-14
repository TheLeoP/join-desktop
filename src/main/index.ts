import {
  app,
  shell,
  BrowserWindow,
  ipcMain as m,
  clipboard,
  Notification,
  nativeImage,
  Tray,
  Menu,
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as fs from 'node:fs'
import { promises as afs } from 'node:fs'
import * as http from 'node:http'
import { URL } from 'node:url'
import { PushReceiver } from '@eneris/push-receiver'
import { type Credentials } from '@eneris/push-receiver/dist/types'
import { google } from 'googleapis'

const dataDir = app.getPath('userData')
const credentialsFile = `${dataDir}/credentials.json`
const persistentIdsFile = `${dataDir}/persistentIds.json`
const tokenFile = `${dataDir}/token.json`
const deviceIdFile = `${dataDir}/deviceId`
const notificationIcon = nativeImage
  .createFromPath('src/renderer/src/assets/join.png')
  .resize({ width: 50 })

const devices = {
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
}

const id = '596310809542-giumrib7hohfiftljqmj7eaio3kl21ek.apps.googleusercontent.com'
const secret = 'NTA9UbFpNhaIP74B_lpxGgvR'
const redirectUri = 'http://127.0.0.1:9876'
const oauth2Client = new google.auth.OAuth2(id, secret, redirectUri)
google.options({ auth: oauth2Client })

async function logInWithGoogle(win: BrowserWindow) {
  if (Object.keys(oauth2Client.credentials).length !== 0) return win.webContents.send('on-log-in')

  const scopes = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ]
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  })

  const code = await new Promise<string | null>((res, rej) => {
    const server = http.createServer((req, resp) => {
      if (!req.url) return

      const code = new URL(`http://localhost${req.url}`).searchParams.get('code')
      res(code)

      resp.writeHead(200)
      resp.end(`<!DOCTYPE html>
<html>
  <body onload="window.close()">
    <h1>Everything done, you can close this<h1>
  </body>
</html>`)
      server.close()
    })
    server.listen(9876, () => shell.openExternal(authUrl))
  })
  if (!code) throw new Error('No code was received')

  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)
  await afs.writeFile(tokenFile, JSON.stringify(tokens), 'utf-8')

  win.webContents.send('on-log-in')
}

let deviceId: string | undefined

async function registerDevice(name: string) {
  const token = await oauth2Client.getAccessToken()

  if (!credentials) throw new Error('There are no credentials')

  const joinUrl = 'https://joinjoaomgcd.appspot.com/_ah/api'
  const res = await fetch(`${joinUrl}/registration/v1/registerDevice`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.token}`,
    },
    body: JSON.stringify({
      deviceId: deviceId,
      regId: credentials.fcm.token,
      regId2: credentials.fcm.token,
      deviceName: name,
      deviceType: devices.firefox,
    }),
  })
  const out = await res.json()
  await afs.writeFile(deviceIdFile, out.deviceId, 'utf-8')
  deviceId = out.deviceId
  const win = BrowserWindow.getFocusedWindow()
  if (!win) throw new Error("There's no win")
  win.webContents.send('on-device-id', deviceId)
}

let credentials: Credentials | undefined

type JoinData = {
  json: string
  type: 'GCMPush' | 'GCMNotificationClear' | ''
}

type JoinContent = {
  push: {
    language: string | undefined
    say: string | undefined
    title: string | undefined
    url: string | undefined
    areLocalFiles: boolean
    back: boolean
    clipboard: string
    commandLine: boolean
    date: number
    deviceId: string
    files: string[] | undefined
    find: boolean
    fromTasker: boolean
    id: string | undefined
    notificationId: string | undefined // to clear notification
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

const notifications = new Map<string, Notification>()

async function startPushReceiver(win: BrowserWindow) {
  const persistentIds = await new Promise<string[]>((res, rej) => {
    fs.readFile(persistentIdsFile, 'utf-8', (err, content) => {
      if (err && err.code == 'ENOENT') return res([])
      else if (err) rej(err)
      else res(JSON.parse(content))
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
    credentials: credentials,
  })

  instance.onCredentialsChanged(async ({ oldCredentials, newCredentials }) => {
    credentials = newCredentials
    await afs.writeFile(credentialsFile, JSON.stringify(credentials), 'utf-8')
  })

  instance.onNotification(async (notification) => {
    // TODO: remove
    console.log('Notification received', notification)

    const rawData = notification.message.data
    if (rawData && rawData.json && typeof rawData.json === 'string') {
      const data = rawData as JoinData
      const content = JSON.parse(data.json) as JoinContent
      const push = content.push

      // TODO: support reading settings and modyfing behaviour accordingly?
      let n: Notification | undefined
      switch (data.type) {
        case 'GCMPush':
          if (push.clipboard) {
            clipboard.writeText(push.clipboard)
            n = new Notification({
              title: 'Clipboard set',
              icon: notificationIcon,
            })
          } else if (push.url) {
            shell.openExternal(push.url)
            n = new Notification({
              title: 'Openning url',
              body: push.url,
              icon: notificationIcon,
            })
          } else if (push.files && push.files.length > 0) {
            // TODO: maybe handle base64 images?
            n = new Notification({
              title: 'Received files',
              body: 'Openning now...',
              icon: notificationIcon,
            })
            push.files
              .filter((file) => file.startsWith('https://'))
              .forEach((file) => {
                return shell.openExternal(file)
              })
          } else if (push.location) {
            // doesn't work in Electron because it needs a Google API_KEY with location API access
            // see https://github.com/electron/electron/pull/22034
            n = new Notification({
              title: 'Location Requested not supported',
              icon: notificationIcon,
            })
          } else if (push.say) {
            win.webContents.send('on-speak', push.say, push.language)
            n = new Notification({
              title: `Saying Out Loud${push.language ? ` with language ${push.language}` : ''}`,
              body: push.say,
              icon: notificationIcon,
            })
          } else if (push.title) {
            n = new Notification({
              title: push.title,
              body: push.text,
              icon: notificationIcon,
            })
          } else {
            // TODO: do something else?
            n = new Notification({
              title: 'Join',
              body: 'Receive push',
              icon: notificationIcon,
            })
          }
          break
        case 'GCMNotificationClear':
          if (!push.notificationId) break

          notifications.get(push.notificationId)?.close()
          break
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
    }

    await afs.writeFile(persistentIdsFile, JSON.stringify(persistentIds), 'utf-8')
  })

  await instance.connect()
}

function createWindow(tray: Tray) {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  m.handle('start-push-receiver', () => startPushReceiver(win))
  m.on('log-in-with-google', () => {
    logInWithGoogle(win)
  })

  const showMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      role: 'unhide',
      click: (item, win, event) => {
        BrowserWindow.getAllWindows()[0]?.show()
      },
    },
  ])
  const hideMenu = Menu.buildFromTemplate([
    {
      label: 'Close',
      role: 'hide',
      click: (item, win, event) => {
        win?.hide()
      },
    },
  ])
  win.on('hide', () => tray.setContextMenu(showMenu))
  win.on('show', () => tray.setContextMenu(hideMenu))

  win.on('ready-to-show', async () => {
    // TODO: hide by default?
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
      deviceId = content
      win.webContents.send('on-device-id', deviceId)
    } catch (e) {}
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

app.whenReady().then(() => {
  const tray = new Tray('src/renderer/src/assets/join.png')
  tray.setToolTip('Join desktop app')

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-tdeviceIdoolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  m.handle('register-device', (_, name) => {
    return registerDevice(name)
  })
  m.handle('get-access-token', async () => (await oauth2Client.getAccessToken()).token)

  createWindow(tray)

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
