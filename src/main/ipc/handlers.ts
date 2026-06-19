import { ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import type { IpcMainInvokeEvent } from 'electron'
import type { FileFilter, ParseSession } from '../../shared/types'
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
import type { BatchSessionContext } from '../../shared/types'
import {
  listSessions,
  getSession,
  deleteSession,
  clearAllSessions,
  saveSession,
} from '../services/historyService'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

function handle(channel: string, fn: Handler): void {
  ipcMain.handle(channel, fn)
}

export function registerHandlers(): void {
  // ── file ─────────────────────────────────────────────────────────────────

  handle('file:saveExcel', async (_evt, buffer: unknown, defaultName: unknown) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName as string,
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    })
    if (result.canceled || !result.filePath) return null
    await fs.promises.writeFile(result.filePath, Buffer.from(buffer as ArrayBuffer))
    return result.filePath
  })

  // ── parser ────────────────────────────────────────────────────────────────

  handle('parser:extractRates', async (_evt, ratePDF: unknown, contractForm: unknown, options: unknown) => {
    return extractRates(
      ratePDF as Uint8Array,
      contractForm as Uint8Array,
      options as { peCatalog?: import('../../shared/types').Supplier[]; targetPeSupplierId?: number } | undefined,
    )
  })

  handle(
    'parser:discoverSuppliers',
    async (_evt, ratePDF: unknown, contractForm: unknown, peCatalog: unknown, anchorTerm: unknown) => {
      return discoverSuppliers(
        ratePDF as Uint8Array,
        contractForm as Uint8Array,
        peCatalog as import('../../shared/types').Supplier[],
        anchorTerm as string,
      )
    },
  )

  handle(
    'parser:extractRatesForMappings',
    async (_evt, ratePDF: unknown, contractForm: unknown, peCatalog: unknown, targets: unknown) => {
      return extractRatesForMappings(
        ratePDF as Uint8Array,
        contractForm as Uint8Array,
        peCatalog as import('../../shared/types').Supplier[],
        targets as import('../../shared/types').ExtractionMappingTarget[],
      )
    },
  )

  handle(
    'parser:confirmPolicies',
    async (_evt, _sessionId: unknown, _policies: unknown) => {
      // Policies confirmed in the renderer; no main-process validation required.
    },
  )

  // ── warehouse ─────────────────────────────────────────────────────────────

  handle('warehouse:supplierLookup', async (_evt, name: unknown) => {
    return supplierLookup(name as string)
  })

  handle(
    'warehouse:supplierLookupFromFilenames',
    async (_evt, contractFormFilename: unknown, rateSheetFilename: unknown) => {
      return supplierLookupFromFilenames(
        contractFormFilename as string,
        rateSheetFilename as string,
      )
    },
  )

  handle('warehouse:accommodationSupplierCatalog', async (_evt, anchorTerm: unknown) => {
    return accommodationSupplierCatalog(anchorTerm as string)
  })

  handle('warehouse:accommodationSupplierCatalogForTerms', async (_evt, anchorTerms: unknown) => {
    return accommodationSupplierCatalogForTerms(anchorTerms as string[])
  })

  handle('warehouse:serviceMatch', async (_evt, supplierId: unknown) => {
    return serviceMatch(supplierId as number)
  })

  handle('warehouse:extrasMatch', async (_evt, supplierId: unknown) => {
    return extrasMatch(supplierId as number)
  })

  handle('warehouse:policyServiceMatch', async (_evt, supplierId: unknown) => {
    return policyServiceMatch(supplierId as number)
  })

  handle('warehouse:priorRates', async (_evt, supplierId: unknown, servicePattern: unknown) => {
    return priorRates(supplierId as number, servicePattern as string)
  })

  // ── export ────────────────────────────────────────────────────────────────

  handle('export:generateExcel', (_evt, session: unknown) => {
    const s = session as ParseSession
    const { rateRows, extrasRows, flags } = buildRows(s)
    const buffer = generateExcel({ ...s, outputRows: rateRows, extrasRows, validationFlags: flags })
    saveSession({
      ...s,
      step: 6,
      status: 'complete',
      outputRows: rateRows,
      extrasRows,
      validationFlags: flags,
    })
    return { buffer: new Uint8Array(buffer), rateRows, extrasRows, flags }
  })

  handle(
    'export:buildWorkbook',
    (_evt, rateRows: unknown, extrasRows: unknown, flags: unknown) => {
      const buffer = buildWorkbookFromEditedRows(
        rateRows as ParseSession['outputRows'],
        extrasRows as ParseSession['extrasRows'],
        flags as ParseSession['validationFlags'],
      )
      return { buffer: new Uint8Array(buffer) }
    },
  )

  handle(
    'export:generateBatchZip',
    async (_evt, context: unknown, _ratePDF: unknown, _contractForm: unknown, sessionId: unknown) => {
      const result = await generateBatchZip(context as BatchSessionContext, (sessionId as string) ?? 'batch')
      return { zipBuffer: result.zipBuffer, summaries: result.summaries }
    },
  )

  handle('export:saveZip', async (_evt, buffer: unknown, defaultName: unknown) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName as string,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    })
    if (result.canceled || !result.filePath) return null
    await fs.promises.writeFile(result.filePath, Buffer.from(buffer as ArrayBuffer))
    return result.filePath
  })

  handle('export:zipBuffers', async (_evt, entries: unknown) => {
    const zipBuffer = await zipBufferEntries(
      entries as Array<{ filename: string; buffer: Uint8Array }>,
    )
    return zipBuffer
  })

  // ── settings ──────────────────────────────────────────────────────────────

  handle('settings:getAwsRegion', (_evt) => {
    return getAwsRegion()
  })

  handle('settings:setAwsRegion', (_evt, region: unknown) => {
    saveAwsRegion(region as string)
  })

  handle('settings:getAwsProfile', (_evt) => {
    return getAwsProfile()
  })

  handle('settings:setAwsProfile', (_evt, profile: unknown) => {
    saveAwsProfile(profile as string)
  })

  handle('settings:getMotherduckCredentials', async (_evt) => {
    return motherduckCredentialsConfigured()
  })

  handle('settings:getMotherduckTokenPreview', async (_evt) => {
    return getMotherduckTokenPreview()
  })

  handle('settings:setMotherduckToken', async (_evt, token: unknown) => {
    await storeMotherduckToken(token as string)
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

  handle('settings:setParserProxyUrl', (_evt, url: unknown) => {
    saveParserProxyUrl(url as string)
  })

  handle('settings:getParserApiKeyPreview', async (_evt) => {
    return getParserApiKeyPreview()
  })

  handle('settings:setParserApiKey', async (_evt, apiKey: unknown) => {
    await storeParserApiKey(apiKey as string)
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
      filters: filters as FileFilter[],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  handle('dialog:saveFile', async (_evt, defaultName: unknown) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName as string,
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  // ── history ───────────────────────────────────────────────────────────────

  handle('history:list', (_evt) => {
    return listSessions()
  })

  handle('history:getSession', (_evt, id: unknown) => {
    return getSession(id as string)
  })

  handle('history:deleteSession', (_evt, id: unknown) => {
    deleteSession(id as string)
  })

  handle('history:clearAll', (_evt) => {
    clearAllSessions()
  })

  // Health-check (kept for diagnostics)
  ipcMain.handle('__health_check', () => 'ok')
}

