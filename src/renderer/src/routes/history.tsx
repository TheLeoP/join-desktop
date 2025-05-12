import { historyOptions, queryClient, useHistory } from '@renderer/util'
import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useRef, useEffect } from 'react'
import { z } from 'zod'

const searchSchema = z.object({
  deviceId: z.string(),
})

export const Route = createFileRoute('/history')({
  component: RouteComponent,
  loaderDeps: ({ search: { deviceId } }) => ({ deviceId }),
  loader: async ({ deps: { deviceId } }) => {
    queryClient.ensureQueryData(historyOptions(deviceId))
  },
  validateSearch: zodValidator(searchSchema),
})

function RouteComponent() {
  const { deviceId } = Route.useSearch()
  const { data: history, isPending, isError, error } = useHistory(deviceId)

  const endOfList = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    endOfList.current?.scrollIntoView()
  }, [history])

  if (isPending) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  }

  return (
    <div className="flex h-[calc(100vh-45px)] flex-col space-y-1 space-x-1 overflow-y-auto bg-white ps-1 pt-1 text-black dark:bg-neutral-800 dark:text-white">
      {history.map((push, i) => (
        <pre key={i} className="bg-orange-100 break-all whitespace-pre-wrap dark:bg-orange-400">
          {JSON.stringify(push, null, 2)}
        </pre>
      ))}
      <div ref={endOfList}></div>
    </div>
  )
}
