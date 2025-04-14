import { useQuery } from '@tanstack/react-query'
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
  // TODO: add loader
  validateSearch: zodValidator(searchSchema),
})

function RouteComponent() {
  const { deviceId } = Route.useSearch()
  const {
    data: history,
    isPending,
    isError,
    error,
  } = useQuery({
    queryFn: ({ queryKey }) => {
      const [_, deviceId] = queryKey
      return window.api.pushHistory(deviceId)
    },
    queryKey: ['pushHistory', deviceId],
  })

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
    <div className="ms-1 mt-1 flex h-[calc(100vh-49px)] flex-col space-y-1 space-x-1 overflow-y-auto">
      {history.map((push, i) => (
        <pre key={i} className="bg-orange-100">
          {JSON.stringify(push, null, 2)}
        </pre>
      ))}
      <div ref={endOfList}></div>
    </div>
  )
}
