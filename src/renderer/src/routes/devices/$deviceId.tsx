import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/devices/$deviceId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { deviceId } = Route.useParams()
  return <div>Hello /devices/{deviceId}!</div>
}
