import { LocalNetwork, Next, Pause, Play, Previous } from '@renderer/svgs'
import {
  DeviceInfo,
  DeviceType,
  MediaAction,
  MediaInfo,
  queryClient,
  ReverseDeviceType,
  useDeviceId,
  useDevices,
  useMediaAction,
  useOnLocalNetwork,
} from '@renderer/util'
import { UseMutateFunction, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import debounce from 'lodash.debounce'
import { useEffect, useRef, useState } from 'react'

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

  const { mutate: mediaAction } = useMediaAction(deviceId, regId2)
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
      <img className="float-left w-5" src={`src/assets/${type}.svg`} />
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
      {volume}
    </div>
  )
}

function Media({ deviceId, regId2 }: { deviceId: string; regId2: string }) {
  const {
    data: mediaInfo,
    error,
    isPending,
    isError,
    refetch,
  } = useQuery<MediaInfo>({
    staleTime: 60 * 1000,
    retry: false,
    queryKey: ['mediaInfo', deviceId, regId2],
    queryFn: async () => {
      return await window.api.media(deviceId, regId2)
    },
  })
  const onLocalNetwork = useOnLocalNetwork(deviceId)
  useEffect(
    () => void queryClient.invalidateQueries({ queryKey: ['mediaInfo', deviceId, regId2] }),
    [deviceId, regId2, onLocalNetwork],
  )

  const { mutate: mediaAction } = useMediaAction(deviceId, regId2)

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
                  <Previous />
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
                  {info.playing ? <Pause /> : <Play />}
                </button>
                <button
                  className="m-auto cursor-pointer hover:fill-gray-500 active:fill-gray-700"
                  onClick={() => {
                    mediaAction({
                      action: { next: true, mediaAppPackage: info.packageName },
                    })
                  }}
                >
                  <Next />
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

  return (
    <div className="flex flex-col items-center space-y-1">
      {info}
      <button
        className="w-10 cursor-pointer bg-orange-100 stroke-black hover:stroke-gray-500 active:stroke-gray-700"
        onClick={async () => await refetch()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
          <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
        </svg>
      </button>
    </div>
  )
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
    <div className="flex w-60 flex-col items-center">
      <Link to="/devices/$deviceId" params={{ deviceId }} from="/devices">
        <img
          src={`src/assets/${ReverseDeviceType[deviceType]}.png`}
          className="max-w-40 rounded-full bg-orange-300 p-2"
        />
      </Link>
      <div className="flex items-center space-x-1">
        <h2 className="text-center text-2xl">
          {thisDeviceId === deviceId ? `${deviceName} (this device)` : deviceName}
        </h2>
        {onLocalNetwork && (
          <div className="rounded-full bg-orange-300 fill-white p-1">
            <LocalNetwork />
          </div>
        )}
      </div>
      {/* NOTE: Join does this, I don't know if it's correct */}
      {(deviceType == DeviceType.android_phone || deviceType === DeviceType.android_tablet) && (
        <Media deviceId={deviceId} regId2={regId2} />
      )}
    </div>
  )
}

function Devices() {
  const deviceId = useDeviceId()

  const { data: devices, error, isPending, isError } = useDevices()
  if (isPending) {
    return <div>Loading...</div>
  }

  if (isError) {
    return <div>Error: {error.message}</div>
  }

  return (
    <div className="flex h-screen w-full flex-wrap justify-center space-x-1 p-2">
      {devices.records.map((device) => (
        <Device key={device.id} {...device} thisDeviceId={deviceId} />
      ))}
    </div>
  )
}

export const Route = createFileRoute('/devices/')({
  component: Devices,
})
