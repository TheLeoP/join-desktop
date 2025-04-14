import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
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

  if (isPending) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  }

  return <div>{JSON.stringify(history)}</div>
}
