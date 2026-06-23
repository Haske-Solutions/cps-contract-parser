import type { ValidationFlag, ValidationNote } from './types'

export function validationFlagsToNotes(flags: ValidationFlag[]): ValidationNote[] {
  return flags.map((f) => ({
    itemType: severityToItemType(f.severity),
    serviceName: f.affectedService ?? '',
    issue: f.message,
    actionRequired: f.details ?? actionForSeverity(f.severity),
  }))
}

function severityToItemType(severity: ValidationFlag['severity']): string {
  switch (severity) {
    case 'stop':
      return 'STOP'
    case 'needs_creation':
      return 'NEEDS CREATION'
    case 'rate_change':
      return 'Rate Change'
    default:
      return 'Info'
  }
}

function actionForSeverity(severity: ValidationFlag['severity']): string {
  switch (severity) {
    case 'needs_creation':
      return 'Create service in PE before import'
    case 'rate_change':
      return 'Review rate change vs prior year'
    case 'stop':
      return 'Resolve before export'
    default:
      return 'Review'
  }
}

export function appendValidationNote(
  notes: ValidationNote[],
  note: ValidationNote,
): void {
  notes.push(note)
}
