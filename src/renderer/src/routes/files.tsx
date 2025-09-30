import * as svg from '@renderer/svgs'
import { formatBytes, queryClient } from '@renderer/util'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { atom, useAtom, useSetAtom } from 'jotai'
import { useEffect, useState, useRef, CSSProperties, useLayoutEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useDebounce } from 'use-debounce'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import type { FolderInfo } from 'src/preload/types'
import { toast } from 'sonner'

const searchSchema = z.object({
  regId2: z.string(),
  deviceId: z.string(),
  onLocalNetwork: z.boolean(),
})

export const Route = createFileRoute('/files')({
  component: RouteComponent,
  loaderDeps: ({ search: { regId2, deviceId, onLocalNetwork } }) => ({
    regId2,
    deviceId,
    onLocalNetwork,
  }),
  loader: async ({ deps: { regId2, deviceId, onLocalNetwork } }) => {
    queryClient.ensureQueryData(remotePathQueryOptions(deviceId, regId2, '/', onLocalNetwork))
  },
  validateSearch: zodValidator(searchSchema),
})

function remotePathQueryOptions(
  deviceId: string,
  regId2: string,
  path: string,
  onLocalNetwork: boolean,
) {
  return queryOptions<FolderInfo, Error, FolderInfo, readonly ['folders', string, string, string]>({
    staleTime: onLocalNetwork ? 0 : 60 * 1000,
    queryKey: ['folders', deviceId, regId2, path],
    queryFn: async ({ queryKey }) => {
      const [_, deviceId, regId2, path] = queryKey
      return await window.api.folders(deviceId, regId2, path)
    },
  })
}
function useRemotePath(deviceId: string, regId2: string, path: string, onLocalNetwork: boolean) {
  return useQuery(remotePathQueryOptions(deviceId, regId2, path, onLocalNetwork))
}

// TODO: overhaul the whole inner workings of directory/path state
function Directory({
  path,
  active,
  i,
  style,
}: {
  path: string
  active: boolean
  i: number
  style: CSSProperties
}) {
  const { regId2, deviceId, onLocalNetwork } = Route.useSearch()

  const setPaths = useSetAtom(pathsAtom)
  const setCurrentFile = useSetAtom(currentFileAtom)
  const [currentDir] = useAtom(currentDirAtom)

  const {
    data: foldersInfo,
    error,
    isPending,
    isError,
  } = useRemotePath(deviceId, regId2, path, onLocalNetwork)
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    if (!active) return

    if (!foldersInfo) return
    const item = foldersInfo.files[current]
    if (!item.isFolder) {
      setPaths((oldPath) => {
        const newPaths = [...oldPath]
        if (newPaths.length > i + 1) {
          newPaths.splice(i + 1, 1)
        }
        return newPaths
      })
      setCurrentFile(item.name)
      return
    }

    setPaths((oldPath) => {
      const newPaths = [...oldPath]
      newPaths[i + 1] = item.name
      return newPaths
    })
    setCurrentFile(null)
  }, [current, foldersInfo, i, active, setPaths, setCurrentFile])

  useEffect(() => {
    const f = async (e: KeyboardEvent) => {
      if (!active) return
      e.preventDefault()

      const code = e.code
      if (code === 'ArrowLeft') return setCurrent(0)
      if (code !== 'ArrowUp' && code !== 'ArrowDown' && code !== 'Enter') return
      switch (code) {
        case 'ArrowUp': {
          setCurrent((current) => {
            let newValue = current - 1
            const max = (foldersInfo?.files.length ?? 1) - 1
            if (newValue < 0) newValue = max

            return newValue
          })

          break
        }
        case 'ArrowDown': {
          setCurrent((current) => {
            let newValue = current + 1
            const max = foldersInfo?.files.length ?? Infinity
            if (newValue >= max) newValue = 0
            return newValue
          })
          if (!foldersInfo) return

          break
        }
        case 'Enter': {
          if (!regId2) return

          if (!foldersInfo) return
          const item = foldersInfo.files[current]
          if (!item) return
          if (item.isFolder) return

          toast.promise(
            window.api.openRemoteFile(deviceId, regId2, `${path}/${item.name}`, item.name),
            {
              loading: 'Opening remote file in browser',
              success: 'Remote file has been opened in your default browser',
              error: 'There was an error while openning remote file',
            },
          )

          break
        }
      }
    }
    document.addEventListener('keydown', f)
    return () => {
      document.removeEventListener('keydown', f)
    }
  }, [active, current, deviceId, foldersInfo, onLocalNetwork, path, regId2, setCurrent])

  const scrollElement = useRef<HTMLDivElement | null>(null)
  const rowVirtualizer = useVirtualizer({
    count: foldersInfo?.files.length ?? 0,
    getScrollElement: () => scrollElement.current,
    estimateSize: () => 55,
  })
  const items = rowVirtualizer.getVirtualItems()
  useEffect(() => {
    rowVirtualizer.scrollToIndex(current, { align: 'center' })
  }, [current, rowVirtualizer])

  if (!path) {
    return <></>
  } else if (isPending) {
    return <div style={style}>Loading...</div>
  } else if (isError) {
    return <div style={style}>Error: {error.message}</div>
  }

  return (
    <div
      data-active={active ? 'active' : undefined}
      className="overflow-y-auto data-active:bg-yellow-200 data-active:p-1 dark:data-active:bg-yellow-400"
      ref={scrollElement}
      style={style}
    >
      <div style={{ position: 'relative', height: rowVirtualizer.getTotalSize() }}>
        {items.map((virtualItem) => {
          const item = foldersInfo.files[virtualItem.index]
          return (
            <button
              onClick={() => {
                // TODO: allow even outside of current dir when below todos are solved
                if (i === currentDir) {
                  setCurrent(virtualItem.index)
                }
                // TODO: enable this when below todo is solved
                // setCurrentDir(i)
                // TODO: change paths as needed (like when doing arrowleft) to
                // avoid wrong previews. Should paths be a derived value
                // instead?
              }}
              key={virtualItem.key}
              data-active={virtualItem.index === current ? 'active' : undefined}
              className="cursor-pointer border-b bg-orange-300 data-active:bg-orange-400 dark:bg-orange-600 dark:data-active:bg-orange-500"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="flex items-center text-xl">
                {item.isFolder && <svg.Folder />}
                <span className="truncate">{item.name}</span>
              </div>
              {!item.isFolder && formatBytes(item.size)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const pathsAtom = atom([''])
const currentFileAtom = atom<null | string>(null)
const currentDirAtom = atom(0)

function RouteComponent() {
  // TODO: sometimes, when changing window (and query data is stale?) only the
  // first directoy column in render and it's not the selected one
  const { deviceId, onLocalNetwork } = Route.useSearch()

  const [paths, setPaths] = useAtom(pathsAtom)
  const [debouncedPaths] = useDebounce(paths, 250)
  const [currentFile, setCurrentFile] = useAtom(currentFileAtom)
  let previewPath = currentFile ? `${paths.join('/')}/${currentFile}` : undefined
  if (previewPath === '') previewPath = '/'
  const [preview, setPreview] = useState<string | null>(null)
  const [debouncedPreview] = useDebounce(preview, 250)

  useEffect(() => {
    async function getPreview() {
      if (!previewPath) return setPreview(null)
      if (
        !/\.(png|jpg|jpeg|gif|webp)$/.test(previewPath) &&
        !/\.(mp4|avi|3gp|wmv|mov|mkv)$/.test(previewPath)
      )
        return setPreview(null)

      const url = await window.api.getRemoteUrl(deviceId, previewPath)
      setPreview(url)
    }
    getPreview()
  }, [previewPath, deviceId])

  const [currentDir, setCurrentDir] = useAtom(currentDirAtom)
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      e.preventDefault()

      const code = e.code
      if (code !== 'ArrowLeft' && code !== 'ArrowRight') return
      setCurrentFile(null)
      switch (code) {
        case 'ArrowLeft': {
          setCurrentDir((current) => {
            let newValue = current - 1
            const min = 0
            if (newValue < 0) newValue = min

            return newValue
          })

          setPaths((oldPath) => {
            const newPaths = [...oldPath]
            if (newPaths.length > 2) newPaths.pop()

            return newPaths
          })
          break
        }
        case 'ArrowRight': {
          setCurrentDir((current) => {
            let newValue = current + 1
            const max = paths.length + 1
            if (newValue > max) newValue = 0
            return newValue
          })
          break
        }
      }
    }

    document.addEventListener('keydown', f)
    return () => {
      document.removeEventListener('keydown', f)
    }
  }, [paths, setPaths, setCurrentFile])

  const [dirsWidth, setDirsWidth] = useState(0)
  const scrollElement = useRef<HTMLDivElement | null>(null)
  const dirVirtualizer = useVirtualizer({
    count: debouncedPaths.length,
    getScrollElement: () => scrollElement.current,
    estimateSize: () => dirsWidth / 3,
    horizontal: true,
  })
  const virtualCols = dirVirtualizer.getVirtualItems()
  useEffect(() => {
    dirVirtualizer.scrollToIndex(currentDir, { align: 'center' })
  }, [currentDir, dirVirtualizer, debouncedPaths])
  useLayoutEffect(() => {
    const f = () => {
      if (!scrollElement.current) return

      const { width } = scrollElement.current.getBoundingClientRect()
      setDirsWidth(width)
      dirVirtualizer.measure()
    }
    f()
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [dirVirtualizer])

  const [shouldLoad, setShouldLoad] = useState(onLocalNetwork)

  if (!shouldLoad) {
    return (
      <div className="flex h-[calc(100vh-45px)] flex-col items-center justify-center space-y-2">
        <h1 className="text-4xl font-bold">Warning</h1>
        <h2 className="text-2xl">
          This device is not in your local network, accessing its file system may be extremely slow
        </h2>
        <button
          onClick={() => setShouldLoad(true)}
          className="cursor-pointer rounded-md bg-red-500 p-2 text-xl text-white hover:bg-red-600 active:bg-red-700"
        >
          I understand. Access it anyway
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-45px)] w-full bg-white text-black dark:bg-neutral-800 dark:text-white">
      <div className="h-full w-3/4 overflow-x-auto" ref={scrollElement}>
        <div
          style={{
            height: '100%',
            width: dirVirtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {virtualCols.map((virtualCol) => {
            const i = virtualCol.index
            let path = `${debouncedPaths.slice(0, i + 1).join('/')}`
            if (path === '') path = '/'

            return (
              <Directory
                key={i}
                path={path}
                active={currentDir === i}
                i={i}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${virtualCol.size}px`,
                  transform: `translateX(${virtualCol.start}px)`,
                }}
              />
            )
          })}
        </div>
      </div>
      <div className="w-1/4">
        {previewPath && debouncedPreview && (
          <>
            {/\.(png|jpg|jpeg|gif|webp)$/.test(previewPath) && <img src={debouncedPreview} />}
            {/\.(mp4|avi|3gp|wmv|mov|mkv)$/.test(previewPath) && (
              <video controls key={debouncedPreview}>
                <source src={debouncedPreview} />
              </video>
            )}
          </>
        )}
      </div>
    </div>
  )
}
