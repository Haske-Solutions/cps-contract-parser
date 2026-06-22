import { useState, useCallback } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Toaster } from '@/components/ui/sonner'
import { FileText, History as HistoryIcon, Settings as SettingsIcon } from 'lucide-react'
import { ParseSession } from './pages/ParseSession/ParseSession'
import { History } from './pages/History/History'
import { Settings } from './pages/Settings/Settings'
import { ConfirmDialog } from './components/layout/ConfirmDialog'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAppUpdates } from './hooks/useAppUpdates'
import { cn } from '@/lib/utils'
import { useSessionStore } from './store/sessionStore'
import { isSessionInProgress } from './lib/parseFlow'
import type { ParseSession as ParseSessionType } from '@shared/types'

type View = 'session' | 'history' | 'settings'

const viewTitles: Record<View, string> = {
  session: 'Parse Session',
  history: 'Session History',
  settings: 'Settings',
}

export function App() {
  const [view, setView] = useState<View>('session')
  const [pendingView, setPendingView] = useState<View | null>(null)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const store = useSessionStore()
  const { version: appVersion } = useAppUpdates({ notifyInBackground: true })

  const requestViewChange = useCallback(
    (next: View) => {
      if (next === view) return
      if (view === 'session' && isSessionInProgress(store)) {
        setPendingView(next)
        setShowLeaveDialog(true)
        return
      }
      setView(next)
    },
    [view, store],
  )

  const handleLeaveConfirm = () => {
    setShowLeaveDialog(false)
    if (pendingView) {
      setView(pendingView)
      setPendingView(null)
    }
  }

  const handleRestoreSession = useCallback(
    (session: ParseSessionType) => {
      store.hydrateSession(session)
      setView('session')
    },
    [store],
  )

  return (
    <ErrorBoundary>
    <TooltipProvider>
      <SidebarProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
        >
          Skip to main content
        </a>

        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
          <SidebarHeader className="px-4 pt-5 pb-3">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
              <div
                className="w-1 h-8 rounded-full bg-sidebar-primary shrink-0"
                aria-hidden="true"
              />
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-widest">
                  CPS
                </p>
                <p className="text-sm font-heading font-semibold text-sidebar-foreground">
                  Contract Parser
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={view === 'session'}
                      onClick={() => requestViewChange('session')}
                      tooltip="Parse Session"
                      className="data-[active=true]:border-l-2 data-[active=true]:border-sidebar-primary data-[active=true]:bg-sidebar-accent"
                    >
                      <FileText />
                      <span>Parse Session</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={view === 'history'}
                      onClick={() => requestViewChange('history')}
                      tooltip="History"
                      className="data-[active=true]:border-l-2 data-[active=true]:border-sidebar-primary data-[active=true]:bg-sidebar-accent"
                    >
                      <HistoryIcon />
                      <span>History</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={view === 'settings'}
                      onClick={() => requestViewChange('settings')}
                      tooltip="Settings"
                      className="data-[active=true]:border-l-2 data-[active=true]:border-sidebar-primary data-[active=true]:bg-sidebar-accent"
                    >
                      <SettingsIcon />
                      <span>Settings</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <Badge
              variant="outline"
              className="text-[10px] text-sidebar-foreground/40 border-sidebar-border group-data-[collapsible=icon]:hidden"
            >
              v{appVersion}
            </Badge>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-w-0 flex-1 overflow-auto flex flex-col min-h-svh">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <h1 className="text-sm font-heading font-semibold">{viewTitles[view]}</h1>
          </header>

          <div
            id="main-content"
            className={cn(
              'flex-1 w-full min-w-0 mx-auto px-4 sm:px-6 lg:px-8 py-6 outline-none',
              view === 'settings' ? 'max-w-3xl' : 'max-w-6xl',
            )}
          >
            {view === 'session' && <ParseSession />}
            {view === 'history' && <History onRestore={handleRestoreSession} />}
            {view === 'settings' && <Settings />}
          </div>
        </SidebarInset>

        <ConfirmDialog
          open={showLeaveDialog}
          onOpenChange={setShowLeaveDialog}
          title="Leave session?"
          description="You have a parse session in progress. Leaving will keep your current progress, but you won't see the session steps until you return to Parse Session."
          confirmLabel="Leave anyway"
          cancelLabel="Stay"
          onConfirm={handleLeaveConfirm}
        />

        <Toaster />
      </SidebarProvider>
    </TooltipProvider>
    </ErrorBoundary>
  )
}
