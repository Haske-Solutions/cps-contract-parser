import { describe, it, expect } from 'vitest'
import { IpcValidationError } from '../main/ipc/validate'
import {
  assertString,
  assertSupplierArray,
  assertExtractionMappingTargets,
  toUint8Array,
} from '../main/ipc/validate'

describe('ipc validate', () => {
  it('assertString rejects non-strings', () => {
    expect(() => assertString(42, 'field')).toThrow(IpcValidationError)
  })

  it('assertString rejects empty strings by default', () => {
    expect(() => assertString('   ', 'field')).toThrow(IpcValidationError)
  })

  it('toUint8Array accepts Uint8Array and Buffer', () => {
    const bytes = new Uint8Array([1, 2, 3])
    expect(toUint8Array(bytes, 'pdf')).toEqual(bytes)
    expect(toUint8Array(Buffer.from([4, 5]), 'pdf')).toEqual(Uint8Array.from([4, 5]))
  })

  it('toUint8Array rejects invalid payloads', () => {
    expect(() => toUint8Array('not-bytes', 'pdf')).toThrow(IpcValidationError)
    expect(() => toUint8Array(null, 'pdf')).toThrow(/pdf is required/)
  })

  it('assertSupplierArray validates supplier shape', () => {
    const suppliers = assertSupplierArray(
      [
        {
          supplier_id: 1,
          name: 'Lodge A',
          code: 'LA',
          destination_country: 'Kenya',
        },
      ],
      'peCatalog',
    )
    expect(suppliers[0].supplier_id).toBe(1)
  })

  it('assertSupplierArray coerces null destination_country to empty string', () => {
    const suppliers = assertSupplierArray(
      [{ supplier_id: 8, name: 'Lodge B', code: 'LB', destination_country: null }],
      'peCatalog',
    )
    expect(suppliers[0].destination_country).toBe('')
  })

  it('assertString allows empty servicePattern for priorRates', () => {
    expect(assertString('', 'servicePattern', { allowEmpty: true })).toBe('')
  })

  it('assertExtractionMappingTargets validates mapping targets', () => {
    const targets = assertExtractionMappingTargets(
      [{ peSupplierId: 10, propertyLabel: 'Camp' }],
      'targets',
    )
    expect(targets).toEqual([{ peSupplierId: 10, propertyLabel: 'Camp' }])
  })
})
