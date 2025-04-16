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
      className="mt-1 flex min-w-100 flex-col items-center justify-center space-y-1"
      onSubmit={(e) => {
        e.preventDefault()

        const formData = new FormData(e.currentTarget)
        const scripts = new Map<string, string>()
        let currentScript: string | undefined
        for (const [key, value] of formData.entries()) {
          if (key === 'command' && typeof value === 'string') {
            currentScript = value
          } else if (key === 'script' && currentScript && typeof value === 'string') {
            if (currentScript === '') continue

            scripts.set(currentScript, value)
          }
        }

        const newSettings = { ...settings, scripts }
        window.api.settingsSave(newSettings)
        setSettings(newSettings)
      }}
    >
      <div className="min-w-100 space-y-1">
        <div className="flex flex-col items-center rounded-md bg-orange-100 p-2">
          <h1 className="text-2xl font-bold">General</h1>
          <hr className="w-full" />
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
        <div className="flex flex-col items-center rounded-md bg-orange-100 p-2">
          <h1 className="text-2xl font-bold">Scripts</h1>
          <hr className="w-full" />

          <table className="w-full bg-white text-2xl">
            <thead className="bg-orange-200">
              <tr>
                <th>Command</th>
                <th>Script</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="h-10">
              {[...settings.scripts.keys()].map((command, i) => {
                const script = settings.scripts.get(command)
                return (
                  <tr key={i}>
                    <td>
                      <input
                        name="command"
                        defaultValue={command}
                        type="text"
                        className="w-full appearance-none border px-2 py-2 leading-tight shadow focus:outline-none"
                      />
                    </td>
                    <td>
                      <input
                        name="script"
                        defaultValue={script}
                        type="text"
                        className="w-full appearance-none border px-2 py-2 leading-tight shadow focus:outline-none"
                      />
                    </td>

                    <td>
                      <button
                        className="m-1 cursor-pointer rounded-md bg-red-600 p-1 text-white hover:bg-red-700 active:bg-red-800"
                        onClick={(e) => {
                          e.preventDefault()
                          setSettings((settings) => {
                            settings.scripts.delete(command)
                            return { ...settings }
                          })
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <button
            className="mt-1 cursor-pointer rounded-md bg-orange-200 p-4 text-2xl hover:bg-orange-300 active:bg-orange-400"
            onClick={(e) => {
              e.preventDefault()
              // TODO: this only allows me to add one new scritp at a time
              setSettings((old) => ({ ...old, scripts: old.scripts.set('', '') }))
            }}
          >
            New script
          </button>
        </div>
      </div>
      <button className="cursor-pointer rounded-md bg-orange-200 p-4 text-2xl hover:bg-orange-300 active:bg-orange-400">
        Save
      </button>
    </form>
  )
}
