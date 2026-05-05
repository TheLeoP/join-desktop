import { mediaQueryOptions, queryClient, useMedia, useMediaAction } from '@renderer/util'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import * as svg from '@renderer/svgs'

const searchSchema = z.object({
  regId2: z.string(),
  deviceId: z.string(),
  onLocalNetwork: z.boolean(),
})

export const Route = createFileRoute('/media')({
  component: RouteComponent,
  loaderDeps: ({ search: { regId2, deviceId, onLocalNetwork } }) => ({
    regId2,
    deviceId,
    onLocalNetwork,
  }),
  loader: async ({ deps: { regId2, deviceId, onLocalNetwork } }) => {
    queryClient.ensureQueryData(mediaQueryOptions(deviceId, regId2, onLocalNetwork))
  },
  validateSearch: searchSchema,
})

function Volume({ max, volume, type }: { max: number; volume: number; type: string }) {
  const [internalVolume, setInternalVolume] = useState<number | null>(null)
  const { regId2, deviceId, onLocalNetwork } = Route.useSearch()
  const { mutate: mediaAction } = useMediaAction(deviceId, regId2, onLocalNetwork)
  const uiVolume = internalVolume ?? volume

  return (
    <div className="flex w-1/3 space-x-1">
      <img
        className="float-left size-8 rounded-full bg-orange-100 p-1 dark:bg-orange-400"
        src={`./${type}.svg`}
      />

      <input
        className="w-2/3"
        type="range"
        min={0}
        max={max}
        value={uiVolume}
        onChange={(e) => {
          setInternalVolume(+e.target.value)
          mediaAction({ action: { mediaVolume: e.target.value } })
        }}
      />
      <span className="m-auto">{uiVolume}</span>
    </div>
  )
}

function RouteComponent() {
  const { regId2, deviceId, onLocalNetwork } = Route.useSearch()
  const { data: mediaInfo, error, isPending, isError } = useMedia(deviceId, regId2, onLocalNetwork)

  const { mutate: mediaAction } = useMediaAction(deviceId, regId2, onLocalNetwork)

  if (isPending) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  }

  return (
    <div className="h-[calc(100vh-45px)] w-full flex-wrap bg-white text-black dark:bg-neutral-800 dark:text-white">
      <div className="flex flex-wrap justify-center space-y-1">
        <Volume
          volume={mediaInfo.extraInfo.mediaVolume}
          max={mediaInfo.extraInfo.maxMediaVolume}
          type="media"
        />

        <div className="flex w-full flex-wrap space-y-1 space-x-1">
          {mediaInfo.mediaInfosForClients
            .sort((a, b) => b.date - a.date)
            .map((info) => (
              <div
                key={info.packageName}
                className="flex w-[calc(25%-4px)] flex-col space-y-1 rounded-sm bg-orange-100 p-1 dark:bg-orange-400"
              >
                <h1 className="text-center text-xl underline">{info.appName}</h1>
                {info.art && (
                  <img
                    className="h-60 object-scale-down"
                    src={
                      info.art?.startsWith('http') ? info.art : `data:image/png;base64,${info.art}`
                    }
                  />
                )}

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

                <div className="truncate">
                  <b>Album:</b> {info.album}
                </div>
                <div className="truncate">
                  <b>Artist:</b> {info.artist}
                </div>
                <div className="truncate">
                  <b>Track:</b> {info.track}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
