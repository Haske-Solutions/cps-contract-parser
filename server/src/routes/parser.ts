import { Router } from 'express'
import { DISCOVERY_PROMPT } from '../../../src/main/prompts/discoveryPrompt'
import { SYSTEM_PROMPT } from '../../../src/main/prompts/systemPrompt'
import {
  buildDiscoveryUserText,
  buildExtractionUserText,
  decodePdfPayload,
  type DiscoverProxyRequest,
  type ExtractProxyRequest,
} from '../../../src/shared/parserInvoke'
import { normalizeDiscoveryResult } from '../../../src/main/services/discoveryValidation'
import { normalizeExtractionBatch } from '../../../src/main/services/extractionValidation'
import { checkBedrockCredentials, invokeClaude } from '../bedrock'

export const parserRouter = Router()

parserRouter.get('/health', async (_req, res) => {
  try {
    const bedrock = await checkBedrockCredentials()
    res.json({ ok: true, bedrock })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bedrock credentials unavailable'
    res.status(503).json({ ok: false, bedrock: false, error: message })
  }
})

parserRouter.post('/discover', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string | undefined
  console.log(`[discover] requestId=${requestId ?? 'none'}`)
  try {
    const body = req.body as DiscoverProxyRequest
    const ratePDF = decodePdfPayload(body.ratePDF, 'Rate sheet PDF')
    const contractForm = decodePdfPayload(body.contractForm, 'Contract form PDF')

    if (!body.anchorTerm?.trim()) {
      res.status(400).json({ error: 'anchorTerm is required.' })
      return
    }
    if (!Array.isArray(body.peCatalog)) {
      res.status(400).json({ error: 'peCatalog must be an array.' })
      return
    }

    const userText = buildDiscoveryUserText(body.peCatalog, body.anchorTerm)
    const raw = await invokeClaude(DISCOVERY_PROMPT, ratePDF, contractForm, userText)
    const result = normalizeDiscoveryResult(raw, body.anchorTerm)
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Discovery failed.'
    res.status(500).json({ error: message })
  }
})

parserRouter.post('/extract', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string | undefined
  console.log(`[extract] requestId=${requestId ?? 'none'}`)
  try {
    const body = req.body as ExtractProxyRequest
    const ratePDF = decodePdfPayload(body.ratePDF, 'Rate sheet PDF')
    const contractForm = decodePdfPayload(body.contractForm, 'Contract form PDF')

    const userText = buildExtractionUserText(body.options)
    const raw = await invokeClaude(SYSTEM_PROMPT, ratePDF, contractForm, userText)
    const result = normalizeExtractionBatch(raw)
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed.'
    res.status(500).json({ error: message })
  }
})
