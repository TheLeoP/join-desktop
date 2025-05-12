import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@renderer/components/ui/alert-dialog'
import * as svg from '@renderer/svgs'
import {
  devicesQueryOptions,
  DeviceType,
  queryClient,
  ReverseDeviceType,
  useDeviceId,
  useDevices,
  useOnLocalNetwork,
} from '@renderer/util'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { DeviceInfo, Data } from 'src/preload/types'
import { toast } from 'sonner'

export const Route = createFileRoute('/devices')({
  component: RouteComponent,
  loader: async () => {
    queryClient.ensureQueryData(devicesQueryOptions)
  },
})

function Device({
  thisDeviceId,
  deviceId,
  regId2,
  deviceType,
  deviceName,
}: DeviceInfo & { thisDeviceId: string | null }) {
  const onLocalNetwork = useOnLocalNetwork(deviceId)
  const [name, setName] = useState(deviceName)
  useEffect(() => {
    setName(deviceName)
  }, [deviceName])

  const nameInput = useRef<HTMLInputElement | null>(null)

  const { mutate: renameDevice } = useMutation<
    unknown,
    Error,
    {
      deviceId: string
      name: string
    },
    {
      previousDevices: Data<DeviceInfo>
    }
  >({
    mutationFn: async ({ deviceId, name }) => {
      const promise = window.api.renameDevice(deviceId, name)
      toast.promise(promise, {
        loading: `Renaming device '${deviceName}' to '${name}'`,
        success: `Device succesfully renamed to '${name}'`,
        error: `There was an error while renaming device '${deviceName}' to '${name}'`,
      })
      await promise
    },
    onMutate: async ({ deviceId, name }) => {
      await queryClient.cancelQueries({ queryKey: ['devices'] })

      const previousDevices = queryClient.getQueryData(['devices']) as Data<DeviceInfo>

      queryClient.setQueryData(['devices'], (old: Data<DeviceInfo>) => {
        const newValue = { ...old, records: [...old.records] }
        const changedDevice = newValue.records.find((device) => device.deviceId === deviceId)
        if (changedDevice) changedDevice.deviceName = name

        return newValue
      })

      return { previousDevices }
    },
    onError: (_err, _variables, context) => {
      if (!context) return

      queryClient.setQueryData(['devices'], context.previousDevices)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })
  const { mutate: deleteDevice } = useMutation<
    unknown,
    Error,
    {
      deviceId: string
    },
    {
      previousDevices: Data<DeviceInfo>
    }
  >({
    mutationFn: async ({ deviceId }) => {
      const promise = window.api.deleteDevice(deviceId)
      toast.promise(promise, {
        loading: `Deleting device '${deviceName}'`,
        success: `Device '${deviceName}' succesfully deleted`,
        error: `There was an error while deleting device '${deviceName}'`,
      })
      await promise
    },
    onMutate: async ({ deviceId }) => {
      await queryClient.cancelQueries({ queryKey: ['devices'] })

      const previousDevices = queryClient.getQueryData(['devices']) as Data<DeviceInfo>

      queryClient.setQueryData(['devices'], (old: Data<DeviceInfo>) => ({
        ...old,
        records: old.records.filter((device) => device.deviceId !== deviceId),
      }))

      return { previousDevices }
    },
    onError: (_err, _variables, context) => {
      if (!context) return

      queryClient.setQueryData(['devices'], context.previousDevices)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  })

  return (
    <div className="flex w-60 flex-col items-center space-y-1">
      <img
        src={`./${ReverseDeviceType[deviceType]}.png`}
        className="max-w-40 rounded-full bg-orange-300 p-2 dark:bg-orange-400"
      />
      <form
        className="flex items-center space-x-1"
        onSubmit={(e) => {
          e.preventDefault()
          renameDevice({ deviceId, name })

          if (nameInput.current) nameInput.current.blur()
        }}
      >
        <h2 className="flex text-center text-2xl whitespace-nowrap">
          <input
            ref={nameInput}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
            }}
            className="w-3/4 appearance-none border px-2 py-2 leading-tight shadow focus:outline-none"
          />
          <p className="flex w-1/4 items-center justify-center text-sm text-wrap">
            {thisDeviceId === deviceId ? ' (this device)' : undefined}
            {onLocalNetwork && (
              <svg.LocalNetwork className="h-10 w-10 rounded-full bg-orange-300 fill-white p-1 dark:bg-orange-400" />
            )}
          </p>
        </h2>
      </form>
      <div className="flex w-full flex-col space-y-1">
        <Link
          to="/history"
          search={{ deviceId }}
          from="/devices"
          className="w-full bg-orange-100 text-center text-xl hover:bg-orange-200 dark:bg-orange-500 dark:hover:bg-orange-600"
        >
          History
        </Link>

        <AlertDialog>
          <AlertDialogTrigger className="cursor-pointer bg-red-500 text-xl text-white hover:bg-red-600 active:bg-red-700 dark:bg-red-800/90 dark:hover:bg-red-700/90">
            Delete
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="cursor-pointer"
                onClick={() => {
                  deleteDevice({ deviceId })
                }}
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {(deviceType === DeviceType.android_phone || deviceType === DeviceType.android_tablet) && (
          <>
            <Link
              to="/files"
              search={{ regId2, deviceId, onLocalNetwork }}
              from="/devices"
              className="w-full bg-orange-100 text-center text-xl hover:bg-orange-200 dark:bg-orange-500 dark:hover:bg-orange-600"
            >
              Files
            </Link>
            <Link
              to="/contacts"
              search={{ regId2, deviceId, onLocalNetwork }}
              from="/devices"
              className="w-full bg-orange-100 text-center text-xl hover:bg-orange-200 dark:bg-orange-500 dark:hover:bg-orange-600"
            >
              Contacts
            </Link>
            <Link
              to="/sms"
              search={{ regId2, deviceId, onLocalNetwork }}
              from="/devices"
              className="w-full bg-orange-100 text-center text-xl hover:bg-orange-200 dark:bg-orange-500 dark:hover:bg-orange-600"
            >
              SMS
            </Link>
            <Link
              to="/media"
              search={{ regId2, deviceId, onLocalNetwork }}
              from="/devices"
              className="w-full bg-orange-100 text-center text-xl hover:bg-orange-200 dark:bg-orange-500 dark:hover:bg-orange-600"
            >
              Media
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

function RouteComponent() {
  const deviceId = useDeviceId()
  const { data: devices, error, isPending, isError } = useDevices()

  if (isPending) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  }

  return (
    <div className="flex h-[calc(100vh-45px)] w-full flex-wrap justify-center space-x-1 bg-white p-2 text-black dark:bg-neutral-800 dark:text-white">
      {devices.records.map((device) => (
        <Device key={device.id} {...device} thisDeviceId={deviceId} />
      ))}
    </div>
  )
}
