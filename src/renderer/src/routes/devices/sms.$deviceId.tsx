import { useDevices } from '@renderer/util'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

type SmsThreadInfo = {
  address: string
  date: number
  isMMS: boolean
  received: boolean
  text: string
  id: string // it's a number on a string
}

export const Route = createFileRoute('/devices/sms/$deviceId')({
  component: RouteComponent,
})

function useSms(deviceId: string, regId2: string | undefined) {
  return useQuery<SmsThreadInfo[], Error, SmsThreadInfo[], readonly string[]>({
    staleTime: 60 * 1000,
    // TODO: allow retrying all queries
    retry: false,
    queryKey: ['sms', deviceId, regId2 as string],
    enabled: !!regId2,
    queryFn: async ({ queryKey }) => {
      const [_, deviceId, regId2] = queryKey
      return await window.api.sms(deviceId, regId2)
    },
  })
}

function RouteComponent() {
  const { deviceId } = Route.useParams()
  const { data: devices } = useDevices()
  const regId2 = devices?.records.find((device) => device.deviceId === deviceId)?.regId2

  const { data: sms, isPending, isError, error } = useSms(deviceId, regId2)

  if (isPending) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  }

  return (
    <div>
      <pre>{JSON.stringify(sms)}</pre>
    </div>
  )
}
