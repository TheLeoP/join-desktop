import { contactsQueryOptions, queryClient } from '@renderer/util'
import { queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { zodValidator } from '@tanstack/zod-adapter'
import { PhotoOrChar } from '@renderer/components'
import { useEffect, useRef, useState } from 'react'
import * as svg from '@renderer/svgs'
import type { SmsInfo } from 'src/preload/types'
import Linkify from 'linkify-react'

const searchSchema = z.object({
  address: z.string(),
  regId2: z.string(),
  deviceId: z.string(),
  onLocalNetwork: z.boolean(),
  contact: z
    .object({
      name: z.string(),
      number: z.string(),
      photo: z.string().optional(),
    })
    .optional(),
})

export const Route = createFileRoute('/smsChat')({
  component: RouteComponent,
  loaderDeps: ({ search: { address, regId2, deviceId, onLocalNetwork } }) => ({
    address,
    regId2,
    deviceId,
    onLocalNetwork,
  }),
  loader: async ({ deps: { address, regId2, deviceId, onLocalNetwork } }) => {
    queryClient.ensureQueryData(smsChatOptions(deviceId, regId2, address, onLocalNetwork))
    await queryClient.ensureQueryData(contactsQueryOptions(deviceId, regId2, onLocalNetwork))
  },
  validateSearch: zodValidator(searchSchema),
})

function smsChatOptions(
  deviceId: string,
  regId2: string,
  address: string,
  onLocalNetwork: boolean,
) {
  return queryOptions<SmsInfo[], Error, SmsInfo[], readonly ['smsChat', string, string, string]>({
    staleTime: onLocalNetwork ? 0 : 60 * 1000,
    queryKey: ['smsChat', deviceId, regId2, address],
    queryFn: async ({ queryKey }) => {
      const [_, deviceId, regId2] = queryKey
      return await window.api.smsChat(deviceId, regId2, address)
    },
  })
}

function useSmsChat(deviceId: string, regId2: string, address: string, onLocalNetwork: boolean) {
  return useQuery(smsChatOptions(deviceId, regId2, address, onLocalNetwork))
}

function useSmsSend(deviceId: string, regId2: string, smsnumber: string, onLocalNetwork: boolean) {
  return useMutation<
    unknown,
    Error,
    {
      smstext: string
    },
    {
      previousSmsInfo: SmsInfo
    }
  >({
    mutationFn: async ({ smstext }) => {
      if (!regId2) return

      await window.api.smsSend(deviceId, regId2, smsnumber, smstext)
    },
    onMutate: async ({ smstext }) => {
      await queryClient.cancelQueries({
        queryKey: ['smsChat', deviceId, regId2, smsnumber],
      })

      const previousSmsInfo = queryClient.getQueryData(['smsChat', deviceId, regId2]) as SmsInfo

      queryClient.setQueryData(['smsChat', deviceId, regId2, smsnumber], (old: SmsInfo[]) => {
        const newValue = [...old]
        newValue.push({
          address: smsnumber,
          date: Date.now(),
          id: (old[old.length - 1].id + 1).toString(),
          isMMS: false,
          received: false,
          text: smstext,
        })
        return newValue
      })

      return { previousSmsInfo }
    },
    onError: (_err, _mediaAction, context) => {
      if (!context) return

      queryClient.setQueryData(['smsChat', deviceId, regId2, smsnumber], context.previousSmsInfo)
    },
    onSettled: () => {
      // NOTE: the Join Android app needs time to update the information, so don't invalidate right away
      setTimeout(
        () => {
          queryClient.invalidateQueries({ queryKey: ['smsChat', deviceId, regId2, smsnumber] })
        },
        1000 * (onLocalNetwork ? 1 : 10),
      )
    },
  })
}

function RouteComponent() {
  const { address, regId2, deviceId, onLocalNetwork, contact } = Route.useSearch()

  const {
    data: smsChat,
    isPending,
    isError,
    error,
  } = useSmsChat(deviceId, regId2, address, onLocalNetwork)

  const endOfList = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    endOfList.current?.scrollIntoView()
  }, [smsChat])

  const [message, setMessage] = useState<string>('')
  const { mutate: smsSend } = useSmsSend(deviceId, regId2, address, onLocalNetwork)
  const form = useRef<HTMLFormElement | null>(null)

  const messages = isPending ? (
    <div>Loading...</div>
  ) : isError ? (
    <div>Error: {error.message}</div>
  ) : (
    <>
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
                  <Linkify
                    options={{
                      target: '_blank',
                      attributes: { rel: 'noreferrer' },
                      className: 'text-blue-600 hover:underline',
                    }}
                  >
                    {message.text}
                  </Linkify>
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {new Date(message.date).toString()}
                </div>
              </div>
            </div>
          )
        })}
    </>
  )

  return (
    <div className="relative flex h-[calc(100vh-45px)] flex-col">
      <div className="mx-auto my-1 flex h-20 w-fit items-center justify-center space-x-1 rounded-md bg-orange-100 p-2">
        <PhotoOrChar photo={contact?.photo} char={(contact?.name ?? address).substring(0, 1)} />
        <h1 className="max-w-lg truncate text-4xl">{contact?.name ?? address}</h1>
      </div>
      <div className="absolute top-22 bottom-20 mx-1 flex w-[calc(100%-4px)] flex-col space-y-4 overflow-auto">
        {messages}
        <div ref={endOfList}></div>
      </div>

      <form
        ref={form}
        className="absolute bottom-0 flex h-20 w-full items-center justify-center space-x-2 border-t bg-orange-200"
        onSubmit={async (e) => {
          e.preventDefault()
          if (message === '' || !regId2) return

          smsSend({ smstext: message })
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
