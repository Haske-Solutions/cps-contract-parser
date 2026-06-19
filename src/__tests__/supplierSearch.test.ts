import { describe, expect, it } from 'vitest'
import {
  deriveSupplierSearchTerm,
  supplierSearchTermsFromFilenames,
  anchorTermFromFilenames,
  catalogAnchorTermsFromFilenames,
} from '../shared/supplierSearch'

const contractForm =
  'CPS Elewana Tortilis Camp Amboseli Accommodation Contract Form 2027 KE.pdf'
const rateSheet = 'CPS Elewana Collection Rack & Net Rates 2027 KE & TZ.pdf'

describe('supplierSearch', () => {
  it('derives supplier name from contract form filename', () => {
    expect(deriveSupplierSearchTerm(contractForm)).toBe('Elewana Tortilis Camp Amboseli')
  })

  it('derives supplier name from rate sheet filename', () => {
    expect(deriveSupplierSearchTerm(rateSheet)).toBe('Elewana Collection')
  })

  it('returns unique search terms with contract form first', () => {
    expect(supplierSearchTermsFromFilenames(contractForm, rateSheet)).toEqual([
      'Elewana Tortilis Camp Amboseli',
      'Elewana Collection',
    ])
  })

  it('uses shared brand prefix as catalog anchor for group rate sheets', () => {
    expect(anchorTermFromFilenames(contractForm, rateSheet)).toBe('Elewana')
  })

  it('uses leading brand token when only one filename term is available', () => {
    expect(
      anchorTermFromFilenames(contractForm, contractForm),
    ).toBe('Elewana')
  })

  it('collects multiple catalog anchor candidates sorted broadest first', () => {
    const anchors = catalogAnchorTermsFromFilenames(contractForm, rateSheet)
    expect(anchors[0]).toBe('Elewana')
    expect(anchors).toContain('Elewana Tortilis')
  })
})
