import { cn } from '@/lib/utils'
import { STEP_LABELS } from '@shared/constants'
import type { ParseSession } from '@shared/types'

interface Props {
  currentStep: ParseSession['step']
  status: ParseSession['status']
  /** When on step 6, show the final step as completed (checkmark) instead of current. */
  markFinalStepComplete?: boolean
}

const STEPS = [1, 2, 3, 4, 5, 6] as const

export function StepProgress({ currentStep, status, markFinalStepComplete = false }: Props) {
  const isFinalStepDone = currentStep === 6 && markFinalStepComplete
  const progressPct = isFinalStepDone ? 100 : ((currentStep - 1) / (STEPS.length - 1)) * 100

  return (
    <nav aria-label="Parsing workflow progress" className="w-full">
      {/* Mobile: compact progress */}
      <div className="md:hidden flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            Step {currentStep} of {STEPS.length}
          </span>
          <span className="text-muted-foreground">{STEP_LABELS[currentStep]}</span>
        </div>
        <div
          className="h-1.5 w-full rounded-full bg-border overflow-hidden"
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label={`Step ${currentStep} of ${STEPS.length}: ${STEP_LABELS[currentStep]}`}
        >
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Desktop: horizontal stepper */}
      <ol className="hidden md:flex items-start w-full gap-0">
        {STEPS.map((step, i) => {
          const isComplete = step < currentStep || (step === currentStep && isFinalStepDone)
          const isCurrent = step === currentStep && !isFinalStepDone
          const isBlocked = isCurrent && status === 'blocked'
          const isLast = i === STEPS.length - 1
          const label = STEP_LABELS[step]

          return (
            <li
              key={step}
              className={cn('flex items-start', !isLast && 'flex-1')}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div className="flex flex-col items-center min-w-[72px]">
                <div
                  className={cn(
                    'size-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors',
                    isBlocked && 'bg-destructive/10 border-destructive text-destructive',
                    isComplete && 'bg-primary border-primary text-primary-foreground',
                      isCurrent &&
                      !isBlocked &&
                      'bg-background border-primary text-foreground',
                    !isComplete && !isCurrent && 'bg-background border-border text-muted-foreground',
                  )}
                  aria-label={`Step ${step}: ${label}${isComplete ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
                >
                  {isComplete ? (
                    <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                <span
                  className={cn(
                    'mt-2 text-[11px] text-center max-w-[88px] leading-tight',
                    isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 mt-[18px] rounded-full',
                    isComplete ? 'bg-primary' : 'bg-border',
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
