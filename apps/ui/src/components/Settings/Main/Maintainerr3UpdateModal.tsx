import { DownloadIcon, ExclamationIcon } from '@heroicons/react/solid'
import { useEffect, useRef, useState } from 'react'
import { downloadDatabase } from '../../../api/settings'
import Alert from '../../Common/Alert'
import Button from '../../Common/Button'
import Modal from '../../Common/Modal'
import {
  createDateStampedFilename,
  normalizeDatabaseFilename,
} from './databaseBackupUtils'

interface Maintainerr3UpdateModalProps {
  onClose: () => void
}

const Maintainerr3UpdateModal = ({ onClose }: Maintainerr3UpdateModalProps) => {
  const filenameRef = useRef<HTMLInputElement>(null)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [backupSuccess, setBackupSuccess] = useState(false)
  const [backupFilename, setBackupFilename] = useState(
    createDateStampedFilename(),
  )

  useEffect(() => {
    const input = filenameRef.current
    if (input) {
      input.focus()
      const valueLength = input.value.length
      input.setSelectionRange(valueLength, valueLength)
    }
  }, [])

  const onBackupDatabase = async () => {
    const normalizedFilename = normalizeDatabaseFilename(backupFilename)

    if (!normalizedFilename) {
      setBackupError('Please provide a valid file name')
      return
    }

    try {
      setBackupError(null)
      await downloadDatabase(normalizedFilename)
      setBackupSuccess(true)
    } catch {
      setBackupError('Could not backup the database')
    }
  }

  return (
    <Modal
      title="Maintainerr 3.0 Preparation (Jellyfin Support)"
      onCancel={onClose}
      cancelText="Close"
      backgroundClickable={false}
      size="xl"
    >
      <div className="space-y-4">
        <div className="mb-4 rounded-md bg-amber-600 p-4">
          <div className="flex items-center">
            <ExclamationIcon className="h-5 w-5 text-zinc-900" />
            <div className="ml-3 text-sm font-medium text-zinc-900">
              This update is not reversible.
            </div>
          </div>
        </div>
        <ul className="list-disc space-y-2 pl-5 text-zinc-300">
          <li>
            Maintainerr 3.0 includes major updates, database schema changes, and
            internal media server naming changes.{' '}
            <i>
              <b>The biggest update, is support for Jellyfin users.</b>
            </i>
          </li>
          <li>
            Your database file is where ALL of your settings live. All rules,
            collections, service settings, and app config are in this file.
          </li>
          <li>
            Once this instance is upgraded and migrations ran on the database,
            returning to a pre-3.0 version is not supported without a copy of
            your old database.
          </li>
        </ul>
        <p className="font-semibold text-amber-500">
          Before updating Maintainerr, it is{' '}
          <b>
            <i>strongly</i>
          </b>{' '}
          advised to backup your database, in the unlikely event that you need
          to downgrade to a pre-3.0 version.
        </p>
        <div className="form-row !mb-0">
          <label htmlFor="prep-backup-filename" className="text-label">
            Backup file name
          </label>
          <div className="form-input">
            <div className="form-input-field">
              <input
                ref={filenameRef}
                id="prep-backup-filename"
                type="text"
                value={backupFilename}
                onChange={(e) => setBackupFilename(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void onBackupDatabase()
                  }
                }}
              />
            </div>
          </div>
        </div>
        {backupError && <Alert type="error" title={backupError} />}
        {backupSuccess && (
          <Alert type="info" title="Database backup downloaded successfully" />
        )}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 sm:flex-nowrap sm:justify-start">
          <Button buttonType="warning" type="button" onClick={onBackupDatabase}>
            <DownloadIcon />
            <span>Backup Database</span>
          </Button>
          <Button
            as="a"
            buttonType="default"
            href="https://discord.maintainerr.info"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Need Help? Join Discord</span>
          </Button>
          <Button
            as="a"
            buttonType="default"
            href="https://docs.maintainerr.info/latest/downgrade"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Downgrade Docs</span>
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default Maintainerr3UpdateModal
