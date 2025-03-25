import { useContacts, useDevices } from '@renderer/util'
import * as svg from '@renderer/svgs'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/devices/contacts/$deviceId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { deviceId } = Route.useParams()
  const { data: devices } = useDevices()
  const regId2 = devices?.records.find((device) => device.deviceId === deviceId)?.regId2

  const { data: contacts, isPending, isError, error } = useContacts(deviceId, regId2)

  if (isPending) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  }

  return (
    <div className="ms-1 flex flex-wrap space-y-1 space-x-1">
      {contacts.map((contact) => (
        <div
          key={contact.number}
          className="flex w-[calc(20%-4px)] items-center space-x-1 bg-orange-100"
        >
          {contact.photo ? (
            <img className="h-20 w-20" src={contact.photo} />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center bg-orange-400 text-center text-6xl text-white">
              {contact.name.substring(0, 1)}
            </div>
          )}
          <div className="flex w-2/5 flex-col justify-center">
            <h2 className="truncate text-xl">{contact.name}</h2>
            <h3 className="text-md">{contact.number}</h3>
          </div>
          <button
            className="ms-auto rounded-md bg-orange-200 stroke-black hover:stroke-gray-500 active:stroke-gray-400"
            onClick={() => {
              if (!regId2) return

              window.api.call(contact.number, regId2)
            }}
          >
            <svg.Phone className="h-15 w-15" />
          </button>
        </div>
      ))}
    </div>
  )
}
