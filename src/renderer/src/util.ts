import { QueryClient, queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { createContext, useContext } from 'react'
import type {
  MediaAction,
  MediaInfo,
  DeviceInfo,
  ContactInfo,
  SmsInfo,
  Data,
  Settings,
} from 'src/preload/types'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
})

const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
})

persistQueryClient({
  queryClient,
  persister: localStoragePersister,
})

export const DeviceType = {
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

export const ReverseDeviceType = {
  1: 'android_phone',
  2: 'android_tablet',
  3: 'chrome_browser',
  4: 'windows_10',
  5: 'tasker',
  6: 'firefox',
  7: 'group',
  8: 'android_tv',
  9: 'google_assistant',
  10: 'ios_phone',
  11: 'ios_tablet',
  12: 'ifttt',
  13: 'ip',
  14: 'mqtt',
} as const

export const isLoggedInContext = createContext<boolean>(false)
export function useIsLoggedIn() {
  const isLoggedIn = useContext(isLoggedInContext)
  return isLoggedIn
}

export const shortcutsContext = createContext<
  [Map<string, string>, React.Dispatch<React.SetStateAction<Map<string, string>>>] | null
>(null)
export function useShortcuts() {
  const shortcuts = useContext(shortcutsContext)
  if (shortcuts === null) {
    throw new Error('shortcuts context is null')
  }
  return shortcuts
}

export const deviceIdContext = createContext<string | null>(null)
export function useDeviceId() {
  const deviceId = useContext(deviceIdContext)
  return deviceId
}

export const devicesOnLocalNetworkContext = createContext<Record<string, boolean> | null>(null)
export function useOnLocalNetwork(deviceId: string | null) {
  const devicesOnLocalNetwork = useContext(devicesOnLocalNetworkContext)

  if (!deviceId) return false

  const onLocalNetwork = devicesOnLocalNetwork ? !!devicesOnLocalNetwork[deviceId] : false
  return onLocalNetwork
}

export const settingsContext = createContext<
  [Settings | null, React.Dispatch<React.SetStateAction<Settings | null>>] | null
>(null)
export function useSettings() {
  const settings = useContext(settingsContext)
  if (settings === null) {
    throw new Error('settings context is null')
  }
  return settings
}

export function useMediaAction(deviceId: string, regId2: string) {
  return useMutation<
    unknown,
    Error,
    {
      action: MediaAction
    },
    {
      previousMediaInfo: MediaInfo
    }
  >({
    mutationFn: async ({ action }) => {
      await window.api.mediaAction(deviceId, regId2, action)
    },
    onMutate: async ({ action }) => {
      await queryClient.cancelQueries({ queryKey: ['mediaInfo', deviceId, regId2] })

      const previousMediaInfo = queryClient.getQueryData([
        'mediaInfo',
        deviceId,
        regId2,
      ]) as MediaInfo

      queryClient.setQueryData(['mediaInfo', deviceId, regId2], (old: MediaInfo) => {
        const newValue = { ...old }
        const currentInfo = newValue.mediaInfosForClients.find(
          (info) => info.packageName === action.mediaAppPackage,
        )
        if (!currentInfo) return newValue

        currentInfo.date = Date.now()
        if (action.play) {
          currentInfo.playing = true
        } else if (action.pause) {
          currentInfo.playing = false
        }
        return newValue
      })

      return { previousMediaInfo }
    },
    onError: (_err, _mediaAction, context) => {
      if (!context) return

      queryClient.setQueryData(['mediaInfo', deviceId, regId2], context.previousMediaInfo)
    },
    onSettled: () => {
      // NOTE: the Join Android app needs time to update the information, so don't invalidate right away
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['mediaInfo', deviceId, regId2] })
      }, 1000)
      // TODO: make this time configurable
    },
  })
}

export const devicesQueryOptions = queryOptions<Data<DeviceInfo>>({
  queryKey: ['devices'],
  queryFn: async () => {
    const joinUrl = 'https://joinjoaomgcd.appspot.com/_ah/api'
    const token = await window.api.getAccessToken()
    const res = await fetch(`${joinUrl}/registration/v1/listDevices`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return await res.json()
  },
})

export function useDevices() {
  return useQuery(devicesQueryOptions)
}

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'

  const k = 1000
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export function contactsQueryOptions(deviceId: string, regId2: string, onLocalNetwork: boolean) {
  return queryOptions<ContactInfo[], Error, ContactInfo[], readonly ['contacts', string, string]>({
    staleTime: onLocalNetwork ? 0 : 60 * 1000,
    queryKey: ['contacts', deviceId, regId2],
    queryFn: async ({ queryKey }) => {
      const [_, deviceId, regId2] = queryKey
      return await window.api.contacts(deviceId, regId2)
    },
  })
}
export function useContacts(deviceId: string, regId2: string, onLocalNetwork: boolean) {
  return useQuery(contactsQueryOptions(deviceId, regId2, onLocalNetwork))
}

export function smsQueryOptions(deviceId: string, regId2: string, onLocalNetwork: boolean) {
  return queryOptions<SmsInfo[], Error, SmsInfo[], readonly ['sms', string, string]>({
    staleTime: onLocalNetwork ? 0 : 60 * 1000,
    queryKey: ['sms', deviceId, regId2],
    queryFn: async ({ queryKey }) => {
      const [_, deviceId, regId2] = queryKey
      return await window.api.sms(deviceId, regId2)
    },
  })
}
export function useSms(deviceId: string, regId2: string, onLocalNetwork: boolean) {
  return useQuery(smsQueryOptions(deviceId, regId2, onLocalNetwork))
}
