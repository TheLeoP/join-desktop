import { contactsQueryOptions, queryClient, useContacts } from '@renderer/util'
import * as svg from '@renderer/svgs'
import { createFileRoute } from '@tanstack/react-router'
import { PhotoOrChar } from '@renderer/components'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'

const searchSchema = z.object({
  regId2: z.string(),
  deviceId: z.string(),
  onLocalNetwork: z.boolean(),
})

export const Route = createFileRoute('/contacts')({
  component: RouteComponent,
  loaderDeps: ({ search: { regId2, deviceId, onLocalNetwork } }) => ({
    regId2,
    deviceId,
    onLocalNetwork,
  }),
  loader: async ({ deps: { regId2, deviceId, onLocalNetwork } }) => {
    queryClient.ensureQueryData(contactsQueryOptions(deviceId, regId2, onLocalNetwork))
  },
  validateSearch: zodValidator(searchSchema),
})

function RouteComponent() {
  const { regId2, deviceId, onLocalNetwork } = Route.useSearch()

  const {
    data: contacts,
    isPending,
    isError,
    error,
  } = useContacts(deviceId, regId2, onLocalNetwork)

  if (isPending) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  }

  return (
    <div className="h-[calc(100vh-45px)] bg-white ps-1 pt-1 text-black dark:bg-neutral-800 dark:text-white">
      <div className="flex flex-wrap space-y-1 space-x-1">
        {contacts.map((contact) => (
          <div
            key={contact.number}
            className="flex h-24 w-[calc(20%-4px)] items-center space-x-1 bg-orange-100 px-1 dark:bg-orange-400"
          >
            <PhotoOrChar photo={contact.photo} char={contact.name.substring(0, 1)} />
            <div className="flex w-2/5 flex-col justify-center">
              <h2 className="truncate text-xl">{contact.name}</h2>
              <h3 className="text-md">{contact.number}</h3>
            </div>
            <button
              className="ms-auto rounded-md bg-orange-200 stroke-black hover:stroke-gray-500 active:stroke-gray-400 dark:bg-orange-600 dark:hover:stroke-gray-200 dark:active:stroke-gray-100"
              onClick={() => {
                if (!regId2) return

                window.api.call(deviceId, regId2, contact.number)
              }}
            >
              <svg.Phone className="h-15 w-15" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
