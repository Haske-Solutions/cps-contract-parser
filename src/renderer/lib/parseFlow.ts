import type { ParseSession } from '@shared/types'

export const LOADING_MESSAGES: Record<ParseSession['step'], string> = {
  1: 'Discovering suppliers…',
  2: 'Extracting rates from PDF…',
  3: 'Matching PE services…',
  4: 'Loading prior year rates…',
  5: 'Generating Excel workbook…',
  6: 'Preparing download…',
}

export function isSessionInProgress(session: Pick<ParseSession, 'step' | 'status'>): boolean {
  if (session.step === 1 && session.status === 'idle') return false
  if (session.status === 'complete') return false
  return session.step >= 1 && session.step <= 6
}

export function statusLabel(status: ParseSession['status']): string {
  switch (status) {
    case 'idle':
      return 'Ready'
    case 'loading':
      return 'Processing'
    case 'awaiting_supplier_mapping':
      return 'Map Suppliers'
    case 'awaiting_supplier_selection':
      return 'Select Extracted Supplier'
    case 'awaiting_confirmation':
      return 'Awaiting Review'
    case 'awaiting_mismatch':
      return 'Mismatch Review'
    case 'blocked':
      return 'Blocked'
    case 'complete':
      return 'Complete'
    default:
      return status
  }
}
