import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle, Database, Sparkles, Download } from 'lucide-react'
import type { MotherduckTokenPreview, ParserApiKeyPreview } from '@shared/types'
import { SettingsSection } from '../../components/layout/SettingsSection'
import { ConfirmDialog } from '../../components/layout/ConfirmDialog'
import { SavedMotherduckToken } from '../../components/Settings/SavedMotherduckToken'
import { SavedParserApiKey } from '../../components/Settings/SavedParserApiKey'
import { useAppUpdates } from '../../hooks/useAppUpdates'

export function Settings() {
  const [motherduckTokenInput, setMotherduckTokenInput] = useState('')
  const [tokenPreview, setTokenPreview] = useState<MotherduckTokenPreview | null | undefined>(
    undefined,
  )
  const [connectionResult, setConnectionResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  )
  const [savingMotherduck, setSavingMotherduck] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showRemoveTokenDialog, setShowRemoveTokenDialog] = useState(false)

  const [parserProxyUrl, setParserProxyUrl] = useState('')
  const [parserApiKeyInput, setParserApiKeyInput] = useState('')
  const [parserKeyPreview, setParserKeyPreview] = useState<ParserApiKeyPreview | null | undefined>(
    undefined,
  )
  const [parserConnectionResult, setParserConnectionResult] = useState<{
    ok: boolean
    message: string
  } | null>(null)
  const [savingParser, setSavingParser] = useState(false)
  const [testingParser, setTestingParser] = useState(false)
  const [showRemoveParserKeyDialog, setShowRemoveParserKeyDialog] = useState(false)

  const {
    version: appVersion,
    updateStatus,
    checking: checkingForUpdates,
    checkForUpdates,
    quitAndInstall,
    updatesDisabled,
  } = useAppUpdates()

  useEffect(() => {
    void loadSettings()
  }, [])

  const loadSettings = async () => {
    const [preview, parserUrl, parserPreview] = await Promise.all([
      window.electronAPI.settings.getMotherduckTokenPreview(),
      window.electronAPI.settings.getParserProxyUrl(),
      window.electronAPI.settings.getParserApiKeyPreview(),
    ])
    setTokenPreview(preview)
    setParserProxyUrl(parserUrl)
    setParserKeyPreview(parserPreview)
  }

  const handleSaveMotherduckToken = async () => {
    if (!motherduckTokenInput.trim()) return
    setSavingMotherduck(true)
    try {
      await window.electronAPI.settings.setMotherduckToken(motherduckTokenInput.trim())
      setMotherduckTokenInput('')
      await loadSettings()
      toast.success('MotherDuck token saved')
    } finally {
      setSavingMotherduck(false)
    }
  }

  const handleDeleteMotherduckToken = async () => {
    await window.electronAPI.settings.deleteMotherduckToken()
    await loadSettings()
    setShowRemoveTokenDialog(false)
    toast.success('MotherDuck token removed')
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setConnectionResult(null)
    try {
      const result = await window.electronAPI.settings.testConnection()
      setConnectionResult(result)
      if (result.ok) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch {
      const msg = 'Connection failed — check your MotherDuck token'
      setConnectionResult({ ok: false, message: msg })
      toast.error(msg)
    } finally {
      setTesting(false)
    }
  }

  const handleSaveParserSettings = async () => {
    setSavingParser(true)
    try {
      await window.electronAPI.settings.setParserProxyUrl(parserProxyUrl.trim())
      if (parserApiKeyInput.trim()) {
        await window.electronAPI.settings.setParserApiKey(parserApiKeyInput.trim())
        setParserApiKeyInput('')
      }
      await loadSettings()
      toast.success('Parser API settings saved')
    } finally {
      setSavingParser(false)
    }
  }

  const handleDeleteParserApiKey = async () => {
    await window.electronAPI.settings.deleteParserApiKey()
    await loadSettings()
    setShowRemoveParserKeyDialog(false)
    toast.success('Parser API key removed')
  }

  const handleTestParserConnection = async () => {
    setTestingParser(true)
    setParserConnectionResult(null)
    try {
      const result = await window.electronAPI.settings.testParserConnection()
      setParserConnectionResult(result)
      if (result.ok) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch {
      const msg = 'Parser connection failed — check URL and API key'
      setParserConnectionResult({ ok: false, message: msg })
      toast.error(msg)
    } finally {
      setTestingParser(false)
    }
  }

  const hasSavedToken = tokenPreview != null
  const isLoading = tokenPreview === undefined
  const hasParserKey = parserKeyPreview != null
  const isParserLoading = parserKeyPreview === undefined
  const canSaveParser = parserProxyUrl.trim().length > 0 || parserApiKeyInput.trim().length > 0

  const updateStatusMessage = (() => {
    switch (updateStatus.status) {
      case 'checking':
        return 'Checking for updates…'
      case 'available':
        return `Version ${updateStatus.version} is available and downloading.`
      case 'downloading':
        return `Downloading version ${updateStatus.version} (${Math.round(updateStatus.percent)}%)…`
      case 'downloaded':
        return `Version ${updateStatus.version} is ready to install.`
      case 'not-available':
        return `You're on the latest version (${updateStatus.version}).`
      case 'error':
        return updateStatus.message
      case 'disabled':
        return updateStatus.reason
      default:
        return 'Installed releases check GitHub automatically about 10 seconds after launch.'
    }
  })()

  const handleCheckForUpdates = async () => {
    const result = await checkForUpdates()
    if (!result.ok && updateStatus.status !== 'disabled') {
      toast.error(result.message)
    }
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      <p className="text-sm text-muted-foreground">
        Configure AI extraction and Pink Elephant warehouse access.
      </p>

      <SettingsSection
        icon={<Download className="size-4" aria-hidden="true" />}
        title="Application"
        description="Version and automatic updates from GitHub Releases."
      >
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Current version</p>
          <p className="text-sm font-mono text-muted-foreground">v{appVersion}</p>
        </div>

        <p className="text-sm text-muted-foreground">{updateStatusMessage}</p>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleCheckForUpdates}
            disabled={checkingForUpdates || updatesDisabled}
            className="self-start"
          >
            {checkingForUpdates ? 'Checking…' : 'Check for updates'}
          </Button>
          {updateStatus.status === 'downloaded' && (
            <Button onClick={() => void quitAndInstall()} className="self-start">
              Restart to install {updateStatus.version}
            </Button>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        icon={<Sparkles className="size-4" aria-hidden="true" />}
        title="Parser API"
        description="Required for AI rate extraction in downloaded app builds. Contact your CPS admin for the shared API key."
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="parser-proxy-url" className="text-sm font-medium">
            Parser API URL
          </label>
          <Input
            id="parser-proxy-url"
            type="url"
            value={parserProxyUrl}
            onChange={(e) => setParserProxyUrl(e.target.value)}
            placeholder="https://api-cp.safarico.online"
            className="font-mono"
            autoComplete="off"
          />
        </div>

        {isParserLoading ? (
          <p className="text-sm text-muted-foreground">Loading parser settings…</p>
        ) : hasParserKey ? (
          <div className="flex flex-col gap-3" role="list" aria-label="Saved Parser API keys">
            <SavedParserApiKey
              preview={parserKeyPreview}
              onRemove={
                parserKeyPreview.canRemove ? () => setShowRemoveParserKeyDialog(true) : undefined
              }
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No API key configured yet.</p>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <p className="text-sm font-medium">{hasParserKey ? 'Replace API key' : 'Add API key'}</p>
          <div className="flex gap-2">
            <Input
              type="password"
              value={parserApiKeyInput}
              onChange={(e) => setParserApiKeyInput(e.target.value)}
              placeholder="Paste Parser API key — stored in OS keychain"
              className="flex-1 font-mono"
              aria-label="Parser API key"
              autoComplete="off"
            />
            <Button
              variant="outline"
              onClick={handleSaveParserSettings}
              disabled={!canSaveParser || savingParser}
            >
              {savingParser ? 'Saving…' : hasParserKey ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>

        {parserConnectionResult && (
          <Alert variant={parserConnectionResult.ok ? 'default' : 'destructive'}>
            {parserConnectionResult.ok ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <XCircle className="size-4" />
            )}
            <AlertDescription>{parserConnectionResult.message}</AlertDescription>
          </Alert>
        )}

        <Button
          variant="outline"
          onClick={handleTestParserConnection}
          disabled={testingParser || !parserProxyUrl.trim() || !hasParserKey}
          className="self-start"
        >
          {testingParser ? 'Testing…' : 'Test Parser Connection'}
        </Button>
      </SettingsSection>

      <SettingsSection
        icon={<Database className="size-4" aria-hidden="true" />}
        title="MotherDuck Access Token"
        description={
          <>
            Token for direct queries against the Pink Elephant warehouse (
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">md:PinkElephant</code>
            ).
          </>
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading saved tokens…</p>
        ) : hasSavedToken ? (
          <div className="flex flex-col gap-3" role="list" aria-label="Saved MotherDuck tokens">
            <SavedMotherduckToken
              preview={tokenPreview}
              onRemove={tokenPreview.canRemove ? () => setShowRemoveTokenDialog(true) : undefined}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No token configured yet.</p>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <p className="text-sm font-medium">
            {hasSavedToken ? 'Replace token' : 'Add token'}
          </p>
          <div className="flex gap-2">
            <Input
              type="password"
              value={motherduckTokenInput}
              onChange={(e) => setMotherduckTokenInput(e.target.value)}
              placeholder="Paste MotherDuck token — stored in OS keychain"
              className="flex-1 font-mono"
              aria-label="MotherDuck access token"
              autoComplete="off"
            />
            <Button
              variant="outline"
              onClick={handleSaveMotherduckToken}
              disabled={!motherduckTokenInput.trim() || savingMotherduck}
            >
              {savingMotherduck ? 'Saving…' : hasSavedToken ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>

        {connectionResult && (
          <Alert variant={connectionResult.ok ? 'default' : 'destructive'}>
            {connectionResult.ok ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <XCircle className="size-4" />
            )}
            <AlertDescription>{connectionResult.message}</AlertDescription>
          </Alert>
        )}

        <Button
          variant="outline"
          onClick={handleTestConnection}
          disabled={testing || !hasSavedToken}
          className="self-start"
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </Button>
      </SettingsSection>

      <ConfirmDialog
        open={showRemoveTokenDialog}
        onOpenChange={setShowRemoveTokenDialog}
        title="Remove MotherDuck token?"
        description="Warehouse queries will fail until you save a new token or set MOTHERDUCK_TOKEN in .env."
        confirmLabel="Remove token"
        variant="destructive"
        onConfirm={handleDeleteMotherduckToken}
      />

      <ConfirmDialog
        open={showRemoveParserKeyDialog}
        onOpenChange={setShowRemoveParserKeyDialog}
        title="Remove Parser API key?"
        description="AI extraction will fail until you save a new API key or set PARSER_API_KEY in .env."
        confirmLabel="Remove API key"
        variant="destructive"
        onConfirm={handleDeleteParserApiKey}
      />
    </div>
  )
}
