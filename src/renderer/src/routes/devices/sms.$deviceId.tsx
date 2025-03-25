import { useContacts, useDevices } from '@renderer/util'
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
  const {
    data: contacts,
    isPending: isPendingContacts,
    isError: isErrorContacts,
    error: errorContacts,
  } = useContacts(deviceId, regId2)

  if (isPending || isPendingContacts) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  } else if (isErrorContacts) {
    return <div>Error: {errorContacts.message}</div>
  }

  return (
    <div className="ms-1 flex flex-wrap space-y-1 space-x-1">
      {sms.map((sms) => {
        const contact = contacts.find((contact) => contact.number === sms.address)
        return (
          <div
            key={sms.id}
            className="h-20 w-[calc(20%-4px)] items-center space-x-1 truncate bg-orange-100"
          >
            <div className="text-xl font-bold">{contact ? contact.name : sms.address}</div>
            {/* TODO: better date format */}
            <div className="text-gray-400">{new Date(sms.date).toString()}</div>
            <div className="text-wrap">
              <span className="font-bold">{!sms.received && 'You: '}</span>
              {sms.text}
            </div>
          </div>
        )
      })}
    </div>
  )
}
