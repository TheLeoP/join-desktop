import { QueryClient, queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { useState, useEffect, createContext, useContext } from 'react'
import { MediaAction, MediaInfo, DeviceInfo, ContactInfo, SmsInfo, Data } from 'src/preload/types'

export const queryClient = new QueryClient()

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

export function useDeviceId() {
  const [deviceId, setDeviceId] = useState<string | null>(null)
  useEffect(() => {
    const removeListener = window.api.onDeviceId((id) => {
      setDeviceId(id)
    })

    return () => removeListener()
  }, [])

  return deviceId
}

export const devicesOnLocalNetworkContext = createContext<Record<string, boolean> | null>(null)
export function useOnLocalNetwork(deviceId: string) {
  const devicesOnLocalNetwork = useContext(devicesOnLocalNetworkContext)
  const onLocalNetwork = devicesOnLocalNetwork ? devicesOnLocalNetwork[deviceId] : false
  return onLocalNetwork
}

export function useMediaAction(deviceId: string, regId2: string) {
  return useMutation<
    unknown,
    Error,
    {
      action: MediaAction
    }
  >({
    mutationFn: async ({ action }) => {
      await window.api.mediaAction(deviceId, regId2, action)
    },
    onMutate: async ({ action }) => {
      await queryClient.cancelQueries({ queryKey: ['mediaInfo', deviceId, regId2] })

      queryClient.setQueryData(['mediaInfo', deviceId, regId2], (old: MediaInfo) => {
        const newValue = { ...old }
        const currentInfo = newValue.mediaInfosForClients.find(
          (info) => info.packageName === action.mediaAppPackage,
        )
        if (currentInfo && action.play) {
          currentInfo.playing = true
        } else if (currentInfo && action.pause) {
          currentInfo.playing = false
        }
        return newValue
      })
    },
    // NOTE: can't simply invalidate and refetch the query because Join (the
    // mobile app) won't deliver updated information
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

export function contactsQueryOptions(deviceId: string, regId2: string) {
  return queryOptions<ContactInfo[], Error, ContactInfo[], readonly string[]>({
    staleTime: 60 * 1000,
    // TODO: allow retrying all queries
    // TODO: when using loaders, maybe make them less eager if not in local network(?
    // TODO: check staleTime, retry, etc for all queries and maybe take into account if in local network or not
    retry: false,
    queryKey: ['contacts', deviceId, regId2 as string],
    queryFn: async ({ queryKey }) => {
      const [_, deviceId, regId2] = queryKey
      return await window.api.contacts(deviceId, regId2)
    },
  })
}
export function useContacts(deviceId: string, regId2: string) {
  return useQuery(contactsQueryOptions(deviceId, regId2))
}

export function smsQueryOptions(deviceId: string, regId2: string) {
  return queryOptions<SmsInfo[], Error, SmsInfo[], readonly string[]>({
    staleTime: 60 * 1000,
    retry: false,
    queryKey: ['sms', deviceId, regId2 as string],
    queryFn: async ({ queryKey }) => {
      const [_, deviceId, regId2] = queryKey
      return await window.api.sms(deviceId, regId2)
    },
  })
}
export function useSms(deviceId: string, regId2: string) {
  return useQuery(smsQueryOptions(deviceId, regId2))
}
