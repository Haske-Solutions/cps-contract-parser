import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  verbatimText: string
  onConfirm: () => void
}

export function FestiveClarifyGate({ verbatimText, onConfirm }: Props) {
  return (
    <Dialog open>
      <DialogContent showCloseButton={false} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Festive term needs clarification</DialogTitle>
          <DialogDescription>
            A festive line item on the contract form is missing amount, dates, or scope. Clarify before
            festive extras are written.
          </DialogDescription>
        </DialogHeader>
        {verbatimText && (
          <blockquote className="text-xs border-l-2 border-border pl-3 italic text-muted-foreground">
            {verbatimText}
          </blockquote>
        )}
        <DialogFooter>
          <Button onClick={onConfirm}>Clarified — continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
