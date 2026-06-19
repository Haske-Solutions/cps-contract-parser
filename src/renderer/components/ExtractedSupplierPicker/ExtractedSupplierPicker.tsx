import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Building2, Sparkles } from 'lucide-react'
import type { ExtractionBatchResult, ExtractionResult, Supplier } from '@shared/types'
import { isExtractionSuggestedForSupplier } from '@shared/extractionUtils'

interface Props {
  batch: ExtractionBatchResult
  peSupplier: Supplier
  onSelect: (extraction: ExtractionResult) => void
}

export function ExtractedSupplierPicker({ batch, peSupplier, onSelect }: Props) {
  const hasSuggestion = batch.suppliers.some((entry) =>
    isExtractionSuggestedForSupplier(entry, peSupplier),
  )

  return (
    <section aria-labelledby="extracted-supplier-heading" className="flex flex-col gap-4">
      <h2 id="extracted-supplier-heading" className="text-base font-heading font-semibold">
        Select Extracted Supplier
      </h2>

      <Alert>
        <AlertCircle className="size-4" />
        <AlertTitle>Multiple suppliers found in documents</AlertTitle>
        <AlertDescription>
          The PDFs contain {batch.suppliers.length} supplier contracts. Choose which extracted
          contract to use for this session. You selected{' '}
          <span className="font-medium text-foreground">{peSupplier.name}</span> in Pink Elephant
          {hasSuggestion
            ? ' — a suggested match is highlighted below.'
            : ' — none of the extracted names closely match, so review each option carefully.'}
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-2" role="list" aria-label="Extracted supplier contracts">
        {batch.suppliers.map((entry, index) => (
          <ExtractedSupplierCard
            key={`${entry.supplierName}-${index}`}
            extraction={entry}
            suggested={isExtractionSuggestedForSupplier(entry, peSupplier)}
            onSelect={() => onSelect(entry)}
          />
        ))}
      </div>
    </section>
  )
}

interface CardProps {
  extraction: ExtractionResult
  suggested: boolean
  onSelect: () => void
}

function ExtractedSupplierCard({ extraction, suggested, onSelect }: CardProps) {
  return (
    <Card
      role="listitem"
      className={suggested ? 'border-primary/40 bg-accent/15' : undefined}
    >
      <CardHeader className="py-3 px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"
              aria-hidden="true"
            >
              <Building2 className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm">{extraction.supplierName}</CardTitle>
                {suggested && (
                  <Badge variant="default" className="text-[10px] gap-1">
                    <Sparkles className="size-3" aria-hidden="true" />
                    Suggested match
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {extraction.contractPeriod.from} — {extraction.contractPeriod.to}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-[10px] tabular-nums">
                  {extraction.rates.length} rate{extraction.rates.length === 1 ? '' : 's'}
                </Badge>
                <Badge variant="outline" className="text-[10px] tabular-nums">
                  {extraction.policies.length} polic
                  {extraction.policies.length === 1 ? 'y' : 'ies'}
                </Badge>
                {extraction.properties.length > 0 && (
                  <span className="text-xs text-muted-foreground truncate max-w-full">
                    {extraction.properties.join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button size="sm" className="shrink-0" onClick={onSelect}>
            Use this supplier
          </Button>
        </div>
      </CardHeader>
    </Card>
  )
}
