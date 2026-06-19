import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import {
  BEDROCK_MODEL_ID,
  PARSER_RETRY_BASE_DELAY_MS,
  PARSER_RETRY_MAX_ATTEMPTS,
  PARSER_RETRY_MAX_DELAY_MS,
} from '../../shared/constants'
import {
  assertPdfPair,
  parseClaudeResponseText,
  pdfDocumentBlocks,
} from '../../shared/parserInvoke'
import { isBedrockThrottleError, isTransientNetworkError, withRetry } from '../../shared/retry'
import { getAwsRegion, getAwsProfile } from './keystoreService'
import { logger } from './logger'

type ClaudeContentBlock = { type: string; text?: string }
type ClaudeResponse = { content: ClaudeContentBlock[]; stop_reason: string }

export interface BedrockClientOptions {
  region?: string
  profile?: string
}

async function buildClient(options?: BedrockClientOptions): Promise<BedrockRuntimeClient> {
  const region = options?.region ?? getAwsRegion()
  const profile = options?.profile ?? getAwsProfile()

  return new BedrockRuntimeClient({
    region,
    credentials: defaultProvider(profile ? { profile } : {}),
  })
}

function mapBedrockError(err: unknown, region: string): Error {
  const msg = err instanceof Error ? err.message : String(err)
  if (/access\s*denied|accessdenied|unauthorized|credentials|expired|sso/i.test(msg)) {
    return new Error(
      'Could not authenticate with Amazon Bedrock. For local SSO, run `aws sso login` and set your AWS profile in Settings. In production, ensure the IAM role has Bedrock access.',
    )
  }
  if (/invalid.*model|model identifier/i.test(msg)) {
    return new Error(
      `Bedrock model "${BEDROCK_MODEL_ID}" is not available in region ${region}. Enable Claude Sonnet 4.6 in the Bedrock console (Model access) and confirm your IAM role can invoke inference profile us.anthropic.claude-sonnet-4-6.`,
    )
  }
  if (isBedrockThrottleError(err)) {
    return new Error('Bedrock is temporarily busy. Please wait a moment and retry extraction.')
  }
  if (isTransientNetworkError(err)) {
    return new Error('Network error while contacting Bedrock. Please retry extraction.')
  }
  return new Error(`Extraction failed: ${msg}`)
}

function shouldRetryBedrock(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (/authenticate|access\s*denied|unauthorized|invalid.*model/i.test(error.message)) {
    return false
  }
  return isBedrockThrottleError(error) || isTransientNetworkError(error)
}

async function sendInvoke(
  client: BedrockRuntimeClient,
  command: InvokeModelCommand,
): Promise<{ body: Uint8Array }> {
  return client.send(command)
}

export async function invokeClaude(
  system: string,
  ratePDF: Uint8Array,
  contractForm: Uint8Array,
  userText: string,
  options?: BedrockClientOptions,
): Promise<unknown> {
  assertPdfPair(ratePDF, contractForm)

  const client = await buildClient(options)
  const region = options?.region ?? getAwsRegion()

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

  let response: { body: Uint8Array }
  try {
    response = await withRetry(
      async () => sendInvoke(client, command),
      {
        maxAttempts: PARSER_RETRY_MAX_ATTEMPTS,
        baseDelayMs: PARSER_RETRY_BASE_DELAY_MS,
        maxDelayMs: PARSER_RETRY_MAX_DELAY_MS,
        shouldRetry: shouldRetryBedrock,
        onRetry: (error, attempt, delayMs) => {
          logger.warn(
            'bedrock',
            `InvokeModel retry ${attempt}/${PARSER_RETRY_MAX_ATTEMPTS} in ${delayMs}ms`,
            error,
          )
        },
      },
    )
  } catch (err: unknown) {
    throw mapBedrockError(err, region)
  }

  const responseText = new TextDecoder().decode(response.body)
  let data: ClaudeResponse
  try {
    data = JSON.parse(responseText) as ClaudeResponse
  } catch {
    throw new Error('Received an invalid response from Bedrock. Please try extraction again.')
  }

  const textBlock = data.content?.find((c) => c.type === 'text')
  if (!textBlock?.text) {
    throw new Error(
      'The AI did not return any extraction content. Please verify both PDFs and try again.',
    )
  }

  return parseClaudeResponseText(textBlock.text, data.stop_reason)
}

/** Lightweight credential check — does not invoke the model. */
export async function checkBedrockCredentials(
  options?: BedrockClientOptions,
): Promise<boolean> {
  const client = await buildClient(options)
  await client.config.credentials()
  return true
}
