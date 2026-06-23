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
  onConfirm: () => void
  onCancel: () => void
}

export function NoAccommodationGate({ onConfirm, onCancel }: Props) {
  return (
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>No accommodation rows matched</DialogTitle>
          <DialogDescription>
            No accommodation services were matched to extracted rates. This is unusual. Proceed only if
            you expect a non-accommodation-only export.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Go back
          </Button>
          <Button onClick={onConfirm}>Proceed anyway</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
