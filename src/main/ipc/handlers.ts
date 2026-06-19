import { ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import type { IpcMainInvokeEvent } from 'electron'
import type { ParseSession } from '../../shared/types'
import {
  getAwsRegion,
  saveAwsRegion,
  getAwsProfile,
  saveAwsProfile,
  getParserProxyUrl,
  saveParserProxyUrl,
  getParserApiKeyPreview,
  storeParserApiKey,
  removeParserApiKey,
  motherduckCredentialsConfigured,
  getMotherduckTokenPreview,
  storeMotherduckToken,
  removeMotherduckToken,
} from '../services/keystoreService'
import { extractRates, discoverSuppliers, extractRatesForMappings } from '../services/parserService'
import { testParserProxyConnection } from '../services/parserProxyClient'
import {
  supplierLookup,
  supplierLookupFromFilenames,
  accommodationSupplierCatalog,
  accommodationSupplierCatalogForTerms,
  serviceMatch,
  extrasMatch,
  policyServiceMatch,
  priorRates,
  testConnection,
} from '../services/warehouseService'
import { resetMotherduckConnection } from '../services/motherduckClient'
import { buildRows, generateExcel, buildWorkbookFromEditedRows } from '../services/exportService'
import { generateBatchZip, zipBufferEntries } from '../services/batchExportService'
import {
  listSessions,
  getSession,
  deleteSession,
  clearAllSessions,
  saveSession,
} from '../services/historyService'
import { logger } from '../services/logger'
import { IpcValidationError } from './validate'
import {
  assertArray,
  assertBatchSessionContext,
  assertConfirmedPolicies,
  assertExtractRatesOptions,
  assertExtractionMappingTargets,
  assertFileFilters,
  assertNumber,
  assertOptionalString,
  assertParseSession,
  assertString,
  assertSupplierArray,
  assertZipEntries,
  toArrayBuffer,
  toUint8Array,
} from './validate'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

function handle(channel: string, fn: Handler): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await fn(event, ...args)
    } catch (err) {
      if (err instanceof IpcValidationError) {
        logger.warn('ipc', `${channel}: ${err.message}`)
        throw err
      }
      logger.error('ipc', `${channel} failed`, err)
      throw err
    }
  })
}

export function registerHandlers(): void {
  // ── file ─────────────────────────────────────────────────────────────────

  handle('file:saveExcel', async (_evt, buffer: unknown, defaultName: unknown) => {
    const bytes = toArrayBuffer(buffer, 'buffer')
    const name = assertString(defaultName, 'defaultName')
    const result = await dialog.showSaveDialog({
      defaultPath: name,
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    })
    if (result.canceled || !result.filePath) return null
    await fs.promises.writeFile(result.filePath, Buffer.from(bytes))
    return result.filePath
  })

  // ── parser ────────────────────────────────────────────────────────────────

  handle('parser:extractRates', async (_evt, ratePDF: unknown, contractForm: unknown, options: unknown) => {
    return extractRates(
      toUint8Array(ratePDF, 'ratePDF'),
      toUint8Array(contractForm, 'contractForm'),
      assertExtractRatesOptions(options),
    )
  })

  handle(
    'parser:discoverSuppliers',
    async (_evt, ratePDF: unknown, contractForm: unknown, peCatalog: unknown, anchorTerm: unknown) => {
      return discoverSuppliers(
        toUint8Array(ratePDF, 'ratePDF'),
        toUint8Array(contractForm, 'contractForm'),
        assertSupplierArray(peCatalog, 'peCatalog'),
        assertString(anchorTerm, 'anchorTerm'),
      )
    },
  )

  handle(
    'parser:extractRatesForMappings',
    async (evt, ratePDF: unknown, contractForm: unknown, peCatalog: unknown, targets: unknown) => {
      const sendProgress = (progress: import('../services/parserService').ExtractionProgress) => {
        if (!evt.sender.isDestroyed()) {
          evt.sender.send('parser:extractionProgress', progress)
        }
      }
      const sendPropertyComplete = (
        payload: import('../services/parserService').ExtractionPropertyComplete,
      ) => {
        if (!evt.sender.isDestroyed()) {
          evt.sender.send('parser:extractionPropertyComplete', payload)
        }
      }
      return extractRatesForMappings(
        toUint8Array(ratePDF, 'ratePDF'),
        toUint8Array(contractForm, 'contractForm'),
        assertSupplierArray(peCatalog, 'peCatalog'),
        assertExtractionMappingTargets(targets, 'targets'),
        sendProgress,
        sendPropertyComplete,
      )
    },
  )

  handle('parser:confirmPolicies', async (_evt, sessionId: unknown, policies: unknown) => {
    assertString(sessionId, 'sessionId')
    assertConfirmedPolicies(policies, 'policies')
  })

  // ── warehouse ─────────────────────────────────────────────────────────────

  handle('warehouse:supplierLookup', async (_evt, name: unknown) => {
    return supplierLookup(assertString(name, 'name'))
  })

  handle(
    'warehouse:supplierLookupFromFilenames',
    async (_evt, contractFormFilename: unknown, rateSheetFilename: unknown) => {
      return supplierLookupFromFilenames(
        assertString(contractFormFilename, 'contractFormFilename'),
        assertString(rateSheetFilename, 'rateSheetFilename'),
      )
    },
  )

  handle('warehouse:accommodationSupplierCatalog', async (_evt, anchorTerm: unknown) => {
    return accommodationSupplierCatalog(assertString(anchorTerm, 'anchorTerm'))
  })

  handle('warehouse:accommodationSupplierCatalogForTerms', async (_evt, anchorTerms: unknown) => {
    return accommodationSupplierCatalogForTerms(
      assertArray(anchorTerms, 'anchorTerms', (item, index) =>
        assertString(item, `anchorTerms[${index}]`),
      ),
    )
  })

  handle('warehouse:serviceMatch', async (_evt, supplierId: unknown) => {
    return serviceMatch(assertNumber(supplierId, 'supplierId'))
  })

  handle('warehouse:extrasMatch', async (_evt, supplierId: unknown) => {
    return extrasMatch(assertNumber(supplierId, 'supplierId'))
  })

  handle('warehouse:policyServiceMatch', async (_evt, supplierId: unknown) => {
    return policyServiceMatch(assertNumber(supplierId, 'supplierId'))
  })

  handle('warehouse:priorRates', async (_evt, supplierId: unknown, servicePattern: unknown) => {
    return priorRates(
      assertNumber(supplierId, 'supplierId'),
      assertString(servicePattern ?? '', 'servicePattern', { allowEmpty: true }),
    )
  })

  // ── export ────────────────────────────────────────────────────────────────

  handle('export:generateExcel', async (_evt, session: unknown) => {
    const s = assertParseSession(session, 'session')
    const { rateRows, extrasRows, flags } = buildRows(s)
    const buffer = generateExcel({ ...s, outputRows: rateRows, extrasRows, validationFlags: flags })
    await saveSession({
      ...s,
      step: 6,
      status: 'complete',
      outputRows: rateRows,
      extrasRows,
      validationFlags: flags,
    })
    return { buffer: new Uint8Array(buffer), rateRows, extrasRows, flags }
  })

  handle('export:buildWorkbook', (_evt, rateRows: unknown, extrasRows: unknown, flags: unknown) => {
    if (!Array.isArray(rateRows)) throw new IpcValidationError('rateRows must be an array.')
    if (!Array.isArray(extrasRows)) throw new IpcValidationError('extrasRows must be an array.')
    if (!Array.isArray(flags)) throw new IpcValidationError('flags must be an array.')

    const buffer = buildWorkbookFromEditedRows(
      rateRows as ParseSession['outputRows'],
      extrasRows as ParseSession['extrasRows'],
      flags as ParseSession['validationFlags'],
    )
    return { buffer: new Uint8Array(buffer) }
  })

  handle(
    'export:generateBatchZip',
    async (_evt, context: unknown, _ratePDF: unknown, _contractForm: unknown, sessionId: unknown) => {
      const result = await generateBatchZip(
        assertBatchSessionContext(context, 'context'),
        assertOptionalString(sessionId, 'sessionId') ?? 'batch',
      )
      return { zipBuffer: result.zipBuffer, summaries: result.summaries }
    },
  )

  handle('export:saveZip', async (_evt, buffer: unknown, defaultName: unknown) => {
    const bytes = toArrayBuffer(buffer, 'buffer')
    const name = assertString(defaultName, 'defaultName')
    const result = await dialog.showSaveDialog({
      defaultPath: name,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    })
    if (result.canceled || !result.filePath) return null
    await fs.promises.writeFile(result.filePath, Buffer.from(bytes))
    return result.filePath
  })

  handle('export:zipBuffers', async (_evt, entries: unknown) => {
    return zipBufferEntries(assertZipEntries(entries, 'entries'))
  })

  // ── settings ──────────────────────────────────────────────────────────────

  handle('settings:getAwsRegion', (_evt) => {
    return getAwsRegion()
  })

  handle('settings:setAwsRegion', async (_evt, region: unknown) => {
    await saveAwsRegion(assertString(region, 'region', { allowEmpty: true }))
  })

  handle('settings:getAwsProfile', (_evt) => {
    return getAwsProfile()
  })

  handle('settings:setAwsProfile', async (_evt, profile: unknown) => {
    await saveAwsProfile(assertString(profile, 'profile', { allowEmpty: true }))
  })

  handle('settings:getMotherduckCredentials', async (_evt) => {
    return motherduckCredentialsConfigured()
  })

  handle('settings:getMotherduckTokenPreview', async (_evt) => {
    return getMotherduckTokenPreview()
  })

  handle('settings:setMotherduckToken', async (_evt, token: unknown) => {
    await storeMotherduckToken(assertString(token, 'token'))
    resetMotherduckConnection()
  })

  handle('settings:deleteMotherduckToken', async (_evt) => {
    await removeMotherduckToken()
    resetMotherduckConnection()
  })

  handle('settings:testConnection', async (_evt) => {
    return testConnection()
  })

  handle('settings:getParserProxyUrl', (_evt) => {
    return getParserProxyUrl()
  })

  handle('settings:setParserProxyUrl', async (_evt, url: unknown) => {
    await saveParserProxyUrl(assertString(url, 'url', { allowEmpty: true }))
  })

  handle('settings:getParserApiKeyPreview', async (_evt) => {
    return getParserApiKeyPreview()
  })

  handle('settings:setParserApiKey', async (_evt, apiKey: unknown) => {
    await storeParserApiKey(assertString(apiKey, 'apiKey'))
  })

  handle('settings:deleteParserApiKey', async (_evt) => {
    await removeParserApiKey()
  })

  handle('settings:testParserConnection', async (_evt) => {
    return testParserProxyConnection()
  })

  // ── dialog ────────────────────────────────────────────────────────────────

  handle('dialog:openFile', async (_evt, filters: unknown) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: assertFileFilters(filters, 'filters'),
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  handle('dialog:saveFile', async (_evt, defaultName: unknown) => {
    const result = await dialog.showSaveDialog({
      defaultPath: assertString(defaultName, 'defaultName'),
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  // ── history ───────────────────────────────────────────────────────────────

  handle('history:list', async (_evt) => {
    return listSessions()
  })

  handle('history:getSession', async (_evt, id: unknown) => {
    return getSession(assertString(id, 'id'))
  })

  handle('history:deleteSession', async (_evt, id: unknown) => {
    await deleteSession(assertString(id, 'id'))
  })

  handle('history:clearAll', async (_evt) => {
    await clearAllSessions()
  })

  handle('renderer:reportError', (_evt, detail: unknown) => {
    logger.error('renderer', typeof detail === 'string' ? detail : 'Renderer error (no detail)')
  })

  // Health-check (kept for diagnostics)
  ipcMain.handle('__health_check', () => 'ok')
}
