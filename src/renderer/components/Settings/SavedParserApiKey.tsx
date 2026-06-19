import type { ParserApiKeyPreview } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KeyRound, Trash2 } from 'lucide-react'

interface Props {
  preview: ParserApiKeyPreview
  onRemove?: () => void
}

function formatSavedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function SavedParserApiKey({ preview, onRemove }: Props) {
  const sourceLabel =
    preview.source === 'keychain'
      ? 'Stored in OS keychain'
      : 'From PARSER_API_KEY environment variable'

  return (
    <div
      className="rounded-lg border border-border bg-muted/20 overflow-hidden"
      role="listitem"
      aria-label="Saved Parser API key"
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/60 bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <KeyRound className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="text-sm font-medium truncate">Parser API key</span>
        </div>
        {preview.canRemove && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="shrink-0 -mr-2 text-destructive hover:text-destructive"
            aria-label="Remove saved API key"
          >
            <Trash2 className="size-3.5" data-icon="inline-start" />
            Delete
          </Button>
        )}
      </div>

      <div className="px-4 py-3 flex flex-col gap-2">
        <code className="block font-mono text-xs text-foreground break-all rounded-md border border-border bg-background px-3 py-2.5 leading-relaxed">
          {preview.masked}
        </code>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="font-mono text-[10px]">
            SHA256:{preview.fingerprint}
          </Badge>
          {preview.proxyUrl && (
            <Badge variant="secondary" className="font-mono text-[10px] max-w-full truncate">
              {preview.proxyUrl}
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {sourceLabel}
          {preview.savedAt && <> · Added {formatSavedAt(preview.savedAt)}</>}
        </p>
      </div>
    </div>
  )
}
