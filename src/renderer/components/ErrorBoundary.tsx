import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const detail = `${error.message}\n${info.componentStack ?? ''}`
    window.electronAPI.renderer.reportError(detail).catch(() => {})
  }

  private handleReset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
        <div className="w-full max-w-md space-y-5">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Your session data has been preserved — restarting the
              view should recover the app.
            </p>
          </div>
          <details className="rounded-md border border-border bg-muted/40 p-3">
            <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">
              Error details
            </summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
              {error.message}
            </pre>
          </details>
          <div className="flex gap-2">
            <button
              onClick={this.handleReset}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    )
  }
}
