import * as svg from '@renderer/svgs'
import { formatBytes, queryClient, useOnLocalNetwork } from '@renderer/util'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { atom, useAtom, useSetAtom } from 'jotai'
import { useEffect, useState, useRef, CSSProperties, useLayoutEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useDebounce } from 'use-debounce'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { FolderInfo } from 'src/preload/types'

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

          window.api.openRemoteFile(deviceId, regId2, `${path}/${item.name}`, item.name)
          // TODO: toast to show some kind of progress?

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
    rowVirtualizer.scrollToIndex(current)
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
      className="overflow-y-auto data-active:bg-yellow-200 data-active:p-1"
      ref={scrollElement}
      style={style}
    >
      <div style={{ position: 'relative', height: rowVirtualizer.getTotalSize() }}>
        {items.map((virtualItem) => {
          const item = foldersInfo.files[virtualItem.index]
          return (
            <div
              key={virtualItem.key}
              data-active={virtualItem.index === current ? 'active' : undefined}
              className="border-b bg-orange-300 data-active:bg-orange-400"
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
            </div>
          )
        })}
      </div>
    </div>
  )
}

const pathsAtom = atom([''])
const currentFileAtom = atom<null | string>(null)

function RouteComponent() {
  // TODO: sometimes, when changing window (and query data is stale?) only the first directoy column in render and it's not the selected one
  const { regId2, deviceId } = Route.useSearch()

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
        !previewPath.endsWith('.png') &&
        !previewPath.endsWith('.jpg') &&
        !previewPath.endsWith('.jpeg') &&
        !previewPath.endsWith('.gif')
      )
        return setPreview(null)

      const url = await window.api.getRemoteUrl(deviceId, previewPath)
      setPreview(url)
    }
    getPreview()
  }, [previewPath, deviceId])

  const [currentDir, setCurrentDir] = useState(0)
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
  }, [paths, setPaths])

  const [dirsWidth, setDirsWidth] = useState(0)
  const scrollElement = useRef<HTMLDivElement | null>(null)
  const dirVirtualizer = useVirtualizer({
    count: paths.length,
    getScrollElement: () => scrollElement.current,
    estimateSize: () => dirsWidth / 3,
    horizontal: true,
  })
  const virtualCols = dirVirtualizer.getVirtualItems()
  useEffect(() => {
    dirVirtualizer.scrollToIndex(currentDir, { align: 'center' })
  }, [currentDir, dirVirtualizer, paths])
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
  }, [])

  return (
    <div className="flex h-[calc(100vh-45px)] w-full">
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
      {/* TODO: support more kind of previews? */}
      <div className="w-1/4">{debouncedPreview && <img src={debouncedPreview} />}</div>
    </div>
  )
}
