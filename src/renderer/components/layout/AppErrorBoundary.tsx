import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private handleReset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="min-h-svh flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              The app hit an unexpected error. You can try again without restarting, or reload the
              app if the problem persists.
            </AlertDescription>
          </Alert>

          <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
            {this.state.error.message}
          </pre>

          <div className="flex gap-2">
            <Button onClick={this.handleReset}>Try again</Button>
            <Button variant="outline" onClick={this.handleReload}>
              Reload app
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
