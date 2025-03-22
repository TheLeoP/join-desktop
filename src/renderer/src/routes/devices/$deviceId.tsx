import { Folder } from '@renderer/svgs'
import { useDevices } from '@renderer/util'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { atom, PrimitiveAtom, useAtom, useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'

type File = {
  date: number
  isFolder: boolean
  name: string
  size: number // TODO: mb?
}

type FolderInfo = {
  files: File[]
  pathSegments: string[]
}

export const Route = createFileRoute('/devices/$deviceId')({
  component: RouteComponent,
})

function useRemotePath(deviceId: string, regId2: string | undefined, path: string | undefined) {
  return useQuery<FolderInfo, Error, FolderInfo, readonly string[]>({
    staleTime: 60 * 1000,
    retry: false,
    queryKey: ['folders', deviceId, regId2 as string, path as string],
    enabled: !!regId2 && !!path,
    queryFn: async ({ queryKey }) => {
      const [_, deviceId, regId2, path] = queryKey
      return await window.api.folders(deviceId, regId2, path)
    },
  })
}

function Directory({
  deviceId,
  regId2,
  path,
  atom,
  active,
}: {
  deviceId: string
  regId2: string | undefined
  path: string | undefined
  atom: PrimitiveAtom<number>
  active: boolean
}) {
  const { data: foldersInfo, error, isPending, isError } = useRemotePath(deviceId, regId2, path)
  const [current, setCurrent] = useAtom(atom)

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (!active) return

      const code = e.code
      if (code !== 'ArrowUp' && code !== 'ArrowDown') return
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
          break
        }
      }
    }
    document.addEventListener('keydown', f)
    return () => {
      document.removeEventListener('keydown', f)
    }
  }, [foldersInfo?.files.length, active, setCurrent])

  if (!path) {
    return <div></div>
  } else if (isPending) {
    return <div>Loading...</div>
  } else if (isError) {
    return <div>Error: {error.message}</div>
  }

  return (
    <>
      {foldersInfo.files.map((file, i) => (
        <div key={file.name}>
          <div
            data-active={i === current ? 'active' : undefined}
            className="flex items-center bg-orange-300 text-xl data-active:bg-orange-400"
          >
            {file.isFolder && <Folder />}
            {file.name}
          </div>
          <hr />
        </div>
      ))}
    </>
  )
}

const current1Atom = atom(0)
const current2Atom = atom(0)
const current3Atom = atom(0)

function RouteComponent() {
  const { deviceId } = Route.useParams()
  const { data: devices } = useDevices()
  const regId2 = devices?.records.find((device) => device.deviceId === deviceId)?.regId2

  const [currentDir, setCurrentDir] = useState(0)
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const code = e.code
      if (code !== 'ArrowLeft' && code !== 'ArrowRight') return
      switch (code) {
        case 'ArrowLeft': {
          setCurrentDir((current) => {
            let newValue = current - 1
            const min = 0
            if (newValue < 0) newValue = min

            return newValue
          })
          break
        }
        case 'ArrowRight': {
          setCurrentDir((current) => {
            let newValue = current + 1
            const max = 3
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
  }, [])

  const current1 = useAtomValue(current1Atom)
  const { data: foldersInfo1 } = useRemotePath(deviceId, regId2, '/')
  const selected1 = foldersInfo1 ? foldersInfo1.files[current1] : undefined

  const current2 = useAtomValue(current2Atom)
  const path2 = selected1 ? `/${selected1.name}` : undefined
  const { data: foldersInfo2 } = useRemotePath(deviceId, regId2, path2)
  const selected2 = foldersInfo2 ? foldersInfo2.files[current2] : undefined

  const path3 = selected2 && currentDir >= 1 ? `${path2}/${selected2.name}` : undefined

  return (
    <div className="flex">
      <div className="w-1/4">
        <Directory
          deviceId={deviceId}
          regId2={regId2}
          path="/"
          atom={current1Atom}
          active={currentDir === 0}
        />
      </div>
      <div className="w-1/4">
        <Directory
          deviceId={deviceId}
          regId2={regId2}
          path={path2}
          atom={current2Atom}
          active={currentDir === 1}
        />
      </div>
      <div className="w-1/4">
        <Directory
          deviceId={deviceId}
          regId2={regId2}
          path={path3}
          atom={current3Atom}
          active={currentDir === 2}
        />
      </div>
    </div>
  )
}
