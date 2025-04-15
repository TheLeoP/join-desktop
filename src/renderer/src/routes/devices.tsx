import * as svg from '@renderer/svgs'
import {
  devicesQueryOptions,
  DeviceType,
  queryClient,
  ReverseDeviceType,
  useDeviceId,
  useDevices,
  useMediaAction,
  useOnLocalNetwork,
} from '@renderer/util'
import { queryOptions, UseMutateFunction, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import debounce from 'lodash.debounce'
import { useEffect, useRef, useState } from 'react'
import { MediaAction, MediaInfo, DeviceInfo } from 'src/preload/types'

export const Route = createFileRoute('/devices')({
  component: RouteComponent,

  loader: async () => {
    queryClient.ensureQueryData(devicesQueryOptions)
  },
})

function Volume({
  max,
  initialValue,
  type,
  deviceId,
  regId2,
}: {
  max: number
  initialValue: number
  type: string
  deviceId: string
  regId2: string
}) {
  const [volume, setVolume] = useState(initialValue)
  const onLocalNetwork = useOnLocalNetwork(deviceId)

  const { mutate: mediaAction } = useMediaAction(deviceId, regId2, onLocalNetwork)
  const debouncedMediaAction = useRef<UseMutateFunction<
    unknown,
    Error,
    {
      action: MediaAction
    },
    unknown
  > | null>(null)
  if (debouncedMediaAction.current === null) {
    debouncedMediaAction.current = debounce(mediaAction, 250)
  }

  return (
    <div className="flex space-x-1">
      <img className="float-left w-5" src={`./${type}.svg`} />
      <input
        className="w-2/3"
        type="range"
        min={0}
        max={max}
        value={volume}
        onChange={(e) => {
          setVolume(+e.target.value)
          if (!debouncedMediaAction.current) return

          debouncedMediaAction.current({ action: { mediaVolume: e.target.value } })
        }}
      />
      <span className="m-auto">{volume}</span>
    </div>
  )
}

function mediaQueryOptions(deviceId: string, regId2: string, onLocalNetwork: boolean) {
  return queryOptions<MediaInfo>({
    staleTime: onLocalNetwork ? 0 : 60 * 1000,
    queryKey: ['mediaInfo', deviceId, regId2, onLocalNetwork],
    queryFn: async () => {
      return await window.api.media(deviceId, regId2)
    },
  })
}

function Media({ deviceId, regId2 }: { deviceId: string; regId2: string }) {
  const onLocalNetwork = useOnLocalNetwork(deviceId)
  const {
    data: mediaInfo,
    error,
    isPending,
    isError,
  } = useQuery(mediaQueryOptions(deviceId, regId2, onLocalNetwork))
  useEffect(
    () => void queryClient.invalidateQueries({ queryKey: ['mediaInfo', deviceId, regId2] }),
    [deviceId, regId2, onLocalNetwork],
  )

  const { mutate: mediaAction } = useMediaAction(deviceId, regId2, onLocalNetwork)

  let info: JSX.Element
  if (isPending) {
    info = <div>Loading...</div>
  } else if (isError) {
    info = <div>Error: {error.message}</div>
  } else {
    info = (
      <div className="space-y-1">
        <Volume
          initialValue={mediaInfo.extraInfo.mediaVolume}
          max={mediaInfo.extraInfo.maxMediaVolume}
          type="media"
          deviceId={deviceId}
          regId2={regId2}
        />
        {mediaInfo.mediaInfosForClients
          .sort((a, b) => b.date - a.date)
          .map((info) => (
            <div key={info.packageName} className="rounded-sm bg-orange-100 p-1">
              <h1 className="text-center text-xl underline">{info.appName}</h1>
              {info.art && (
                <div className="flex flex-col items-center">
                  <img
                    src={
                      info.art?.startsWith('http') ? info.art : `data:image/png;base64,${info.art}`
                    }
                  />
                </div>
              )}
              {info.album && (
                <div>
                  <b>Album:</b> {info.album}
                </div>
              )}
              <div>
                <b>Artist:</b> {info.artist}
              </div>
              <div className="flex">
                <button
                  className="m-auto cursor-pointer hover:fill-gray-500 active:fill-gray-700"
                  onClick={() => {
                    mediaAction({
                      action: { back: true, mediaAppPackage: info.packageName },
                    })
                  }}
                >
                  <svg.Previous />
                </button>

                <button
                  className="m-auto cursor-pointer hover:fill-gray-500 active:fill-gray-700"
                  onClick={() => {
                    mediaAction({
                      action: info.playing
                        ? { pause: true, mediaAppPackage: info.packageName }
                        : { play: true, mediaAppPackage: info.packageName },
                    })
                  }}
                >
                  {info.playing ? <svg.Pause /> : <svg.Play />}
                </button>
                <button
                  className="m-auto cursor-pointer hover:fill-gray-500 active:fill-gray-700"
                  onClick={() => {
                    mediaAction({
                      action: { next: true, mediaAppPackage: info.packageName },
                    })
                  }}
                >
                  <svg.Next />
                </button>
              </div>
              <div>
                <b>Track:</b> {info.track}
              </div>
            </div>
          ))}
      </div>
    )
  }

  return <div className="flex flex-col items-center space-y-1">{info}</div>
}

function Device({
  thisDeviceId,
  deviceId,
  regId2,
  deviceType,
  deviceName,
}: DeviceInfo & { thisDeviceId: string | null }) {
  const onLocalNetwork = useOnLocalNetwork(deviceId)

  return (
    <div className="flex w-60 flex-col items-center space-y-1">
      <img
        src={`./${ReverseDeviceType[deviceType]}.png`}
        className="max-w-40 rounded-full bg-orange-300 p-2"
      />
      <div className="flex items-center space-x-1">
        <h2 className="text-center text-2xl">
          {thisDeviceId === deviceId ? `${deviceName} (this device)` : deviceName}
        </h2>
        {onLocalNetwork && (
          <div className="rounded-full bg-orange-300 fill-white p-1">
            <svg.LocalNetwork />
          </div>
        )}
      </div>
      <div className="flex w-full flex-col space-y-1">
        <Link
          to="/history"
          search={{ deviceId }}
          from="/devices"
          className="w-full bg-orange-100 text-center text-xl"
        >
          History
        </Link>
        {(deviceType === DeviceType.android_phone || deviceType === DeviceType.android_tablet) && (
          <>
            <Link
              to="/files"
              search={{ regId2, deviceId, onLocalNetwork }}
              from="/devices"
              className="w-full bg-orange-100 text-center text-xl"
            >
              Files
            </Link>
            <Link
              to="/contacts"
              search={{ regId2, deviceId, onLocalNetwork }}
              from="/devices"
              className="w-full bg-orange-100 text-center text-xl"
            >
              Contacts
            </Link>
            <Link
              to="/sms"
              search={{ regId2, deviceId, onLocalNetwork }}
              from="/devices"
              className="w-full bg-orange-100 text-center text-xl"
            >
              SMS
            </Link>

            <hr />

            <Media deviceId={deviceId} regId2={regId2} />
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
    <div className="flex h-[calc(100vh-45px)] w-full flex-wrap justify-center space-x-1 p-2">
      {devices.records.map((device) => (
        <Device key={device.id} {...device} thisDeviceId={deviceId} />
      ))}
    </div>
  )
}
