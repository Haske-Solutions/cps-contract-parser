import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { FileUpload } from '../../components/FileUpload/FileUpload'
import { StepProgress } from '../../components/StepProgress/StepProgress'
import { SupplierMappingGate } from '../../components/SupplierMappingGate/SupplierMappingGate'
import { PolicyReview } from '../../components/PolicyReview/PolicyReview'
import { ExtractedSupplierPicker } from '../../components/ExtractedSupplierPicker/ExtractedSupplierPicker'
import { MismatchGate } from '../../components/MismatchGate/MismatchGate'
import { ValidationReport } from '../../components/ValidationReport/ValidationReport'
import { ExcelPreview } from '../../components/ExcelPreview/ExcelPreview'
import { ServiceMatchingPanel } from '../../components/ServiceMatching/ServiceMatchingPanel'
import { PriorRatePanel } from '../../components/PriorRate/PriorRatePanel'
import { SessionBanner } from '../../components/layout/SessionBanner'
import { ConfirmDialog } from '../../components/layout/ConfirmDialog'
import { useSessionStore } from '../../store/sessionStore'
import { useBatchSessionStore } from '../../store/batchSessionStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle } from 'lucide-react'
import type {
  Supplier,
  MismatchResolution,
  ExtractionBatchResult,
  ExtractionResult,
  ExtractedPolicy,
  ExtractedRate,
  SupplierMapping,
  PropertyMappingGroup,
  SupplierWalkthroughContext,
  CompletedSupplierExport,
  ExtractionProgress,
  ExtractionPropertyComplete,
} from '@shared/types'
import { toArrayBuffer, toExportSession } from '@shared/sessionUtils'
import { isExtractionSuggestedForSupplier } from '@shared/extractionUtils'
import {
  buildMappingGroups,
  flattenMappingGroups,
  shouldFastPathMapping,
  buildFastPathMappings,
  includedMappingsInOrder,
} from '@shared/supplierMatching'
import { anchorTermFromFilenames, catalogAnchorTermsFromFilenames, deriveSupplierSearchTerm } from '@shared/supplierSearch'
import { detectMismatches } from '../../lib/mismatchDetection'
import { enrichPriorRatesWithNew, computeRateChangeServiceIds } from '../../lib/rateComparison'
import { LOADING_MESSAGES } from '../../lib/parseFlow'
import { MAX_PROPERTIES_PER_RUN, PARSER_PROXY_TIMEOUT_MS } from '@shared/constants'
import {
  capIncludedSelections,
  countRemainingReviewable,
  prepareGroupsForNextBatch,
  sortMappingGroupsForDisplay,
} from '@shared/mappingSelection'

function waitForWalkthroughExtraction(
  peSupplierId: number,
  timeoutMs: number,
): Promise<ExtractionResult> {
  const existing = useBatchSessionStore.getState().walkthrough?.extractionsByPeId[peSupplierId]
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub()
      reject(new Error('Timed out waiting for rate extraction to finish.'))
    }, timeoutMs)

    const unsub = useBatchSessionStore.subscribe((state) => {
      const extraction = state.walkthrough?.extractionsByPeId[peSupplierId]
      if (extraction) {
        clearTimeout(timeout)
        unsub()
        resolve(extraction)
      }
    })
  })
}

export function ParseSession() {
  const store = useSessionStore()
  const batchStore = useBatchSessionStore()
  const [ratePDFFile, setRatePDFFile] = useState<File | null>(null)
  const [contractFormFile, setContractFormFile] = useState<File | null>(null)
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [mappingGroups, setMappingGroups] = useState<PropertyMappingGroup[]>([])
  const [unmatchedPeSuppliers, setUnmatchedPeSuppliers] = useState<Supplier[]>([])
  const [showMismatchGate, setShowMismatchGate] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isBatchGenerating, setIsBatchGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [extractionProgress, setExtractionProgress] = useState<ExtractionProgress | null>(null)
  const [batchExtractionInFlight, setBatchExtractionInFlight] = useState(false)
  const [excelBuffer, setExcelBuffer] = useState<ArrayBuffer | null>(null)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [extractionBatch, setExtractionBatch] = useState<ExtractionBatchResult | null>(null)
  const workbookRegenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleExtractedSupplierSelect = useCallback(
    (extraction: ExtractionResult) => {
      if (!store.supplier) return
      setExtractionBatch(null)
      store.setExtraction(extraction)
      store.setStatus('awaiting_confirmation')
      if (!isExtractionSuggestedForSupplier(extraction, store.supplier)) {
        toast.message('Selected supplier differs from Pink Elephant', {
          description: `Continuing with "${extraction.supplierName}". PE record: "${store.supplier.name}".`,
        })
      }
    },
    [store],
  )

  const canStart = ratePDFFile !== null && contractFormFile !== null
  const hasStop = store.validationFlags.some((f) => f.severity === 'stop')
  const needsCreationIds = new Set(
    [...store.serviceMatches, ...store.extrasMatches, ...store.policyMatches]
      .filter((m) => m.status === 'needs_creation')
      .map((m) => m.peServiceId ?? -1),
  )

  const exportRowSeed = useMemo(() => {
    const extraction = store.extraction
    if (!extraction) return undefined
    return {
      supplierName: extraction.supplierName,
      supplierId: extraction.peSupplierId ?? 0,
      supplierCode: extraction.peSupplierCode ?? '',
      validFrom: extraction.contractPeriod.from,
      validTo: extraction.contractPeriod.to,
    }
  }, [store.extraction])

  const regenerateWorkbookBuffer = useCallback(async (): Promise<ArrayBuffer | null> => {
    if (store.outputRows.length === 0 && store.extrasRows.length === 0) return null
    try {
      const result = await window.electronAPI.export.buildWorkbook(
        store.outputRows,
        store.extrasRows,
        store.validationFlags,
      )
      const buffer = toArrayBuffer(result.buffer)
      setExcelBuffer(buffer)
      return buffer
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Workbook regeneration failed')
      return null
    }
  }, [store.outputRows, store.extrasRows, store.validationFlags])

  const scheduleWorkbookRegen = useCallback(() => {
    if (workbookRegenTimerRef.current) clearTimeout(workbookRegenTimerRef.current)
    workbookRegenTimerRef.current = setTimeout(() => {
      void regenerateWorkbookBuffer()
    }, 400)
  }, [regenerateWorkbookBuffer])

  const handleRateRowsChange = useCallback(
    (rows: typeof store.outputRows) => {
      store.setOutputRows(rows)
      scheduleWorkbookRegen()
    },
    [store, scheduleWorkbookRegen],
  )

  const handleExtrasRowsChange = useCallback(
    (rows: typeof store.extrasRows) => {
      store.setExtrasRows(rows)
      scheduleWorkbookRegen()
    },
    [store, scheduleWorkbookRegen],
  )

  const handleServiceMatchesChange = useCallback(
    (matches: typeof store.serviceMatches) => {
      store.setServiceMatches(matches)
    },
    [store],
  )

  const handleExtrasMatchesChange = useCallback(
    (matches: typeof store.extrasMatches) => {
      store.setExtrasMatches(matches)
    },
    [store],
  )

  const handlePolicyMatchesChange = useCallback(
    (matches: typeof store.policyMatches) => {
      store.setPolicyMatches(matches)
    },
    [store],
  )

  const handlePriorRatesChange = useCallback(
    (rates: typeof store.priorRates) => {
      store.setPriorRates(rates)
    },
    [store],
  )

  const selectMatchCandidate = useCallback(
    (
      matches: typeof store.serviceMatches,
      updater: (extractedName: string, candidate: { id: number; name: string; code: string }) => void,
      extractedName: string,
      candidateId: number,
    ) => {
      const match = matches.find((m) => m.extractedName === extractedName)
      const candidate = match?.candidates.find((c) => c.id === candidateId)
      if (candidate) updater(extractedName, candidate)
    },
    [],
  )

  const handleSelectServiceMatch = useCallback(
    (extractedName: string, candidateId: number) => {
      selectMatchCandidate(store.serviceMatches, store.updateServiceMatch, extractedName, candidateId)
    },
    [store, selectMatchCandidate],
  )

  const handleSelectExtrasMatch = useCallback(
    (extractedName: string, candidateId: number) => {
      selectMatchCandidate(store.extrasMatches, store.updateExtrasMatch, extractedName, candidateId)
    },
    [store, selectMatchCandidate],
  )

  const handleSelectPolicyMatch = useCallback(
    (extractedName: string, candidateId: number) => {
      selectMatchCandidate(store.policyMatches, store.updatePolicyMatch, extractedName, candidateId)
    },
    [store, selectMatchCandidate],
  )
  const enrichedPriorRates = useMemo(
    () =>
      enrichPriorRatesWithNew(store.priorRates, store.extraction, [
        ...store.serviceMatches,
        ...store.extrasMatches,
        ...store.policyMatches,
      ]),
    [store.priorRates, store.extraction, store.serviceMatches, store.extrasMatches, store.policyMatches],
  )

  const rateChangeServiceIds = useMemo(
    () => computeRateChangeServiceIds(enrichedPriorRates, store.serviceMatches),
    [enrichedPriorRates, store.serviceMatches],
  )

  const fileToBytes = (file: File): Promise<Uint8Array> =>
    file.arrayBuffer().then((buf) => new Uint8Array(buf))

  const queuePosition = useMemo(() => {
    const walkthrough = batchStore.walkthrough
    if (!walkthrough || walkthrough.queue.length <= 1 || walkthrough.status === 'complete') {
      return null
    }
    return {
      current: walkthrough.currentIndex + 1,
      total: walkthrough.queue.length,
    }
  }, [batchStore.walkthrough])

  const walkthroughComplete = batchStore.walkthrough?.status === 'complete'

  const remainingReviewable = useMemo(
    () => countRemainingReviewable(mappingGroups, new Set(batchStore.reviewedPeIds)),
    [mappingGroups, batchStore.reviewedPeIds],
  )

  const mappingBatchNumber = useMemo(
    () => Math.floor(batchStore.reviewedPeIds.length / MAX_PROPERTIES_PER_RUN) + 1,
    [batchStore.reviewedPeIds.length],
  )

  const sessionReviewComplete =
    batchStore.reviewedPeIds.length > 0 && remainingReviewable === 0

  const backgroundExtractionsRemaining = useMemo(() => {
    const walkthrough = batchStore.walkthrough
    if (!batchExtractionInFlight || !walkthrough) return 0
    return walkthrough.queue.length - Object.keys(walkthrough.extractionsByPeId).length
  }, [batchExtractionInFlight, batchStore.walkthrough])

  useEffect(() => {
    const unsubscribe = window.electronAPI.parser.onExtractionProgress(setExtractionProgress)
    return unsubscribe
  }, [])

  useEffect(() => {
    if (store.status !== 'loading') {
      setExtractionProgress(null)
    }
  }, [store.status])

  const loadingMessage = useMemo(() => {
    if (store.step === 2 && store.status === 'loading' && extractionProgress) {
      const { current, total, supplierName, status } = extractionProgress
      if (status === 'cached') {
        return `Using cached extraction for ${supplierName} (${current} of ${total})…`
      }
      return `Extracting rates for ${supplierName} (${current} of ${total})…`
    }
    if (store.step === 2 && store.status === 'loading') {
      const count = includedMappingsInOrder(batchStore.mappings).length
      if (count > 1) {
        return `Preparing extraction for ${Math.min(count, MAX_PROPERTIES_PER_RUN)} properties…`
      }
    }
    return LOADING_MESSAGES[store.step]
  }, [store.step, store.status, batchStore.mappings, extractionProgress])

  const startSupplierReview = useCallback(
    (walkthrough: SupplierWalkthroughContext, index: number) => {
      const mapping = walkthrough.queue[index]
      if (!mapping?.peSupplier) {
        throw new Error('Selected property is missing a Pink Elephant supplier.')
      }

      const extraction = walkthrough.extractionsByPeId[mapping.peSupplier.supplier_id]
      if (!extraction) {
        throw new Error(`Could not extract rates for "${mapping.peSupplier.name}".`)
      }

      store.resetSupplierWorkflow()
      store.setSupplier(mapping.peSupplier)
      store.setExtraction(extraction)
      setExtractionBatch(null)
      setExcelBuffer(null)
      setShowMismatchGate(false)
      store.setStep(2)
      store.setStatus('awaiting_confirmation')
    },
    [store],
  )

  const runExtractionForMappings = useCallback(
    async (mappings: SupplierMapping[], peCatalog: Supplier[]) => {
      const reviewedSet = new Set(batchStore.reviewedPeIds)
      const queue = includedMappingsInOrder(mappings).filter(
        (m) => m.peSupplier && !reviewedSet.has(m.peSupplier.supplier_id),
      )

      if (queue.length === 0) {
        throw new Error('Select at least one unreviewed property to continue.')
      }

      if (queue.length > MAX_PROPERTIES_PER_RUN) {
        throw new Error(
          `Select at most ${MAX_PROPERTIES_PER_RUN} properties per batch (selected ${queue.length}).`,
        )
      }

      store.setStep(2)
      store.setStatus('loading')
      setBatchExtractionInFlight(true)

      const anchorTerm = batchStore.anchorTerm
      const targets = queue.map((m) => ({
        peSupplierId: m.peSupplier!.supplier_id,
        propertyLabel: m.detected?.extractedName,
      }))

      let walkthroughStarted = false
      let partialWalkthrough: SupplierWalkthroughContext | null = null

      const unsubscribeProperty = window.electronAPI.parser.onExtractionPropertyComplete(
        ({ peSupplierId, extraction, completed, total }: ExtractionPropertyComplete) => {
          const baseWalkthrough: SupplierWalkthroughContext = partialWalkthrough ?? {
            anchorTerm,
            queue,
            currentIndex: 0,
            extractionsByPeId: {},
            completedExports: [],
            status: 'in_progress',
          }

          partialWalkthrough = {
            ...baseWalkthrough,
            extractionsByPeId: {
              ...baseWalkthrough.extractionsByPeId,
              [peSupplierId]: extraction,
            },
          }
          batchStore.setWalkthrough(partialWalkthrough)

          if (!walkthroughStarted) {
            walkthroughStarted = true
            store.setStatus('awaiting_confirmation')
            startSupplierReview(partialWalkthrough, 0)
            if (total > 1) {
              const remaining = total - completed
              toast.message(`Reviewing ${total} properties (batch ${mappingBatchNumber})`, {
                description:
                  remaining > 0
                    ? `${remaining} more ${remaining === 1 ? 'property' : 'properties'} extracting in the background while you review.`
                    : 'You will walk through each property in Steps 2–6 before moving to the next.',
              })
            }
          }
        },
      )

      try {
        const extractionsByPeId = await window.electronAPI.parser.extractRatesForMappings(
          store.ratePDF!,
          store.contractForm!,
          peCatalog,
          targets,
        )

        const activeWalkthrough = useBatchSessionStore.getState().walkthrough
        const finalWalkthrough: SupplierWalkthroughContext = {
          anchorTerm,
          queue,
          currentIndex: activeWalkthrough?.currentIndex ?? 0,
          extractionsByPeId,
          completedExports: activeWalkthrough?.completedExports ?? [],
          status: activeWalkthrough?.status ?? 'in_progress',
        }
        batchStore.setWalkthrough(finalWalkthrough)

        if (!walkthroughStarted) {
          startSupplierReview(finalWalkthrough, 0)
        }
      } catch (err) {
        if (walkthroughStarted) {
          batchStore.setWalkthrough(null)
          store.resetSupplierWorkflow()
          store.setStep(2)
        }
        throw err
      } finally {
        unsubscribeProperty()
        setBatchExtractionInFlight(false)
      }
    },
    [store, batchStore, startSupplierReview, mappingBatchNumber],
  )

  const handleStart = useCallback(async () => {
    if (!ratePDFFile || !contractFormFile) return
    setErrorMessage(null)
    store.setStatus('loading')
    store.setStep(1)

    try {
      const [rateBytes, formBytes] = await Promise.all([
        fileToBytes(ratePDFFile),
        fileToBytes(contractFormFile),
      ])
      store.setRatePDF(rateBytes)
      store.setContractForm(formBytes)

      const anchorTerm = anchorTermFromFilenames(contractFormFile.name, ratePDFFile.name)
      const catalogAnchors = catalogAnchorTermsFromFilenames(
        contractFormFile.name,
        ratePDFFile.name,
      )
      batchStore.setAnchorTerm(anchorTerm)

      let peCatalog = await window.electronAPI.warehouse.accommodationSupplierCatalogForTerms(
        catalogAnchors,
      )
      batchStore.setPeCatalog(peCatalog)

      if (peCatalog.length === 0) {
        store.setStatus('blocked')
        setErrorMessage(
          `No accommodation suppliers found in Pink Elephant for "${anchorTerm}". Create suppliers in PE before proceeding.`,
        )
        return
      }

      const discovery = await window.electronAPI.parser.discoverSuppliers(
        rateBytes,
        formBytes,
        peCatalog,
        anchorTerm,
      )

      if (
        discovery.detectedSuppliers.length > peCatalog.length ||
        (discovery.detectedSuppliers.length > 2 && peCatalog.length <= 2)
      ) {
        const broadenAnchors = [
          ...catalogAnchors,
          discovery.anchorTerm,
          discovery.anchorTerm?.split(/\s+/)[0],
        ].filter((a): a is string => Boolean(a?.trim()))

        const expanded = await window.electronAPI.warehouse.accommodationSupplierCatalogForTerms(
          broadenAnchors,
        )
        if (expanded.length > peCatalog.length) {
          peCatalog = expanded
          batchStore.setPeCatalog(peCatalog)
          if (discovery.anchorTerm) {
            batchStore.setAnchorTerm(discovery.anchorTerm)
          }
        }
      }

      const contractFormPropertyTerm = deriveSupplierSearchTerm(contractFormFile.name)

      let mappings: SupplierMapping[]
      if (shouldFastPathMapping(peCatalog, discovery.detectedSuppliers)) {
        mappings = buildFastPathMappings(peCatalog, discovery.detectedSuppliers)
        batchStore.setMappings(mappings)
        await runExtractionForMappings(mappings, peCatalog)
        return
      }

      const grouped = buildMappingGroups(
        discovery.detectedSuppliers,
        peCatalog,
        contractFormPropertyTerm,
      )
      const cappedGroups = capIncludedSelections(
        sortMappingGroupsForDisplay(grouped.groups),
      )
      mappings = flattenMappingGroups(cappedGroups)
      setMappingGroups(cappedGroups)
      setUnmatchedPeSuppliers(grouped.unmatchedPe)
      batchStore.setMappings(mappings)
      setShowMappingModal(true)
      store.setStatus('awaiting_supplier_mapping')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to start session')
      store.setStatus('blocked')
    }
  }, [ratePDFFile, contractFormFile, store, batchStore, runExtractionForMappings])

  const handleMappingContinue = useCallback(
    async (mappings: SupplierMapping[]) => {
      setShowMappingModal(false)
      batchStore.setMappings(mappings)
      setErrorMessage(null)

      try {
        await runExtractionForMappings(mappings, batchStore.peCatalog)
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Rate extraction failed')
        store.setStatus('blocked')
      }
    },
    [store, batchStore, runExtractionForMappings],
  )

  const handleMappingCancel = useCallback(() => {
    setShowMappingModal(false)
    store.setStatus('blocked')
    store.setStep(1)
    setErrorMessage('Supplier mapping cancelled. Upload documents and try again.')
  }, [store])

  const handleRetryExtraction = useCallback(async () => {
    if (!store.supplier || !store.ratePDF || !store.contractForm) return
    store.setStep(2)
    store.setStatus('loading')
    setErrorMessage(null)
    try {
      const peCatalog = batchStore.peCatalog
      const mappings = batchStore.mappings.length
        ? batchStore.mappings
        : [
            {
              peSupplier: store.supplier,
              detected: null,
              matchStatus: 'matched' as const,
              confidence: 'manual' as const,
              contractFormMatch: true,
              included: true,
              isPrimary: true,
            },
          ]
      await runExtractionForMappings(mappings, peCatalog.length ? peCatalog : [store.supplier])
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Rate extraction failed')
      store.setStatus('blocked')
    }
  }, [store, batchStore, runExtractionForMappings])

  const runServiceMatching = useCallback(async () => {
    if (!store.supplier) return
    store.setStep(3)
    store.setStatus('loading')
    setErrorMessage(null)

    try {
      await window.electronAPI.parser.confirmPolicies(store.id, store.confirmedPolicies)

      const [serviceMatches, extrasMatches, policySvcMatches] = await Promise.all([
        window.electronAPI.warehouse.serviceMatch(store.supplier.supplier_id),
        window.electronAPI.warehouse.extrasMatch(store.supplier.supplier_id),
        window.electronAPI.warehouse.policyServiceMatch(store.supplier.supplier_id),
      ])

      store.setServiceMatches(serviceMatches)
      store.setPolicyMatches(policySvcMatches)
      store.setExtrasMatches(extrasMatches)
      store.setStatus('idle')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Service matching failed')
      store.setStatus('blocked')
    }
  }, [store])

  const handlePoliciesConfirmed = useCallback(
    async (policies: ExtractedPolicy[], rates: ExtractedRate[]) => {
      if (store.extraction) {
        store.setExtraction({ ...store.extraction, policies, rates })
      }
      store.setConfirmedPolicies(
        policies.map((p) => ({ type: p.type, confirmed: true })),
      )
      await runServiceMatching()
    },
    [store, runServiceMatching],
  )

  const runPriorRates = useCallback(async () => {
    if (!store.supplier) return
    store.setStep(4)
    store.setStatus('loading')
    setErrorMessage(null)

    try {
      const priorRates = await window.electronAPI.warehouse.priorRates(
        store.supplier.supplier_id,
        '',
      )
      store.setPriorRates(priorRates)
      store.setStatus('idle')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Prior rate lookup failed')
      store.setStatus('blocked')
    }
  }, [store])

  const handleContinueFromStep3 = useCallback(async () => {
    await runPriorRates()
  }, [runPriorRates])

  const proceedToStep5 = useCallback(async () => {
    store.setStep(5)
    store.setStatus('loading')
    setIsGenerating(true)
    setErrorMessage(null)

    try {
      const result = await window.electronAPI.export.generateExcel(toExportSession(store))
      store.setOutputRows(result.rateRows)
      store.setExtrasRows(result.extrasRows)
      store.setValidationFlags(result.flags)
      setExcelBuffer(toArrayBuffer(result.buffer))
      store.setStep(6)
      store.setStatus('complete')
      toast.success('Excel workbook generated')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Excel generation failed')
      store.setStatus('blocked')
    } finally {
      setIsGenerating(false)
    }
  }, [store])

  const handleContinueFromStep4 = useCallback(async () => {
    if (!store.extraction) {
      await proceedToStep5()
      return
    }

    const mismatches = detectMismatches(store.extraction)
    store.setMismatches(mismatches)

    if (mismatches.length > 0) {
      store.setStatus('awaiting_mismatch')
      setShowMismatchGate(true)
    } else {
      await proceedToStep5()
    }
  }, [store, proceedToStep5])

  const handleMismatchResolutions = useCallback(
    async (resolutions: MismatchResolution[]) => {
      setShowMismatchGate(false)
      resolutions.forEach((r) => store.resolveMismatch(r.field, r))
      await proceedToStep5()
    },
    [store, proceedToStep5],
  )

  const recordCurrentExport = useCallback(
    (buffer: ArrayBuffer): CompletedSupplierExport | null => {
      if (!store.supplier) return null
      return {
        supplierId: store.supplier.supplier_id,
        supplierName: store.supplier.name,
        supplierCode: store.supplier.code,
        filename: `CPS_${store.supplier.code}_rates.xlsx`,
        buffer: new Uint8Array(buffer),
        rateRowCount: store.outputRows.length,
        validationFlagCount: store.validationFlags.length,
      }
    },
    [store.supplier, store.outputRows.length, store.validationFlags.length],
  )

  const handleAdvanceToNextSupplier = useCallback(async () => {
    const walkthrough = batchStore.walkthrough
    if (!walkthrough || walkthrough.status !== 'in_progress') return

    const buffer = await regenerateWorkbookBuffer()
    const currentExport = buffer ? recordCurrentExport(buffer) : null
    if (!currentExport) {
      setErrorMessage('Generate the Excel workbook before continuing to the next property.')
      return
    }

    const nextIndex = walkthrough.currentIndex + 1
    const updatedWalkthrough: SupplierWalkthroughContext = {
      ...walkthrough,
      currentIndex: nextIndex,
      completedExports: [...walkthrough.completedExports, currentExport],
    }

    if (nextIndex >= walkthrough.queue.length) {
      const peIds = walkthrough.queue.map((m) => m.peSupplier!.supplier_id)
      const allReviewed = new Set([...batchStore.reviewedPeIds, ...peIds])
      batchStore.addReviewedBatch(peIds, updatedWalkthrough.completedExports)
      batchStore.setWalkthrough({ ...updatedWalkthrough, status: 'complete' })

      const remaining = countRemainingReviewable(mappingGroups, allReviewed)

      if (remaining > 0) {
        toast.success(`Batch complete — ${peIds.length} properties reviewed`, {
          description: `${remaining} properties remaining. Select up to ${MAX_PROPERTIES_PER_RUN} more to continue.`,
        })
      } else {
        toast.success(`All properties reviewed (${allReviewed.size} total)`)
      }
      return
    }

    batchStore.setWalkthrough(updatedWalkthrough)

    const nextMapping = walkthrough.queue[nextIndex]!
    const nextPeId = nextMapping.peSupplier?.supplier_id
    let walkthroughForReview = updatedWalkthrough
    if (nextPeId && !updatedWalkthrough.extractionsByPeId[nextPeId]) {
      const priorStep = store.step
      const priorStatus = store.status
      store.setStatus('loading')
      try {
        await waitForWalkthroughExtraction(nextPeId, PARSER_PROXY_TIMEOUT_MS)
        const latest = useBatchSessionStore.getState().walkthrough
        if (latest) {
          walkthroughForReview = {
            ...updatedWalkthrough,
            extractionsByPeId: latest.extractionsByPeId,
          }
          batchStore.setWalkthrough(walkthroughForReview)
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Timed out waiting for the next property extraction.'
        setErrorMessage(msg)
        store.setStep(priorStep)
        store.setStatus(priorStatus)
        toast.error(msg)
        return
      }
    }

    startSupplierReview(walkthroughForReview, nextIndex)
    toast.message(`Property ${nextIndex + 1} of ${walkthrough.queue.length}`, {
      description: nextMapping.peSupplier?.name,
    })
  }, [batchStore, recordCurrentExport, regenerateWorkbookBuffer, startSupplierReview, mappingGroups, store])

  const handleReviewMoreProperties = useCallback(() => {
    const prepared = prepareGroupsForNextBatch(mappingGroups)
    setMappingGroups(prepared)
    batchStore.setMappings(flattenMappingGroups(prepared))
    batchStore.setWalkthrough(null)
    setShowMappingModal(true)
    store.setStep(1)
    store.setStatus('awaiting_supplier_mapping')
    setErrorMessage(null)
    toast.message('Select up to 5 more properties', {
      description: `${remainingReviewable} properties remaining in this session.`,
    })
  }, [mappingGroups, batchStore, store, remainingReviewable])

  const handleDownloadAllZip = useCallback(async () => {
    const exports = batchStore.allSessionExports
    if (exports.length === 0) return

    setIsBatchGenerating(true)
    setErrorMessage(null)
    try {
      const entries = exports.map((entry) => ({
        filename: entry.filename,
        buffer: entry.buffer,
      }))
      const zipBuffer = await window.electronAPI.export.zipBuffers(entries)
      const year = new Date().getFullYear()
      const defaultName = `CPS_${batchStore.anchorTerm}_${year}_rates.zip`
      const savedPath = await window.electronAPI.export.saveZip(
        toArrayBuffer(zipBuffer),
        defaultName,
      )
      if (savedPath) {
        toast.success(`ZIP saved with ${entries.length} workbook${entries.length === 1 ? '' : 's'}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ZIP export failed'
      setErrorMessage(msg)
      toast.error(msg)
    } finally {
      setIsBatchGenerating(false)
    }
  }, [batchStore])

  const handleDownload = useCallback(async () => {
    if (hasStop) return
    if (store.outputRows.length === 0) {
      setErrorMessage('Excel file is not ready yet. Wait for generation to finish or retry.')
      return
    }
    setIsDownloading(true)
    setErrorMessage(null)
    try {
      const buffer = (await regenerateWorkbookBuffer()) ?? excelBuffer
      if (!buffer) {
        setErrorMessage('Excel file is not ready yet. Wait for generation to finish or retry.')
        return
      }
      const supplierCode = store.supplier?.code ?? 'export'
      const defaultName = `CPS_${supplierCode}_rates.xlsx`
      await window.electronAPI.file.saveExcel(buffer, defaultName)
      toast.success('Excel file saved')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed'
      setErrorMessage(msg)
      toast.error(msg)
    } finally {
      setIsDownloading(false)
    }
  }, [store, hasStop, excelBuffer, regenerateWorkbookBuffer])

  const handleReset = () => {
    store.resetSession()
    batchStore.resetBatch()
    setRatePDFFile(null)
    setContractFormFile(null)
    setMappingGroups([])
    setUnmatchedPeSuppliers([])
    setShowMappingModal(false)
    setShowMismatchGate(false)
    setErrorMessage(null)
    setExcelBuffer(null)
    setExtractionBatch(null)
    setShowResetDialog(false)
    toast('Session reset')
  }

  const retryForStep = store.step === 2
    ? handleRetryExtraction
    : store.step === 3
      ? runServiceMatching
      : store.step === 4
        ? runPriorRates
        : store.step === 5
          ? proceedToStep5
          : null

  const retryLabel =
    store.step === 2
      ? 'Retry Extraction'
      : store.step === 3
        ? 'Retry Matching'
        : store.step === 4
          ? 'Retry Prior Rates'
          : store.step === 5
            ? 'Retry Generation'
            : 'Retry'

  return (
    <div className="flex flex-col min-h-full">
      <SessionBanner
        supplier={store.supplier}
        step={store.step}
        status={store.status}
        queuePosition={queuePosition}
      />

      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" onClick={() => setShowResetDialog(true)}>
          New Session
        </Button>
      </div>

      <div className="flex-1 w-full flex flex-col gap-8">
        <StepProgress currentStep={store.step} status={store.status} />

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="flex items-start justify-between gap-4">
              <span>{errorMessage}</span>
              {store.status === 'blocked' && retryForStep && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={retryForStep}
                  className="shrink-0"
                >
                  {retryLabel}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {store.status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Spinner className="size-10 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {loadingMessage}
            </p>
          </div>
        )}

        {store.step === 1 && store.status !== 'loading' && (
          <section aria-labelledby="step1-heading" className="flex flex-col gap-6">
            <h2 id="step1-heading" className="sr-only">
              Step 1 — Upload Documents
            </h2>
            <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
              <FileUpload
                label="Supplier Rate Sheet PDF"
                description="The supplier's rate sheet — required"
                file={ratePDFFile}
                onFile={setRatePDFFile}
              />
              <FileUpload
                label="CPS Contract Form"
                description="The signed CPS contract form — required"
                file={contractFormFile}
                onFile={setContractFormFile}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                onClick={handleStart}
                disabled={!canStart}
                aria-disabled={!canStart}
              >
                Start Parsing Session
              </Button>
              {!canStart && (
                <p className="text-xs text-muted-foreground" role="note">
                  Both PDFs are required before you can start.
                </p>
              )}
            </div>
          </section>
        )}

        <Dialog
          open={showMappingModal}
          onOpenChange={(open) => {
            if (!open) return
            setShowMappingModal(open)
          }}
        >
          <DialogContent
            className="flex h-[min(92vh,960px)] max-h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
            showCloseButton={false}
          >
            <DialogHeader className="shrink-0 border-b border-border/80 bg-accent/25 px-5 py-4 text-left">
              <DialogTitle className="font-heading text-lg">Supplier Mapping</DialogTitle>
              <DialogDescription>
                Map detected PDF suppliers to Pink Elephant records. Only the property on your
                uploaded contract form can be selected — other properties are shown for context but
                blocked. Select up to {MAX_PROPERTIES_PER_RUN} properties per batch — already-reviewed
                properties are marked and disabled.
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5 pt-4">
              <SupplierMappingGate
                anchorTerm={batchStore.anchorTerm}
                contractFormPropertyTerm={deriveSupplierSearchTerm(contractFormFile?.name ?? '')}
                peCatalog={batchStore.peCatalog}
                groups={mappingGroups}
                unmatchedPe={unmatchedPeSuppliers}
                reviewedPeIds={batchStore.reviewedPeIds}
                batchNumber={mappingBatchNumber}
                onGroupsChange={(groups) => {
                  setMappingGroups(groups)
                }}
                onContinue={handleMappingContinue}
                onCancel={handleMappingCancel}
              />
            </div>
          </DialogContent>
        </Dialog>

        {store.step === 2 &&
          store.status === 'awaiting_supplier_selection' &&
          extractionBatch &&
          store.supplier && (
            <ExtractedSupplierPicker
              batch={extractionBatch}
              peSupplier={store.supplier}
              onSelect={handleExtractedSupplierSelect}
            />
          )}

        {store.step === 2 && store.status === 'awaiting_confirmation' && store.extraction && (
          <section aria-labelledby="step2-heading">
            <h2 id="step2-heading" className="text-base font-heading font-semibold mb-4">
              Rate Extraction &amp; Policy Review
            </h2>
            {backgroundExtractionsRemaining > 0 && (
              <Alert className="mb-4">
                <AlertDescription>
                  Extracting {backgroundExtractionsRemaining} more{' '}
                  {backgroundExtractionsRemaining === 1 ? 'property' : 'properties'} in the
                  background. You can review this property while extraction continues.
                </AlertDescription>
              </Alert>
            )}
            <PolicyReview extraction={store.extraction} onConfirm={handlePoliciesConfirmed} />
          </section>
        )}

        {store.step === 3 && store.status !== 'loading' && (
          <ServiceMatchingPanel
            serviceMatches={store.serviceMatches}
            extrasMatches={store.extrasMatches}
            policyMatches={store.policyMatches}
            onSelectServiceMatch={handleSelectServiceMatch}
            onSelectExtrasMatch={handleSelectExtrasMatch}
            onSelectPolicyMatch={handleSelectPolicyMatch}
            onServiceMatchesChange={handleServiceMatchesChange}
            onExtrasMatchesChange={handleExtrasMatchesChange}
            onPolicyMatchesChange={handlePolicyMatchesChange}
            onContinue={handleContinueFromStep3}
          />
        )}

        {store.step === 4 && store.status !== 'loading' && (
          <PriorRatePanel
            priorRates={enrichedPriorRates}
            onPriorRatesChange={handlePriorRatesChange}
            onContinue={handleContinueFromStep4}
          />
        )}

        {showMismatchGate && store.mismatches.length > 0 && (
          <MismatchGate
            mismatches={store.mismatches}
            onResolveAll={handleMismatchResolutions}
          />
        )}

        {(store.step === 5 || store.step === 6) && store.status !== 'loading' && (
          <div className="flex flex-col gap-6">
            {store.step === 6 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-heading font-semibold">Validation Report</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{store.outputRows.length} Rates</Badge>
                  <Badge variant="secondary">{store.extrasRows.length} Extras</Badge>
                  <Badge
                    variant={
                      store.validationFlags.length === 0
                        ? 'secondary'
                        : hasStop
                          ? 'destructive'
                          : 'outline'
                    }
                  >
                    {store.validationFlags.length > 0
                      ? `${store.validationFlags.length} flag${store.validationFlags.length !== 1 ? 's' : ''}`
                      : 'No issues'}
                  </Badge>
                </div>
              </div>
            )}
            {store.step === 6 &&
              batchStore.walkthrough &&
              batchStore.walkthrough.status === 'in_progress' && (
                <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
                  <p className="text-sm font-medium">
                    {batchStore.walkthrough.queue.length > 1
                      ? `Property ${batchStore.walkthrough.currentIndex + 1} of ${batchStore.walkthrough.queue.length} complete`
                      : 'Property review complete'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {batchStore.walkthrough.currentIndex <
                    batchStore.walkthrough.queue.length - 1
                      ? `Continue to the next selected property: ${batchStore.walkthrough.queue[batchStore.walkthrough.currentIndex + 1]?.peSupplier?.name ?? '—'}.`
                      : 'Finish this batch to save workbooks and select more properties if needed.'}
                  </p>
                  <Button
                    onClick={handleAdvanceToNextSupplier}
                    disabled={excelBuffer === null || hasStop}
                    className="self-start"
                  >
                    {batchStore.walkthrough.currentIndex <
                    batchStore.walkthrough.queue.length - 1
                      ? 'Continue to next property'
                      : 'Finish batch'}
                  </Button>
                </div>
              )}
            {walkthroughComplete && batchStore.walkthrough && (
              <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 p-4 flex flex-col gap-3">
                <p className="text-sm font-medium text-foreground">
                  {sessionReviewComplete
                    ? `Session complete — ${batchStore.reviewedPeIds.length} properties reviewed`
                    : `Batch complete — ${batchStore.walkthrough.queue.length} properties reviewed`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {sessionReviewComplete
                    ? `Download individual workbooks above, or save all ${batchStore.allSessionExports.length} files as a ZIP archive.`
                    : `${remainingReviewable} properties remaining. Select up to ${MAX_PROPERTIES_PER_RUN} more to continue this session.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {!sessionReviewComplete && remainingReviewable > 0 && (
                    <Button onClick={handleReviewMoreProperties} className="self-start">
                      Review more properties
                    </Button>
                  )}
                  {batchStore.allSessionExports.length > 0 && (
                    <Button
                      onClick={handleDownloadAllZip}
                      disabled={isBatchGenerating}
                      variant={sessionReviewComplete ? 'default' : 'outline'}
                      className="self-start"
                    >
                      {isBatchGenerating ? (
                        <>
                          <Spinner className="size-4 mr-2" />
                          Building ZIP…
                        </>
                      ) : (
                        `Download all ${batchStore.allSessionExports.length} workbooks (ZIP)`
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
            <ValidationReport flags={store.validationFlags} />
            <ExcelPreview
              rateRows={store.outputRows}
              extrasRows={store.extrasRows}
              needsCreationServiceIds={needsCreationIds}
              rateChangeServiceIds={rateChangeServiceIds}
              rowSeed={exportRowSeed}
              onRateRowsChange={handleRateRowsChange}
              onExtrasRowsChange={handleExtrasRowsChange}
              onDownload={handleDownload}
              isDownloading={isDownloading}
              isGenerating={isGenerating}
              hasStop={hasStop}
              downloadReady={excelBuffer !== null}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title="Start new session?"
        description="This will clear the current session progress. Uploaded files and extraction results will be lost."
        confirmLabel="New Session"
        variant="destructive"
        onConfirm={handleReset}
      />
    </div>
  )
}
