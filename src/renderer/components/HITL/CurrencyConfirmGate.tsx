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
  currencies: string[]
  onConfirm: () => void
}

export function CurrencyConfirmGate({ currencies, onConfirm }: Props) {
  return (
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Multi-currency contract</DialogTitle>
          <DialogDescription>
            This contract includes multiple currencies ({currencies.join(', ')}). Output will use USD.
            Non-USD amounts will be flagged in Validation Notes for FX review.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onConfirm}>Continue with USD output</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
