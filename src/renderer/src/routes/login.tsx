import { Google } from '@renderer/svgs'
import { useIsLoggedIn, useDeviceId } from '@renderer/util'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

function LogIn() {
  const isLoggedIn = useIsLoggedIn()
  const deviceId = useDeviceId()

  const [deviceName, setDeviceName] = useState<string>('')

  return (
    // TODO: change h-screen with header?
    <div className="flex h-screen flex-col">
      <h1 className="pt-10 text-center text-9xl">Join Desktop</h1>
      {!isLoggedIn && (
        <div className="flex grow flex-col items-center justify-center">
          <button
            className="flex cursor-pointer items-center justify-center space-x-2 rounded-md bg-orange-200 p-4 hover:bg-orange-300 active:bg-orange-400"
            onClick={window.api.logInWithGoogle}
          >
            <Google className="w-10" />
            <p className="text-4xl">Log in with Google</p>
          </button>
        </div>
      )}

      {isLoggedIn && !deviceId && (
        <form
          className="flex grow items-center justify-center"
          onSubmit={async (e) => {
            e.preventDefault()
            if (deviceName === '') return
            await window.api.registerDevice(deviceName)
            setDeviceName('')
          }}
        >
          <div className="flex w-full max-w-xs flex-col space-y-2 rounded-md bg-orange-200 p-10 shadow-md">
            <label>
              <p className="text-2xl font-bold">Device name</p>
              <input
                placeholder="PC"
                className="w-full appearance-none border px-3 py-2 leading-tight shadow focus:outline-none"
                type="text"
                onChange={(e) => {
                  setDeviceName(e.target.value)
                }}
                value={deviceName}
              />
            </label>

            <button className="mt-8 cursor-pointer rounded-md bg-white p-2 text-2xl hover:bg-gray-50 active:bg-gray-100">
              Register device
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export const Route = createFileRoute('/login')({
  component: LogIn,
})
