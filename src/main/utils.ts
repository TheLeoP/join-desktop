import { type BrowserWindow, Notification } from 'electron/main'

export function mapReplacer(_key: unknown, value: unknown) {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: [...value],
    }
  } else {
    return value
  }
}

export function mapReviver(_key: unknown, value: unknown) {
  if (typeof value === 'object' && value !== null) {
    if ((value as Record<string, unknown>).dataType === 'Map') {
      return new Map((value as { value: [unknown, unknown][] }).value)
    }
  }
  return value
}

export function error(message: string, win: BrowserWindow | null) {
  if (win && win.isVisible()) {
    win.webContents.send('on-error')
  } else {
    new Notification({ title: 'Error', body: message }).show()
  }
}
