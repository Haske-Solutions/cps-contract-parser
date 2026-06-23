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

export function ChildSharingClarifyGate({ verbatimText, onConfirm }: Props) {
  return (
    <Dialog open>
      <DialogContent showCloseButton={false} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Child sharing policy needs clarification</DialogTitle>
          <DialogDescription>
            The contract child-sharing terms are ambiguous or incomplete. Review the policy in Step 2
            and confirm the computation before extras rows are generated.
          </DialogDescription>
        </DialogHeader>
        {verbatimText && (
          <blockquote className="text-xs border-l-2 border-border pl-3 italic text-muted-foreground">
            {verbatimText}
          </blockquote>
        )}
        <DialogFooter>
          <Button onClick={onConfirm}>I have clarified the policy — continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
