import { Switch } from '@renderer/components/ui/switch'
import { useSettings } from '@renderer/util'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

export const Route = createFileRoute('/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  const [settings, setSettings] = useSettings()

  if (!settings) {
    return <div>Loading...</div>
  }

  return (
    <form
      className="flex h-[calc(100vh-45px)] flex-col items-center space-y-1 bg-white pt-1 text-black dark:bg-neutral-800 dark:text-white"
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

        toast.promise(window.api.settingsSave(newSettings), {
          loading: 'Saving settings',
          success: 'Settings have been saved correctly',
          error: 'There was an error while saving settings',
        })
        setSettings(newSettings)
      }}
    >
      <div className="min-w-200 space-y-1">
        <div className="flex flex-col items-center rounded-md bg-orange-100 p-2 dark:bg-orange-400">
          <h1 className="text-2xl font-bold">General</h1>
          <hr className="w-full" />
          <label className="block w-full cursor-pointer text-xl">
            <span className="">Autostart:</span>
            <Switch
              className="ms-2"
              checked={settings.autostart}
              onCheckedChange={(checked) => {
                setSettings((old) => {
                  if (!old) return old

                  return {
                    ...old,
                    autostart: checked,
                  }
                })
              }}
            ></Switch>
          </label>
          <label className="block w-full cursor-pointer text-xl">
            <span>Show on start:</span>
            <Switch
              className="ms-2"
              checked={settings.showOnStart}
              onCheckedChange={(checked) => {
                setSettings((old) => {
                  if (!old) return old
                  return {
                    ...old,
                    showOnStart: checked,
                  }
                })
              }}
            ></Switch>
          </label>
          <label className="block w-full cursor-pointer text-xl">
            <span>Select device labels:</span>
            <textarea
              className="text-md min-h-50 w-full resize-none appearance-none rounded-md border bg-white px-3 py-2 leading-tight text-black shadow focus:outline-none dark:bg-neutral-800 dark:text-white"
              value={settings.safeKeys}
              onChange={(e) => {
                setSettings((old) => {
                  if (!old) return old

                  return { ...old, safeKeys: e.target.value }
                })
              }}
            />
          </label>
        </div>
        <div className="flex flex-col items-center rounded-md bg-orange-100 p-2 dark:bg-orange-400">
          <h1 className="text-2xl font-bold">Scripts</h1>
          <hr className="w-full" />

          <table className="w-full bg-white text-2xl text-black dark:bg-neutral-800 dark:text-white">
            <thead className="bg-orange-200 dark:bg-orange-500">
              <tr>
                <th>Command</th>
                <th>Script</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
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
                          setSettings((old) => {
                            if (!old) return old

                            old.scripts.delete(command)
                            return { ...old }
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
            className="mt-1 cursor-pointer rounded-md bg-orange-200 p-4 text-2xl hover:bg-orange-300 active:bg-orange-400 dark:bg-orange-500 dark:hover:bg-orange-600 dark:active:bg-orange-700"
            onClick={(e) => {
              e.preventDefault()
              // TODO: this only allows me to add one new scritp at a time
              setSettings((old) => {
                if (!old) return old
                return {
                  ...old,
                  scripts: old.scripts.set('', ''),
                }
              })
            }}
          >
            New script
          </button>
        </div>
      </div>
      <button className="cursor-pointer rounded-md bg-orange-200 p-4 text-2xl hover:bg-orange-300 active:bg-orange-400 dark:bg-orange-500 dark:hover:bg-orange-600 dark:active:bg-orange-700">
        Save
      </button>
    </form>
  )
}
