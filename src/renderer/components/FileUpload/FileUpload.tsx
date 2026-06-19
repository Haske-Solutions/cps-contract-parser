import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { UploadCloud, CheckCircle2, X, AlertCircle } from 'lucide-react'

interface Props {
  label: string
  description?: string
  accept?: string
  file: File | null
  onFile: (file: File | null) => void
  disabled?: boolean
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function FileUpload({
  label,
  description,
  accept = '.pdf',
  file,
  onFile,
  disabled = false,
}: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleValidFile = useCallback(
    (selected: File) => {
      if (!isPdf(selected)) {
        setError('Only PDF files are accepted.')
        return
      }
      setError(null)
      onFile(selected)
    },
    [onFile],
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const dropped = e.dataTransfer.files[0]
      if (dropped) handleValidFile(dropped)
    },
    [disabled, handleValidFile],
  )

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const handleClick = () => {
    if (!disabled) inputRef.current?.click()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) handleValidFile(selected)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex h-full flex-col gap-1.5">
      <Label>{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`Upload ${label}`}
        aria-disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        className={cn(
          'relative flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors min-h-[180px]',
          disabled && 'border-border bg-muted cursor-not-allowed opacity-60',
          error && !disabled && 'border-destructive bg-destructive/5',
          !disabled && !error && isDragging && 'border-accent bg-accent/30 cursor-copy',
          !disabled &&
            !error &&
            !isDragging &&
            file &&
            'border-primary/60 bg-primary/5 cursor-pointer hover:bg-primary/10',
          !disabled &&
            !error &&
            !isDragging &&
            !file &&
            'border-border bg-card cursor-pointer hover:border-accent hover:bg-accent/20',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={handleInputChange}
          disabled={disabled}
          aria-hidden="true"
          tabIndex={-1}
        />

        {file ? (
          <>
            <CheckCircle2 className="size-8 text-primary" aria-hidden="true" />
            <span
              className="line-clamp-2 w-full px-2 text-center text-sm font-medium text-foreground break-all"
              title={file.name}
            >
              {file.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 text-muted-foreground hover:text-destructive"
              onClick={handleRemove}
              aria-label={`Remove ${file.name}`}
            >
              <X className="size-3.5" data-icon="inline-start" />
              Remove file
            </Button>
          </>
        ) : (
          <>
            <UploadCloud className="size-8 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm text-muted-foreground">
              Drop PDF here or <span className="text-primary font-medium">browse</span>
            </span>
            <span className="text-xs text-muted-foreground/70">PDF files only</span>
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1" role="alert">
          <AlertCircle className="size-3" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
