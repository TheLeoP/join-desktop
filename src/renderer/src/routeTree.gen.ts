/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as SmsChatImport } from './routes/smsChat'
import { Route as SmsImport } from './routes/sms'
import { Route as ShortcutsImport } from './routes/shortcuts'
import { Route as SettingsImport } from './routes/settings'
import { Route as MediaImport } from './routes/media'
import { Route as LoginImport } from './routes/login'
import { Route as HistoryImport } from './routes/history'
import { Route as FilesImport } from './routes/files'
import { Route as DevicesImport } from './routes/devices'
import { Route as ContactsImport } from './routes/contacts'
import { Route as IndexImport } from './routes/index'

// Create/Update Routes

const SmsChatRoute = SmsChatImport.update({
  id: '/smsChat',
  path: '/smsChat',
  getParentRoute: () => rootRoute,
} as any)

const SmsRoute = SmsImport.update({
  id: '/sms',
  path: '/sms',
  getParentRoute: () => rootRoute,
} as any)

const ShortcutsRoute = ShortcutsImport.update({
  id: '/shortcuts',
  path: '/shortcuts',
  getParentRoute: () => rootRoute,
} as any)

const SettingsRoute = SettingsImport.update({
  id: '/settings',
  path: '/settings',
  getParentRoute: () => rootRoute,
} as any)

const MediaRoute = MediaImport.update({
  id: '/media',
  path: '/media',
  getParentRoute: () => rootRoute,
} as any)

const LoginRoute = LoginImport.update({
  id: '/login',
  path: '/login',
  getParentRoute: () => rootRoute,
} as any)

const HistoryRoute = HistoryImport.update({
  id: '/history',
  path: '/history',
  getParentRoute: () => rootRoute,
} as any)

const FilesRoute = FilesImport.update({
  id: '/files',
  path: '/files',
  getParentRoute: () => rootRoute,
} as any)

const DevicesRoute = DevicesImport.update({
  id: '/devices',
  path: '/devices',
  getParentRoute: () => rootRoute,
} as any)

const ContactsRoute = ContactsImport.update({
  id: '/contacts',
  path: '/contacts',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/contacts': {
      id: '/contacts'
      path: '/contacts'
      fullPath: '/contacts'
      preLoaderRoute: typeof ContactsImport
      parentRoute: typeof rootRoute
    }
    '/devices': {
      id: '/devices'
      path: '/devices'
      fullPath: '/devices'
      preLoaderRoute: typeof DevicesImport
      parentRoute: typeof rootRoute
    }
    '/files': {
      id: '/files'
      path: '/files'
      fullPath: '/files'
      preLoaderRoute: typeof FilesImport
      parentRoute: typeof rootRoute
    }
    '/history': {
      id: '/history'
      path: '/history'
      fullPath: '/history'
      preLoaderRoute: typeof HistoryImport
      parentRoute: typeof rootRoute
    }
    '/login': {
      id: '/login'
      path: '/login'
      fullPath: '/login'
      preLoaderRoute: typeof LoginImport
      parentRoute: typeof rootRoute
    }
    '/media': {
      id: '/media'
      path: '/media'
      fullPath: '/media'
      preLoaderRoute: typeof MediaImport
      parentRoute: typeof rootRoute
    }
    '/settings': {
      id: '/settings'
      path: '/settings'
      fullPath: '/settings'
      preLoaderRoute: typeof SettingsImport
      parentRoute: typeof rootRoute
    }
    '/shortcuts': {
      id: '/shortcuts'
      path: '/shortcuts'
      fullPath: '/shortcuts'
      preLoaderRoute: typeof ShortcutsImport
      parentRoute: typeof rootRoute
    }
    '/sms': {
      id: '/sms'
      path: '/sms'
      fullPath: '/sms'
      preLoaderRoute: typeof SmsImport
      parentRoute: typeof rootRoute
    }
    '/smsChat': {
      id: '/smsChat'
      path: '/smsChat'
      fullPath: '/smsChat'
      preLoaderRoute: typeof SmsChatImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/contacts': typeof ContactsRoute
  '/devices': typeof DevicesRoute
  '/files': typeof FilesRoute
  '/history': typeof HistoryRoute
  '/login': typeof LoginRoute
  '/media': typeof MediaRoute
  '/settings': typeof SettingsRoute
  '/shortcuts': typeof ShortcutsRoute
  '/sms': typeof SmsRoute
  '/smsChat': typeof SmsChatRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/contacts': typeof ContactsRoute
  '/devices': typeof DevicesRoute
  '/files': typeof FilesRoute
  '/history': typeof HistoryRoute
  '/login': typeof LoginRoute
  '/media': typeof MediaRoute
  '/settings': typeof SettingsRoute
  '/shortcuts': typeof ShortcutsRoute
  '/sms': typeof SmsRoute
  '/smsChat': typeof SmsChatRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/contacts': typeof ContactsRoute
  '/devices': typeof DevicesRoute
  '/files': typeof FilesRoute
  '/history': typeof HistoryRoute
  '/login': typeof LoginRoute
  '/media': typeof MediaRoute
  '/settings': typeof SettingsRoute
  '/shortcuts': typeof ShortcutsRoute
  '/sms': typeof SmsRoute
  '/smsChat': typeof SmsChatRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/contacts'
    | '/devices'
    | '/files'
    | '/history'
    | '/login'
    | '/media'
    | '/settings'
    | '/shortcuts'
    | '/sms'
    | '/smsChat'
  fileRoutesByTo: FileRoutesByTo
  to:
    | '/'
    | '/contacts'
    | '/devices'
    | '/files'
    | '/history'
    | '/login'
    | '/media'
    | '/settings'
    | '/shortcuts'
    | '/sms'
    | '/smsChat'
  id:
    | '__root__'
    | '/'
    | '/contacts'
    | '/devices'
    | '/files'
    | '/history'
    | '/login'
    | '/media'
    | '/settings'
    | '/shortcuts'
    | '/sms'
    | '/smsChat'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  ContactsRoute: typeof ContactsRoute
  DevicesRoute: typeof DevicesRoute
  FilesRoute: typeof FilesRoute
  HistoryRoute: typeof HistoryRoute
  LoginRoute: typeof LoginRoute
  MediaRoute: typeof MediaRoute
  SettingsRoute: typeof SettingsRoute
  ShortcutsRoute: typeof ShortcutsRoute
  SmsRoute: typeof SmsRoute
  SmsChatRoute: typeof SmsChatRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  ContactsRoute: ContactsRoute,
  DevicesRoute: DevicesRoute,
  FilesRoute: FilesRoute,
  HistoryRoute: HistoryRoute,
  LoginRoute: LoginRoute,
  MediaRoute: MediaRoute,
  SettingsRoute: SettingsRoute,
  ShortcutsRoute: ShortcutsRoute,
  SmsRoute: SmsRoute,
  SmsChatRoute: SmsChatRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/contacts",
        "/devices",
        "/files",
        "/history",
        "/login",
        "/media",
        "/settings",
        "/shortcuts",
        "/sms",
        "/smsChat"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/contacts": {
      "filePath": "contacts.tsx"
    },
    "/devices": {
      "filePath": "devices.tsx"
    },
    "/files": {
      "filePath": "files.tsx"
    },
    "/history": {
      "filePath": "history.tsx"
    },
    "/login": {
      "filePath": "login.tsx"
    },
    "/media": {
      "filePath": "media.tsx"
    },
    "/settings": {
      "filePath": "settings.tsx"
    },
    "/shortcuts": {
      "filePath": "shortcuts.tsx"
    },
    "/sms": {
      "filePath": "sms.tsx"
    },
    "/smsChat": {
      "filePath": "smsChat.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
