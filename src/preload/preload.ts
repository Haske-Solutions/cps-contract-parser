import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '../shared/types'

/**
 * Exposes the typed ElectronAPI surface to the renderer via contextBridge.
 * All IPC goes through this file — no direct Node.js/Electron access in renderer.
 *
 * Each method maps 1:1 to an IPC channel in src/main/ipc/handlers.ts.
 */
const api: ElectronAPI = {
  file: {
    saveExcel: (buffer, defaultName) => ipcRenderer.invoke('file:saveExcel', buffer, defaultName),
  },
  parser: {
    extractRates: (ratePDF, contractForm, options) =>
      ipcRenderer.invoke('parser:extractRates', ratePDF, contractForm, options),
    discoverSuppliers: (ratePDF, contractForm, peCatalog, anchorTerm) =>
      ipcRenderer.invoke('parser:discoverSuppliers', ratePDF, contractForm, peCatalog, anchorTerm),
    extractRatesForMappings: (ratePDF, contractForm, peCatalog, targets) =>
      ipcRenderer.invoke(
        'parser:extractRatesForMappings',
        ratePDF,
        contractForm,
        peCatalog,
        targets,
      ),
    onExtractionProgress: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: import('../shared/types').ExtractionProgress) => {
        callback(progress)
      }
      ipcRenderer.on('parser:extractionProgress', listener)
      return () => {
        ipcRenderer.removeListener('parser:extractionProgress', listener)
      }
    },
    onExtractionPropertyComplete: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: import('../shared/types').ExtractionPropertyComplete,
      ) => {
        callback(payload)
      }
      ipcRenderer.on('parser:extractionPropertyComplete', listener)
      return () => {
        ipcRenderer.removeListener('parser:extractionPropertyComplete', listener)
      }
    },
    confirmPolicies: (sessionId, policies) =>
      ipcRenderer.invoke('parser:confirmPolicies', sessionId, policies),
  },
  warehouse: {
    supplierLookup: (name) => ipcRenderer.invoke('warehouse:supplierLookup', name),
    supplierLookupFromFilenames: (contractFormFilename, rateSheetFilename) =>
      ipcRenderer.invoke(
        'warehouse:supplierLookupFromFilenames',
        contractFormFilename,
        rateSheetFilename,
      ),
    accommodationSupplierCatalog: (anchorTerm) =>
      ipcRenderer.invoke('warehouse:accommodationSupplierCatalog', anchorTerm),
    accommodationSupplierCatalogForTerms: (anchorTerms) =>
      ipcRenderer.invoke('warehouse:accommodationSupplierCatalogForTerms', anchorTerms),
    serviceMatch: (supplierId) => ipcRenderer.invoke('warehouse:serviceMatch', supplierId),
    extrasMatch: (supplierId) => ipcRenderer.invoke('warehouse:extrasMatch', supplierId),
    policyServiceMatch: (supplierId) =>
      ipcRenderer.invoke('warehouse:policyServiceMatch', supplierId),
    priorRates: (supplierId, servicePattern) =>
      ipcRenderer.invoke('warehouse:priorRates', supplierId, servicePattern),
  },
  export: {
    generateExcel: (session) => ipcRenderer.invoke('export:generateExcel', session),
    buildWorkbook: (rateRows, extrasRows, flags) =>
      ipcRenderer.invoke('export:buildWorkbook', rateRows, extrasRows, flags),
    generateBatchZip: (context, ratePDF, contractForm, sessionId) =>
      ipcRenderer.invoke('export:generateBatchZip', context, ratePDF, contractForm, sessionId),
    saveZip: (buffer, defaultName) => ipcRenderer.invoke('export:saveZip', buffer, defaultName),
    zipBuffers: (entries) => ipcRenderer.invoke('export:zipBuffers', entries),
  },
  settings: {
    getAwsRegion: () => ipcRenderer.invoke('settings:getAwsRegion'),
    setAwsRegion: (region) => ipcRenderer.invoke('settings:setAwsRegion', region),
    getAwsProfile: () => ipcRenderer.invoke('settings:getAwsProfile'),
    setAwsProfile: (profile) => ipcRenderer.invoke('settings:setAwsProfile', profile),
    getMotherduckCredentials: () => ipcRenderer.invoke('settings:getMotherduckCredentials'),
    getMotherduckTokenPreview: () => ipcRenderer.invoke('settings:getMotherduckTokenPreview'),
    setMotherduckToken: (token) => ipcRenderer.invoke('settings:setMotherduckToken', token),
    deleteMotherduckToken: () => ipcRenderer.invoke('settings:deleteMotherduckToken'),
    testConnection: () => ipcRenderer.invoke('settings:testConnection'),
    getParserProxyUrl: () => ipcRenderer.invoke('settings:getParserProxyUrl'),
    setParserProxyUrl: (url) => ipcRenderer.invoke('settings:setParserProxyUrl', url),
    getParserApiKeyPreview: () => ipcRenderer.invoke('settings:getParserApiKeyPreview'),
    setParserApiKey: (apiKey) => ipcRenderer.invoke('settings:setParserApiKey', apiKey),
    deleteParserApiKey: () => ipcRenderer.invoke('settings:deleteParserApiKey'),
    testParserConnection: () => ipcRenderer.invoke('settings:testParserConnection'),
  },
  dialog: {
    openFile: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
    saveFile: (defaultName) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  },
  history: {
    list: () => ipcRenderer.invoke('history:list'),
    getSession: (id) => ipcRenderer.invoke('history:getSession', id),
    deleteSession: (id) => ipcRenderer.invoke('history:deleteSession', id),
    clearAll: () => ipcRenderer.invoke('history:clearAll'),
  },
  renderer: {
    reportError: (detail) => ipcRenderer.invoke('renderer:reportError', detail),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    quitAndInstall: () => ipcRenderer.invoke('app:quitAndInstall'),
    onUpdateStatus: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        status: import('../shared/types').UpdateStatus,
      ) => {
        callback(status)
      }
      ipcRenderer.on('app:updateStatus', listener)
      return () => {
        ipcRenderer.removeListener('app:updateStatus', listener)
      }
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
