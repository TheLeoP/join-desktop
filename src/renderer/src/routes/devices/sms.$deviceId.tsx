import { useContacts, useDevices, useSms } from '@renderer/util'
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/devices/sms/$deviceId')({
  component: RouteComponent,
})

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
      {/* TODO: order sms before showing them */}
      {sms.map((sms) => {
        const contact = contacts.find((contact) => contact.number === sms.address)

        return (
          // TODO: use more search params instead of path params? pass regId2 as a search param
          <Link
            to="/devices/smsChat/$deviceId"
            from="/devices/sms/$deviceId"
            search={{ address: sms.address }}
            key={sms.id}
            className="h-20 w-[calc(20%-4px)] items-center space-x-1 truncate bg-orange-100"
          >
            <div className="text-xl font-bold">{contact?.name ?? sms.address}</div>
            {/* TODO: better date format */}
            <div className="text-gray-400">{new Date(sms.date).toString()}</div>
            <div className="text-wrap">
              <span className="font-bold">{!sms.received && 'You: '}</span>
              {sms.text}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
