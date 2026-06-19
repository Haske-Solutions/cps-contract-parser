import * as keytar from 'keytar'
import { createHash } from 'crypto'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { DEFAULT_BEDROCK_REGION, DEFAULT_MOTHERDUCK_DATABASE, DEFAULT_PARSER_PROXY_URL } from '../../shared/constants'
import { maskSecret } from '../../shared/tokenDisplay'
import type { MotherduckTokenPreview, ParserApiKeyPreview } from '../../shared/types'

const KEYTAR_SERVICE = 'cps-contract-parser'
const KEYTAR_ACCOUNT_MOTHERDUCK = 'motherduck-token'
const KEYTAR_ACCOUNT_PARSER_API = 'parser-api-key'

interface AppConfig {
  awsRegion: string
  awsProfile: string
  parserProxyUrl: string
  motherduckTokenSavedAt?: string
  parserApiKeySavedAt?: string
}

function configFilePath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

function readConfig(): AppConfig {
  try {
    const raw = fs.readFileSync(configFilePath(), 'utf-8')
    return {
      awsRegion: DEFAULT_BEDROCK_REGION,
      awsProfile: '',
      parserProxyUrl: DEFAULT_PARSER_PROXY_URL,
      ...JSON.parse(raw),
    } as AppConfig
  } catch {
    return {
      awsRegion: DEFAULT_BEDROCK_REGION,
      awsProfile: '',
      parserProxyUrl: DEFAULT_PARSER_PROXY_URL,
    }
  }
}

function writeConfig(config: AppConfig): void {
  fs.writeFileSync(configFilePath(), JSON.stringify(config, null, 2), 'utf-8')
}

// ── AWS Bedrock (SSO / IAM role via default credential chain) ────────────────

export function getAwsRegion(): string {
  return readConfig().awsRegion || DEFAULT_BEDROCK_REGION
}

export function saveAwsRegion(region: string): void {
  const config = readConfig()
  config.awsRegion = region
  writeConfig(config)
}

export function getAwsProfile(): string {
  const saved = readConfig().awsProfile.trim()
  if (saved) return saved
  return process.env.AWS_PROFILE?.trim() || ''
}

export function saveAwsProfile(profile: string): void {
  const config = readConfig()
  config.awsProfile = profile
  writeConfig(config)
}

// ── Parser proxy (VPS backend) ───────────────────────────────────────────────

export function getParserProxyUrl(): string {
  const saved = readConfig().parserProxyUrl?.trim()
  if (saved) return saved
  return process.env.PARSER_PROXY_URL?.trim() || DEFAULT_PARSER_PROXY_URL
}

export function saveParserProxyUrl(url: string): void {
  const config = readConfig()
  config.parserProxyUrl = url.trim()
  writeConfig(config)
}

export async function storeParserApiKey(apiKey: string): Promise<void> {
  await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_PARSER_API, apiKey)
  const config = readConfig()
  config.parserApiKeySavedAt = new Date().toISOString()
  writeConfig(config)
}

export async function removeParserApiKey(): Promise<void> {
  await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_PARSER_API)
  const config = readConfig()
  delete config.parserApiKeySavedAt
  writeConfig(config)
}

export async function resolveParserApiKey(): Promise<string | null> {
  const keychainKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_PARSER_API)
  if (keychainKey) return keychainKey

  const envKey = process.env.PARSER_API_KEY?.trim()
  return envKey || null
}

export async function parserProxyConfigured(): Promise<boolean> {
  const url = getParserProxyUrl()
  if (!url) return false
  return (await resolveParserApiKey()) !== null
}

export async function getParserApiKeyPreview(): Promise<ParserApiKeyPreview | null> {
  const keychainKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_PARSER_API)
  const envKey = process.env.PARSER_API_KEY?.trim() || null
  const apiKey = keychainKey || envKey
  if (!apiKey) return null

  const source = keychainKey ? 'keychain' : 'env'
  const config = readConfig()

  return {
    masked: maskSecret(apiKey),
    fingerprint: tokenFingerprint(apiKey),
    source,
    savedAt: source === 'keychain' ? config.parserApiKeySavedAt ?? null : null,
    canRemove: source === 'keychain',
    proxyUrl: getParserProxyUrl() || null,
  }
}

// ── MotherDuck token ─────────────────────────────────────────────────────────

export async function motherduckTokenExists(): Promise<boolean> {
  const token = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_MOTHERDUCK)
  return token !== null
}

export async function motherduckCredentialsConfigured(): Promise<boolean> {
  return (await resolveMotherduckToken()) !== null
}

export async function getMotherduckToken(): Promise<string | null> {
  return keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_MOTHERDUCK)
}

export async function storeMotherduckToken(token: string): Promise<void> {
  await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_MOTHERDUCK, token)
  const config = readConfig()
  config.motherduckTokenSavedAt = new Date().toISOString()
  writeConfig(config)
}

export async function removeMotherduckToken(): Promise<void> {
  await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_MOTHERDUCK)
  const config = readConfig()
  delete config.motherduckTokenSavedAt
  writeConfig(config)
}

export async function resolveMotherduckToken(): Promise<string | null> {
  const keychainToken = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_MOTHERDUCK)
  if (keychainToken) return keychainToken

  const envToken = process.env.MOTHERDUCK_TOKEN ?? process.env.motherduck_token
  return envToken?.trim() || null
}

function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16)
}

export async function getMotherduckTokenPreview(): Promise<MotherduckTokenPreview | null> {
  const keychainToken = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_MOTHERDUCK)
  const envToken = (process.env.MOTHERDUCK_TOKEN ?? process.env.motherduck_token)?.trim() || null
  const token = keychainToken || envToken
  if (!token) return null

  const source = keychainToken ? 'keychain' : 'env'
  const config = readConfig()

  return {
    masked: maskSecret(token),
    fingerprint: tokenFingerprint(token),
    source,
    savedAt: source === 'keychain' ? config.motherduckTokenSavedAt ?? null : null,
    canRemove: source === 'keychain',
    database: `md:${DEFAULT_MOTHERDUCK_DATABASE}`,
  }
}
