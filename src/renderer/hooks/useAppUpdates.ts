import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { UpdateCheckResult, UpdateStatus } from '@shared/types'

export function useAppUpdates(options?: { notifyInBackground?: boolean }) {
  const notifyInBackground = options?.notifyInBackground ?? false
  const [version, setVersion] = useState<string>('…')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' })
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    void window.electronAPI.app.getVersion().then(setVersion)
  }, [])

  useEffect(() => {
    return window.electronAPI.app.onUpdateStatus((status) => {
      setUpdateStatus(status)

      if (!notifyInBackground) return

      switch (status.status) {
        case 'available':
          toast.message(`Update ${status.version} available`, {
            description: 'Downloading in the background…',
          })
          break
        case 'downloaded':
          toast.success(`Update ${status.version} ready`, {
            description: 'Restart from Settings or when prompted to install.',
          })
          break
        case 'error':
          toast.error('Update check failed', { description: status.message })
          break
        default:
          break
      }
    })
  }, [notifyInBackground])

  const checkForUpdates = useCallback(async (): Promise<UpdateCheckResult> => {
    setChecking(true)
    try {
      return await window.electronAPI.app.checkForUpdates()
    } finally {
      setChecking(false)
    }
  }, [])

  const quitAndInstall = useCallback(async () => {
    await window.electronAPI.app.quitAndInstall()
  }, [])

  return {
    version,
    updateStatus,
    checking,
    checkForUpdates,
    quitAndInstall,
    updatesDisabled: updateStatus.status === 'disabled',
  }
}
