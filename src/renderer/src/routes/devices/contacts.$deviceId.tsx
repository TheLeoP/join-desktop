import { contactsQueryOptions, queryClient, useContacts } from '@renderer/util'
import * as svg from '@renderer/svgs'
import { createFileRoute } from '@tanstack/react-router'
import { PhotoOrChar } from '@renderer/components'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'

const searchSchema = z.object({
  regId2: z.string(),
})

export const Route = createFileRoute('/devices/contacts/$deviceId')({
  component: RouteComponent,
  loaderDeps: ({ search: { regId2 } }) => ({ regId2 }),
  loader: async ({ params: { deviceId }, deps: { regId2 } }) => {
    queryClient.ensureQueryData(contactsQueryOptions(deviceId, regId2))
  },
  validateSearch: zodValidator(searchSchema),
})

function RouteComponent() {
  const { deviceId } = Route.useParams()
  const { regId2 } = Route.useSearch()

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
          <PhotoOrChar photo={contact.photo} char={contact.name.substring(0, 1)} />
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
