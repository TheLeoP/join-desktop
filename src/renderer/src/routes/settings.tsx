import { Switch } from '@renderer/components/ui/switch'
import { useSettings } from '@renderer/util'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  const [settings, setSettings] = useSettings()

  return (
    <form
      className="mt-1 flex flex-col items-center justify-center space-y-1"
      onSubmit={(e) => {
        e.preventDefault()

        window.api.settingsSave(settings)
      }}
    >
      <div className="flex min-h-80 min-w-100 flex-col items-center rounded-md bg-orange-100 p-2">
        <label className="cursor-pointer text-xl">
          Autostart
          <Switch
            className="ms-2"
            checked={settings.autostart}
            onCheckedChange={(checked) => {
              setSettings((old) => ({ ...old, autostart: checked }))
            }}
          ></Switch>
        </label>
      </div>
      <button className="cursor-pointer rounded-md bg-orange-200 p-4 text-2xl hover:bg-orange-300 active:bg-orange-400">
        Save
      </button>
    </form>
  )
}
