import { useDevices } from '@renderer/util'
import * as svg from '@renderer/svgs'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/devices/contacts/$deviceId')({
  component: RouteComponent,
})

type ContactInfo = {
  name: string
  number: string
  photo: string
}

function useContacts(deviceId: string, regId2: string | undefined) {
  return useQuery<ContactInfo[], Error, ContactInfo[], readonly string[]>({
    staleTime: 60 * 1000,
    // TODO: allow retrying all queries
    retry: false,
    queryKey: ['contacts', deviceId, regId2 as string],
    enabled: !!regId2,
    queryFn: async ({ queryKey }) => {
      const [_, deviceId, regId2] = queryKey
      return await window.api.contacts(deviceId, regId2)
    },
  })
}

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
    <div className="flex flex-wrap space-y-1 space-x-1">
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
          <button className="ms-auto rounded-md bg-orange-200 stroke-black hover:stroke-gray-600 active:stroke-gray-400">
            <svg.Phone className="h-15 w-15" />
          </button>
        </div>
      ))}
    </div>
  )
}
