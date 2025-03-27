import { queryClient, SmsInfo, useContacts, useDevices } from '@renderer/util'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { zodValidator } from '@tanstack/zod-adapter'
import { PhotoOrChar } from '@renderer/components'
import { useEffect, useRef, useState } from 'react'
import * as svg from '@renderer/svgs'

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

function useSendSms(deviceId: string, regId2: string | undefined, address: string) {
  return useMutation<
    unknown,
    Error,
    {
      smsmessage: string
    }
  >({
    mutationFn: async ({ smsmessage }) => {
      if (!regId2) return

      await window.api.smsSend(deviceId, regId2, address, smsmessage)
    },
    onMutate: async ({ smsmessage }) => {
      await queryClient.cancelQueries({
        queryKey: ['smsChat', deviceId, regId2, address],
      })

      queryClient.setQueryData(['smsChat', deviceId, regId2, address], (old: SmsInfo[]) => {
        const newValue = [...old]
        newValue.push({
          address: address,
          date: Date.now(),
          id: (old[old.length - 1].id + 1).toString(),
          isMMS: false,
          received: false,
          text: smsmessage,
        })
        return newValue
      })
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

  const endOfList = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    endOfList.current?.scrollIntoView()
  }, [smsChat])

  const [message, setMessage] = useState<string>('')
  const { mutate: sendSms } = useSendSms(deviceId, regId2, address)
  const form = useRef<HTMLFormElement | null>(null)

  if (isPending) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  }

  const header = isPendingContacts ? (
    <div>Loading...</div>
  ) : isErrorContacts ? (
    <div>Error: {errorContacts.message}</div>
  ) : (
    <>
      <PhotoOrChar photo={contact?.photo} char={(contact?.name ?? address).substring(0, 1)} />
      <h1 className="text-4xl">{contact?.name ?? address}</h1>
    </>
  )

  return (
    <div className="relative flex h-[calc(100vh-45px)] flex-col">
      <div className="mx-auto my-1 flex h-20 w-fit items-center justify-center space-x-1 rounded-md bg-orange-100 p-2">
        {header}
      </div>
      <div className="absolute top-22 bottom-20 mx-1 flex w-[calc(100%-4px)] flex-col space-y-4 overflow-auto">
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
                    className="rounded-md bg-orange-100 p-2 text-xl break-words whitespace-pre-line data-received:bg-orange-200"
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
        <div ref={endOfList}></div>
      </div>

      <form
        ref={form}
        className="absolute fixed bottom-0 flex h-20 w-full items-center justify-center space-x-2 border-t bg-orange-200"
        onSubmit={async (e) => {
          e.preventDefault()
          if (message === '' || !regId2) return

          console.log(message)
          // TODO:  refetch in success? too expensive? only local network?
          sendSms({ smsmessage: message })
          setMessage('')
        }}
      >
        <textarea
          autoFocus
          className="text-md h-5/7 w-6/7 resize-none appearance-none rounded-md border bg-white px-3 py-3 leading-tight shadow focus:outline-none"
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (!form.current) return
            if (e.code !== 'Enter') return
            if (e.ctrlKey) return setMessage((message) => message + '\n')
            e.preventDefault()
            form.current.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
          }}
          value={message}
        />
        <button className="cursor-pointer rounded-full bg-white p-4 hover:fill-gray-500 active:fill-gray-700">
          <svg.Send />
        </button>
      </form>
    </div>
  )
}
