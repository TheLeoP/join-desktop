import { SmsInfo, useContacts, useDevices } from '@renderer/util'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { zodValidator } from '@tanstack/zod-adapter'
import { PhotoOrChar } from '@renderer/components'

const searchSchema = z.object({ address: z.string(), name: z.string() })

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
  const {
    data: contacts,
    isPending: isPendingContacts,
    isError: isErrorContacts,
    error: errorContacts,
  } = useContacts(deviceId, regId2)
  const contact = contacts?.find((contact) => contact.number === address)

  if (isPending) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  }

  return (
    <div className="">
      {contact && (
        <div className="mx-auto my-1 flex w-fit items-center justify-center space-x-1 rounded-md bg-orange-100 p-2">
          <PhotoOrChar photo={contact.photo} char={contact.name.substring(0, 1)} />
          <h1 className="text-4xl">{contact.name}</h1>
        </div>
      )}
      <div className="mx-1 flex flex-col space-y-4">
        {smsChat
          .sort((a, b) => a.date - b.date)
          .map((message) => {
            return (
              <div
                key={message.id}
                className="flex w-full justify-end text-right data-received:justify-start data-received:text-left"
                data-received={message.received ? true : undefined}
              >
                <div className="max-w-5/7">
                  <div
                    data-received={message.received ? true : undefined}
                    className="rounded-md bg-orange-100 p-2 text-xl break-words data-received:bg-orange-200"
                  >
                    {message.text}
                  </div>
                  {/* TODO: better date format */}
                  <div className="mt-2 text-xs text-gray-400">
                    {new Date(message.date).toString()}
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
