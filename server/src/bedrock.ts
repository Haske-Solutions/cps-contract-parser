import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { BEDROCK_MODEL_ID, DEFAULT_BEDROCK_REGION } from '../../src/shared/constants'
import {
  assertPdfPair,
  parseClaudeResponseText,
  pdfDocumentBlocks,
} from '../../src/shared/parserInvoke'

type ClaudeContentBlock = { type: string; text?: string }
type ClaudeResponse = { content: ClaudeContentBlock[]; stop_reason: string }

function getRegion(): string {
  return process.env.AWS_REGION?.trim() || DEFAULT_BEDROCK_REGION
}

async function buildClient(): Promise<BedrockRuntimeClient> {
  return new BedrockRuntimeClient({
    region: getRegion(),
    credentials: defaultProvider({}),
  })
}

export async function invokeClaude(
  system: string,
  ratePDF: Uint8Array,
  contractForm: Uint8Array,
  userText: string,
): Promise<unknown> {
  assertPdfPair(ratePDF, contractForm)

  const client = await buildClient()
  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 32768,
    system,
    messages: [
      {
        role: 'user',
        content: [...pdfDocumentBlocks(ratePDF, contractForm), { type: 'text', text: userText }],
      },
    ],
  }

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
  })

  let response
  try {
    response = await client.send(command)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/access\s*denied|accessdenied|unauthorized|credentials|expired/i.test(msg)) {
      throw new Error('Bedrock authentication failed. Check AWS credentials on the server.')
    }
    if (/throttl|rate exceeded|too many requests/i.test(msg)) {
      throw new Error('Bedrock is temporarily busy. Please retry.')
    }
    throw new Error(`Bedrock invocation failed: ${msg}`)
  }

  const responseText = new TextDecoder().decode(response.body)
  let data: ClaudeResponse
  try {
    data = JSON.parse(responseText) as ClaudeResponse
  } catch {
    throw new Error('Invalid Bedrock response payload.')
  }

  const textBlock = data.content?.find((c) => c.type === 'text')
  if (!textBlock?.text) {
    throw new Error('Bedrock returned no text content.')
  }

  return parseClaudeResponseText(textBlock.text, data.stop_reason)
}

export async function checkBedrockCredentials(): Promise<boolean> {
  const client = await buildClient()
  await client.config.credentials()
  return true
}
