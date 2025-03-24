import { useDevices } from '@renderer/util'
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
  return useQuery<ContactInfo, Error, ContactInfo, readonly string[]>({
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
    <div>
      <pre>{JSON.stringify(contacts)}</pre>
    </div>
  )
}
