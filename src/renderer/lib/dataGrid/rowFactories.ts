import type { ExtractedRate, ExtrasRow, RateRow, PriorRate, ServiceMatch } from '@shared/types'
import {
  DEFAULT_BUSINESS_MODEL,
  DEFAULT_SUPPLIER_COMMISSION,
  DEFAULT_TAX_CODE,
  MIN_PAX_FALLBACK,
  MAX_PAX_FALLBACK,
  MIN_STAY_FALLBACK,
  MAX_STAY_FALLBACK,
} from '@shared/constants'

export function createEmptyExtractedRate(seed?: Partial<ExtractedRate>): ExtractedRate {
  return {
    propertyName: seed?.propertyName ?? '',
    roomType: '',
    mealBasis: seed?.mealBasis ?? 'Full Board',
    seasonName: '',
    validFrom: seed?.validFrom ?? '',
    validTo: seed?.validTo ?? '',
    rateAmount: 0,
    currency: seed?.currency ?? 'USD',
    rateCode: seed?.rateCode ?? 'DBL',
    occupancyRules: '',
    childRates: [],
    singleSupplement: null,
    notes: '',
  }
}

export function createEmptyRateRow(template?: Partial<RateRow>): RateRow {
  return {
    supplierName: template?.supplierName ?? '',
    supplierId: template?.supplierId ?? 0,
    supplierCode: template?.supplierCode ?? '',
    serviceName: template?.serviceName ?? '',
    serviceId: 0,
    serviceCode: '',
    dateFrom: template?.dateFrom ?? '',
    dateTo: template?.dateTo ?? '',
    agentGroupId: 0,
    rateCode: template?.rateCode ?? 'PPPN',
    rateName: '',
    ratePlan: template?.ratePlan ?? '',
    currencyCode: 'USD',
    adultBuy: 0,
    adultSell: 0,
    childCost: 0,
    childSell: 0,
    markup: 0,
    minPax: template?.minPax ?? MIN_PAX_FALLBACK,
    maxPax: template?.maxPax ?? MAX_PAX_FALLBACK,
    minStay: template?.minStay ?? MIN_STAY_FALLBACK,
    maxStay: template?.maxStay ?? MAX_STAY_FALLBACK,
    api: true,
    isException: false,
    businessModel: DEFAULT_BUSINESS_MODEL,
    supplierCommission: DEFAULT_SUPPLIER_COMMISSION,
  }
}

export function createEmptyExtrasRow(template?: Partial<ExtrasRow>): ExtrasRow {
  return {
    supplierName: template?.supplierName ?? '',
    supplierCode: template?.supplierCode ?? '',
    supplierId: template?.supplierId ?? 0,
    parentServiceName: template?.parentServiceName ?? '',
    parentServiceCode: template?.parentServiceCode ?? '',
    parentServiceId: template?.parentServiceId ?? 0,
    extraType: '',
    extraName: template?.extraName ?? '',
    dateFrom: template?.dateFrom ?? '',
    dateTo: template?.dateTo ?? '',
    agentGroupId: 0,
    rateCode: template?.rateCode ?? 'PPPN',
    rateName: '',
    currency: 'USD',
    cost: null,
    sell: null,
    pricePercent: null,
    taxCode: DEFAULT_TAX_CODE,
    childOnly: false,
    infantOnly: false,
    markup: false,
    discount: false,
    mandatory: false,
    noReport: false,
    commission: false,
    capacityChange: false,
    percentFromChildPrice: false,
    noVoucher: false,
    internalRowType: template?.internalRowType ?? 'other',
  }
}

export function createEmptyServiceMatch(template?: Partial<ServiceMatch>): ServiceMatch {
  return {
    extractedName: template?.extractedName ?? '',
    peServiceId: null,
    peServiceName: null,
    peServiceCode: null,
    status: 'needs_creation',
    candidates: [],
  }
}

export function createEmptyPriorRate(template?: Partial<PriorRate>): PriorRate {
  return {
    serviceName: template?.serviceName ?? '',
    adultCost: 0,
    childCost: template?.childCost ?? 0,
    rateType: template?.rateType ?? '',
    currency: template?.currency ?? 'USD',
    logTimestamp: template?.logTimestamp ?? new Date().toISOString(),
    percentChange: null,
  }
}
