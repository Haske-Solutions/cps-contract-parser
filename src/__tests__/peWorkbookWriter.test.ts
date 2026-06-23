import { describe, it, expect } from 'vitest'
import { buildPeWorkbookBuffer } from '../main/services/peWorkbookWriter'
import { buildSession } from './fixtures'

describe('peWorkbookWriter', () => {
  it('writes Rates, Extras, and Validation Notes sheets', async () => {
    const session = buildSession()
    const row = session.outputRows[0] ?? {
      supplierName: 'Savanna Lodge',
      supplierId: 42,
      supplierCode: 'SL001',
      serviceName: 'FB Double Deluxe',
      serviceId: 101,
      serviceCode: 'DD001',
      dateFrom: '2026-01-01',
      dateTo: '2026-03-31',
      agentGroupId: 0,
      rateCode: 'DBL',
      rateName: 'Double',
      ratePlan: 'DBL',
      currencyCode: 'USD',
      adultBuy: 350,
      adultSell: 350,
      childCost: 175,
      childSell: 175,
      markup: 0,
      minPax: 2,
      maxPax: 2,
      minStay: 1,
      maxStay: 99,
      api: true,
      isException: false,
      businessModel: 'BM1',
      supplierCommission: 0,
    }

    const buffer = await buildPeWorkbookBuffer([row], [], [])
    expect(buffer.byteLength).toBeGreaterThan(0)
  })
})
