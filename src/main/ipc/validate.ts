export class IpcValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IpcValidationError'
  }
}

function fail(message: string): never {
  throw new IpcValidationError(message)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function assertString(value: unknown, field: string, { allowEmpty = false } = {}): string {
  if (typeof value !== 'string') {
    fail(`${field} must be a string.`)
  }
  if (!allowEmpty && value.trim().length === 0) {
    fail(`${field} must not be empty.`)
  }
  return value
}

export function assertOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined
  return assertString(value, field, { allowEmpty: true })
}

export function assertNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${field} must be a finite number.`)
  }
  return value
}

export function assertArray<T>(
  value: unknown,
  field: string,
  validateItem: (item: unknown, index: number) => T,
): T[] {
  if (!Array.isArray(value)) {
    fail(`${field} must be an array.`)
  }
  return value.map((item, index) => validateItem(item, index))
}

export function toUint8Array(value: unknown, field: string): Uint8Array {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value)
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return new Uint8Array(value)
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (isPlainObject(value) && value.type === 'Buffer' && Array.isArray(value.data)) {
    return Uint8Array.from(value.data as number[])
  }
  if (Array.isArray(value) && value.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 255)) {
    return Uint8Array.from(value)
  }
  fail(`${field} must be a byte array.`)
}

export function toArrayBuffer(value: unknown, field: string): ArrayBuffer {
  const bytes = toUint8Array(value, field)
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

export function assertSupplier(value: unknown, field: string): import('../../shared/types').Supplier {
  if (!isPlainObject(value)) fail(`${field} must be a supplier object.`)
  return {
    supplier_id: assertNumber(value.supplier_id, `${field}.supplier_id`),
    name: assertString(value.name, `${field}.name`),
    code: assertString(value.code ?? '', `${field}.code`, { allowEmpty: true }),
    destination_country: assertString(value.destination_country ?? '', `${field}.destination_country`, {
      allowEmpty: true,
    }),
  }
}

export function assertSupplierArray(value: unknown, field: string): import('../../shared/types').Supplier[] {
  return assertArray(value, field, (item, index) => assertSupplier(item, `${field}[${index}]`))
}

export function assertExtractionMappingTargets(
  value: unknown,
  field: string,
): import('../../shared/types').ExtractionMappingTarget[] {
  return assertArray(value, field, (item, index) => {
    if (!isPlainObject(item)) fail(`${field}[${index}] must be an object.`)
    const target: import('../../shared/types').ExtractionMappingTarget = {
      peSupplierId: assertNumber(item.peSupplierId, `${field}[${index}].peSupplierId`),
    }
    if (item.propertyLabel !== undefined) {
      target.propertyLabel = assertString(item.propertyLabel, `${field}[${index}].propertyLabel`, {
        allowEmpty: true,
      })
    }
    return target
  })
}

export function assertExtractRatesOptions(
  value: unknown,
): import('../../shared/parserInvoke').ExtractRatesOptions | undefined {
  if (value === undefined || value === null) return undefined
  if (!isPlainObject(value)) fail('options must be an object.')

  const options: import('../../shared/parserInvoke').ExtractRatesOptions = {}
  if (value.peCatalog !== undefined) {
    options.peCatalog = assertSupplierArray(value.peCatalog, 'options.peCatalog')
  }
  if (value.targetPeSupplierId !== undefined) {
    options.targetPeSupplierId = assertNumber(value.targetPeSupplierId, 'options.targetPeSupplierId')
  }
  if (value.targetPropertyLabel !== undefined) {
    options.targetPropertyLabel = assertString(value.targetPropertyLabel, 'options.targetPropertyLabel', {
      allowEmpty: true,
    })
  }
  return options
}

export function assertFileFilters(value: unknown, field: string): import('../../shared/types').FileFilter[] {
  return assertArray(value, field, (item, index) => {
    if (!isPlainObject(item)) fail(`${field}[${index}] must be a file filter object.`)
    return {
      name: assertString(item.name, `${field}[${index}].name`),
      extensions: assertArray(item.extensions, `${field}[${index}].extensions`, (ext, extIndex) =>
        assertString(ext, `${field}[${index}].extensions[${extIndex}]`),
      ),
    }
  })
}

export function assertZipEntries(
  value: unknown,
  field: string,
): Array<{ filename: string; buffer: Uint8Array }> {
  return assertArray(value, field, (item, index) => {
    if (!isPlainObject(item)) fail(`${field}[${index}] must be an object.`)
    return {
      filename: assertString(item.filename, `${field}[${index}].filename`),
      buffer: toUint8Array(item.buffer, `${field}[${index}].buffer`),
    }
  })
}

export function assertParseSession(value: unknown, field: string): import('../../shared/types').ParseSession {
  if (!isPlainObject(value)) fail(`${field} must be a parse session object.`)

  assertString(value.id, `${field}.id`)
  assertString(value.createdAt, `${field}.createdAt`)

  const step = assertNumber(value.step, `${field}.step`)
  if (![1, 2, 3, 4, 5, 6].includes(step)) {
    fail(`${field}.step must be between 1 and 6.`)
  }

  const status = assertString(value.status, `${field}.status`)
  const allowedStatuses = new Set([
    'idle',
    'loading',
    'awaiting_supplier_mapping',
    'awaiting_supplier_selection',
    'awaiting_confirmation',
    'awaiting_mismatch',
    'complete',
    'blocked',
  ])
  if (!allowedStatuses.has(status)) {
    fail(`${field}.status is invalid.`)
  }

  return value as unknown as import('../../shared/types').ParseSession
}

export function assertBatchSessionContext(
  value: unknown,
  field: string,
): import('../../shared/types').BatchSessionContext {
  if (!isPlainObject(value)) fail(`${field} must be a batch session context object.`)

  const extractions = value.extractionsByPeId
  if (!isPlainObject(extractions)) {
    fail(`${field}.extractionsByPeId must be an object.`)
  }

  return {
    anchorTerm: assertString(value.anchorTerm, `${field}.anchorTerm`),
    mappings: assertArray(value.mappings, `${field}.mappings`, (item, index) => {
      if (!isPlainObject(item)) fail(`${field}.mappings[${index}] must be an object.`)
      return item as unknown as import('../../shared/types').SupplierMapping
    }),
    primaryPeId: assertNumber(value.primaryPeId, `${field}.primaryPeId`),
    batchPeIds: assertArray(value.batchPeIds, `${field}.batchPeIds`, (item, index) =>
      assertNumber(item, `${field}.batchPeIds[${index}]`),
    ),
    extractionsByPeId: extractions as Record<number, import('../../shared/types').ExtractionResult>,
  }
}

export function assertConfirmedPolicies(
  value: unknown,
  field: string,
): import('../../shared/types').ConfirmedPolicy[] {
  return assertArray(value, field, (item, index) => {
    if (!isPlainObject(item)) fail(`${field}[${index}] must be an object.`)
    const type = assertString(item.type, `${field}[${index}].type`)
    const allowed = new Set([
      'CIOR',
      'children_sharing',
      'single_room',
      'free_child',
      'age_brackets',
      'triple_quad',
    ])
    if (!allowed.has(type)) fail(`${field}[${index}].type is invalid.`)
    if (typeof item.confirmed !== 'boolean') {
      fail(`${field}[${index}].confirmed must be a boolean.`)
    }
    return { type: type as import('../../shared/types').ConfirmedPolicy['type'], confirmed: item.confirmed }
  })
}
