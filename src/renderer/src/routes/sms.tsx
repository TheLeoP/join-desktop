import {
  contactsQueryOptions,
  queryClient,
  smsQueryOptions,
  useContacts,
  useOnLocalNetwork,
  useSms,
} from '@renderer/util'
import { createFileRoute, Link } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'

const searchSchema = z.object({
  regId2: z.string(),
  deviceId: z.string(),
  onLocalNetwork: z.boolean(),
})

export const Route = createFileRoute('/sms')({
  component: RouteComponent,
  loaderDeps: ({ search: { regId2, deviceId, onLocalNetwork } }) => ({
    regId2,
    deviceId,
    onLocalNetwork,
  }),
  loader: async ({ deps: { regId2, deviceId, onLocalNetwork } }) => {
    queryClient.ensureQueryData(contactsQueryOptions(deviceId, regId2, onLocalNetwork))
    queryClient.ensureQueryData(smsQueryOptions(deviceId, regId2, onLocalNetwork))
  },
  validateSearch: zodValidator(searchSchema),
})

function RouteComponent() {
  const { regId2, deviceId, onLocalNetwork } = Route.useSearch()

  const { data: sms, isPending, isError, error } = useSms(deviceId, regId2, onLocalNetwork)
  const {
    data: contacts,
    isPending: isPendingContacts,
    isError: isErrorContacts,
    error: errorContacts,
  } = useContacts(deviceId, regId2, onLocalNetwork)

  if (isPending || isPendingContacts) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  } else if (isErrorContacts) {
    return <div>Error: {errorContacts.message}</div>
  }

  return (
    <div className="ms-1 flex flex-wrap space-y-1 space-x-1">
      {sms
        .sort((a, b) => b.date - a.date)
        .map((sms) => {
          const contact = contacts.find((contact) => contact.number === sms.address)

          return (
            <Link
              to="/smsChat"
              from="/sms"
              search={{ address: sms.address, regId2, deviceId, onLocalNetwork }}
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
