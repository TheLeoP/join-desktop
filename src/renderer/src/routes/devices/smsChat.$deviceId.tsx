import { SmsInfo, useContacts, useDevices, useSms } from '@renderer/util'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { zodValidator } from '@tanstack/zod-adapter'

const searchSchema = z.object({ address: z.string() })

export const Route = createFileRoute('/devices/smsChat/$deviceId')({
  component: RouteComponent,
  validateSearch: zodValidator(searchSchema),
})

function useSmsChat(deviceId: string, regId2: string | undefined, address: string) {
  return useQuery<SmsInfo[], Error, SmsInfo[], readonly string[]>({
    staleTime: 60 * 1000,
    retry: false,
    queryKey: ['smsChat', deviceId, regId2 as string, address],
    enabled: !!regId2,
    queryFn: async ({ queryKey }) => {
      const [_, deviceId, regId2] = queryKey
      return await window.api.smsChat(deviceId, regId2, address)
    },
  })
}

function RouteComponent() {
  const { address } = Route.useSearch()
  const { deviceId } = Route.useParams()
  const { data: devices } = useDevices()
  const regId2 = devices?.records.find((device) => device.deviceId === deviceId)?.regId2

  const { data: smsChat, isPending, isError, error } = useSmsChat(deviceId, regId2, address)

  if (isPending) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  }

  return (
    <div>
      <pre>{JSON.stringify(smsChat)}</pre>
    </div>
  )
}
