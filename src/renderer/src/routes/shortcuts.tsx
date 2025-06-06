import { useShortcuts } from '@renderer/util'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

export const Route = createFileRoute('/shortcuts')({
  component: RouteComponent,
})

function RouteComponent() {
  const [shortcuts, setShortcuts] = useShortcuts()

  const {
    data: actions,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['actions'],
    queryFn: async () => {
      return await window.api.actions()
    },
  })

  if (!shortcuts || isPending) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  }

  return (
    <form
      className="flex h-[calc(100vh-45px)] flex-col items-center space-y-1 bg-white pt-1 text-black dark:bg-neutral-800 dark:text-white"
      onSubmit={async (e) => {
        e.preventDefault()

        const formData = new FormData(e.currentTarget)
        const shortcuts = new Map<string, string>()
        let currentShortcut: string | undefined
        for (const [key, value] of formData.entries()) {
          if (key === 'shortcut' && typeof value === 'string') {
            currentShortcut = value
          } else if (key === 'action' && currentShortcut && typeof value === 'string') {
            if (currentShortcut === '') continue

            shortcuts.set(currentShortcut, value)
          }
        }

        toast.promise(window.api.shortcutsSave(shortcuts), {
          loading: 'Saving shortcuts',
          success: 'Shortcuts have been saved correctly',
          error: 'There was an error while saving shortcuts',
        })

        setShortcuts(shortcuts)
      }}
    >
      <table className="max-w-3/4 min-w-2/3 text-2xl">
        <thead className="bg-orange-200 dark:bg-orange-400">
          <tr>
            <th>Keyboard shortcut</th>
            <th>Action</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {[...shortcuts.keys()].map((shortcut, i) => {
            const selectedAction = shortcuts.get(shortcut)
            return (
              <tr key={i}>
                <td>
                  <input
                    name="shortcut"
                    type="text"
                    defaultValue={shortcut}
                    className="w-full appearance-none border px-2 py-2 leading-tight shadow focus:outline-none"
                  />
                </td>
                <td>
                  <select defaultValue={selectedAction} className="w-full" name="action">
                    {actions.map((action) => (
                      <option value={action} key={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    className="m-1 cursor-pointer rounded-md bg-red-600 p-1 text-white hover:bg-red-700 active:bg-red-800"
                    onClick={(e) => {
                      e.preventDefault()
                      setShortcuts((shortcuts) => {
                        shortcuts.delete(shortcut)
                        return new Map(shortcuts)
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
      <div className="flex space-x-1">
        <button className="cursor-pointer rounded-md bg-orange-200 p-4 text-2xl hover:bg-orange-300 active:bg-orange-400 dark:bg-orange-500 dark:hover:bg-orange-600 dark:active:bg-orange-700">
          Save
        </button>
        <button
          className="cursor-pointer rounded-md bg-orange-200 p-4 text-2xl hover:bg-orange-300 active:bg-orange-400 dark:bg-orange-500 dark:hover:bg-orange-600 dark:active:bg-orange-700"
          onClick={(e) => {
            e.preventDefault()
            // TODO: this only allows me to add one new shortcut at a time
            setShortcuts((shortcuts) => new Map(shortcuts.set('', '')))
          }}
        >
          New
        </button>
      </div>
    </form>
  )
}
