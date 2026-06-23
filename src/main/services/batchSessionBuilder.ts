import { matchAccommodationRates } from '../../shared/serviceMatcher'
import { buildExportSession, type BuildExportSessionParams } from '../../shared/sessionBuilder'
import type { ExtractionResult, ParseSession, PEService, ServiceMatch, Supplier } from '../../shared/types'
import {
  extrasMatch,
  policyServiceMatch,
  priorRates,
  serviceMatch,
} from './warehouseService'

export function peServicesFromCatalog(catalog: ServiceMatch[]): PEService[] {
  return catalog
    .filter((m) => m.peServiceId != null && m.peServiceName && m.peServiceCode)
    .map((m) => ({
      id: m.peServiceId!,
      name: m.peServiceName!,
      code: m.peServiceCode!,
    }))
}

export async function buildBatchExportSession(
  supplier: Supplier,
  extraction: ExtractionResult,
  sessionId: string,
): Promise<ParseSession> {
  const [catalog, extrasMatches, policyMatches, prior] = await Promise.all([
    serviceMatch(supplier.supplier_id),
    extrasMatch(supplier.supplier_id),
    policyServiceMatch(supplier.supplier_id),
    priorRates(supplier.supplier_id, ''),
  ])

  const serviceMatches = matchAccommodationRates(
    extraction.rates,
    peServicesFromCatalog(catalog),
  )

  const params: BuildExportSessionParams = {
    id: `${sessionId}-batch-${supplier.supplier_id}`,
    supplier,
    extraction,
    serviceMatches,
    extrasMatches,
    policyMatches,
    priorRates: prior,
    mode: 'batch',
  }

  return buildExportSession(params)
}
