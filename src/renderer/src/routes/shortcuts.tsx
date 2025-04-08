import { useShortcuts } from '@renderer/util'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

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
      className="mt-1 flex flex-col items-center justify-center space-y-1"
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
        await window.api.shortcutsSave(shortcuts)
        setShortcuts(shortcuts)
      }}
    >
      <table className="w-1/3 text-2xl">
        <thead className="bg-orange-200">
          <tr>
            <th>Keyboard shortcut</th>
            <th>Action</th>
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
                    className="cursor-pointer rounded-md bg-red-600 p-1 text-white hover:bg-red-700 active:bg-red-800"
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
        <button className="cursor-pointer rounded-md bg-orange-200 p-4 text-2xl hover:bg-orange-300 active:bg-orange-400">
          Save
        </button>
        <button
          className="cursor-pointer rounded-md bg-orange-200 p-4 text-2xl hover:bg-orange-300 active:bg-orange-400"
          onClick={(e) => {
            e.preventDefault()
            setShortcuts((shortcuts) => new Map(shortcuts.set('', '')))
          }}
        >
          New
        </button>
      </div>
    </form>
  )
}
