/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as ShortcutsImport } from './routes/shortcuts'
import { Route as LoginImport } from './routes/login'
import { Route as IndexImport } from './routes/index'
import { Route as DevicesIndexImport } from './routes/devices/index'
import { Route as DevicesSmsChatImport } from './routes/devices/smsChat'
import { Route as DevicesSmsImport } from './routes/devices/sms'
import { Route as DevicesFilesImport } from './routes/devices/files'
import { Route as DevicesContactsImport } from './routes/devices/contacts'

// Create/Update Routes

const ShortcutsRoute = ShortcutsImport.update({
  id: '/shortcuts',
  path: '/shortcuts',
  getParentRoute: () => rootRoute,
} as any)

const LoginRoute = LoginImport.update({
  id: '/login',
  path: '/login',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const DevicesIndexRoute = DevicesIndexImport.update({
  id: '/devices/',
  path: '/devices/',
  getParentRoute: () => rootRoute,
} as any)

const DevicesSmsChatRoute = DevicesSmsChatImport.update({
  id: '/devices/smsChat',
  path: '/devices/smsChat',
  getParentRoute: () => rootRoute,
} as any)

const DevicesSmsRoute = DevicesSmsImport.update({
  id: '/devices/sms',
  path: '/devices/sms',
  getParentRoute: () => rootRoute,
} as any)

const DevicesFilesRoute = DevicesFilesImport.update({
  id: '/devices/files',
  path: '/devices/files',
  getParentRoute: () => rootRoute,
} as any)

const DevicesContactsRoute = DevicesContactsImport.update({
  id: '/devices/contacts',
  path: '/devices/contacts',
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
    '/login': {
      id: '/login'
      path: '/login'
      fullPath: '/login'
      preLoaderRoute: typeof LoginImport
      parentRoute: typeof rootRoute
    }
    '/shortcuts': {
      id: '/shortcuts'
      path: '/shortcuts'
      fullPath: '/shortcuts'
      preLoaderRoute: typeof ShortcutsImport
      parentRoute: typeof rootRoute
    }
    '/devices/contacts': {
      id: '/devices/contacts'
      path: '/devices/contacts'
      fullPath: '/devices/contacts'
      preLoaderRoute: typeof DevicesContactsImport
      parentRoute: typeof rootRoute
    }
    '/devices/files': {
      id: '/devices/files'
      path: '/devices/files'
      fullPath: '/devices/files'
      preLoaderRoute: typeof DevicesFilesImport
      parentRoute: typeof rootRoute
    }
    '/devices/sms': {
      id: '/devices/sms'
      path: '/devices/sms'
      fullPath: '/devices/sms'
      preLoaderRoute: typeof DevicesSmsImport
      parentRoute: typeof rootRoute
    }
    '/devices/smsChat': {
      id: '/devices/smsChat'
      path: '/devices/smsChat'
      fullPath: '/devices/smsChat'
      preLoaderRoute: typeof DevicesSmsChatImport
      parentRoute: typeof rootRoute
    }
    '/devices/': {
      id: '/devices/'
      path: '/devices'
      fullPath: '/devices'
      preLoaderRoute: typeof DevicesIndexImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/shortcuts': typeof ShortcutsRoute
  '/devices/contacts': typeof DevicesContactsRoute
  '/devices/files': typeof DevicesFilesRoute
  '/devices/sms': typeof DevicesSmsRoute
  '/devices/smsChat': typeof DevicesSmsChatRoute
  '/devices': typeof DevicesIndexRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/shortcuts': typeof ShortcutsRoute
  '/devices/contacts': typeof DevicesContactsRoute
  '/devices/files': typeof DevicesFilesRoute
  '/devices/sms': typeof DevicesSmsRoute
  '/devices/smsChat': typeof DevicesSmsChatRoute
  '/devices': typeof DevicesIndexRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/shortcuts': typeof ShortcutsRoute
  '/devices/contacts': typeof DevicesContactsRoute
  '/devices/files': typeof DevicesFilesRoute
  '/devices/sms': typeof DevicesSmsRoute
  '/devices/smsChat': typeof DevicesSmsChatRoute
  '/devices/': typeof DevicesIndexRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/login'
    | '/shortcuts'
    | '/devices/contacts'
    | '/devices/files'
    | '/devices/sms'
    | '/devices/smsChat'
    | '/devices'
  fileRoutesByTo: FileRoutesByTo
  to:
    | '/'
    | '/login'
    | '/shortcuts'
    | '/devices/contacts'
    | '/devices/files'
    | '/devices/sms'
    | '/devices/smsChat'
    | '/devices'
  id:
    | '__root__'
    | '/'
    | '/login'
    | '/shortcuts'
    | '/devices/contacts'
    | '/devices/files'
    | '/devices/sms'
    | '/devices/smsChat'
    | '/devices/'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  LoginRoute: typeof LoginRoute
  ShortcutsRoute: typeof ShortcutsRoute
  DevicesContactsRoute: typeof DevicesContactsRoute
  DevicesFilesRoute: typeof DevicesFilesRoute
  DevicesSmsRoute: typeof DevicesSmsRoute
  DevicesSmsChatRoute: typeof DevicesSmsChatRoute
  DevicesIndexRoute: typeof DevicesIndexRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  LoginRoute: LoginRoute,
  ShortcutsRoute: ShortcutsRoute,
  DevicesContactsRoute: DevicesContactsRoute,
  DevicesFilesRoute: DevicesFilesRoute,
  DevicesSmsRoute: DevicesSmsRoute,
  DevicesSmsChatRoute: DevicesSmsChatRoute,
  DevicesIndexRoute: DevicesIndexRoute,
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
        "/login",
        "/shortcuts",
        "/devices/contacts",
        "/devices/files",
        "/devices/sms",
        "/devices/smsChat",
        "/devices/"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/login": {
      "filePath": "login.tsx"
    },
    "/shortcuts": {
      "filePath": "shortcuts.tsx"
    },
    "/devices/contacts": {
      "filePath": "devices/contacts.tsx"
    },
    "/devices/files": {
      "filePath": "devices/files.tsx"
    },
    "/devices/sms": {
      "filePath": "devices/sms.tsx"
    },
    "/devices/smsChat": {
      "filePath": "devices/smsChat.tsx"
    },
    "/devices/": {
      "filePath": "devices/index.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
