// Rate codes and names from Appendix A of the behavioral contract.
// ONLY codes from this list are valid — any unknown code triggers a STOP (Invariant I1).

export interface RateCodeDef {
  code: string
  name: string
  minPax: number
  maxPax: number
  minStay: number
  maxStay: number
}

export const RATE_CODES: RateCodeDef[] = [
  { code: 'DBL', name: 'Double',            minPax: 2, maxPax: 2,  minStay: 1, maxStay: 99 },
  { code: 'TWN', name: 'Twin',              minPax: 2, maxPax: 2,  minStay: 1, maxStay: 99 },
  { code: 'SGL', name: 'Single',            minPax: 1, maxPax: 1,  minStay: 1, maxStay: 99 },
  { code: 'TRP', name: 'Triple',            minPax: 3, maxPax: 3,  minStay: 1, maxStay: 99 },
  { code: 'QUD', name: 'Quad',              minPax: 4, maxPax: 4,  minStay: 1, maxStay: 99 },
  { code: 'FAM', name: 'Family',            minPax: 2, maxPax: 6,  minStay: 1, maxStay: 99 },
  { code: 'HON', name: 'Honeymoon',         minPax: 2, maxPax: 2,  minStay: 1, maxStay: 99 },
  { code: 'CIOR', name: 'Child In Own Room',minPax: 1, maxPax: 1,  minStay: 1, maxStay: 99 },
  { code: 'CWA', name: 'Child With Adult',  minPax: 1, maxPax: 1,  minStay: 1, maxStay: 99 },
  { code: 'INF', name: 'Infant',            minPax: 1, maxPax: 1,  minStay: 1, maxStay: 99 },
  { code: 'CHD', name: 'Child',             minPax: 1, maxPax: 1,  minStay: 1, maxStay: 99 },
  { code: 'SGL1', name: 'Single Tier 1',    minPax: 1, maxPax: 1,  minStay: 1, maxStay: 99 },
  { code: 'SGL2', name: 'Single Tier 2',    minPax: 1, maxPax: 1,  minStay: 1, maxStay: 99 },
  { code: 'SGL3', name: 'Single Tier 3',    minPax: 1, maxPax: 1,  minStay: 1, maxStay: 99 },
]

export const RATE_CODE_SET = new Set(RATE_CODES.map((r) => r.code))

export const RATES_COLUMNS = [
  'Supplier Name',
  'Supplier ID',
  'Supplier Code',
  'Service',
  'Service ID',
  'Service Code',
  'Valid From',
  'Valid To',
  'Agent Group ID',
  'Rate Code',
  'Rate Name',
  'Rate Plan',
  'Currency Buy',
  'Currency Sell',
  'Adult Buy',
  'Adult Sell',
  'Child Cost',
  'Child Sell',
  'Markup',
  'Min Pax',
  'Max Pax',
  'Min Stay',
  'Max Stay',
  'API',
  'Is Active',
  'Is Exception',
] as const

export const EXTRAS_COLUMNS = [
  'Supplier Name',
  'Supplier ID',
  'Supplier Code',
  'Service',
  'Service ID',
  'Service Code',
  'Valid From',
  'Valid To',
  'Agent Group ID',
  'Rate Code',
  'Rate Name',
  'Currency Buy',
  'Currency Sell',
  'Adult Buy',
  'Adult Sell',
  'Child Cost',
  'Child Sell',
  'Markup',
  'Min Pax',
  'Max Pax',
  'Min Stay',
  'Max Stay',
  'API',
  'Is Active',
  'Is Exception',
  'Extra Category',
  'Price Type',
  'Business Model',
] as const

export const DEFAULT_MOTHERDUCK_DATABASE = 'PinkElephant'

// Amazon Bedrock inference profile for Claude Sonnet 4.6 (US cross-region).
// Sonnet 4.6 must be invoked via inference profile ID, not a foundation-model ARN.
export const BEDROCK_MODEL_ID = 'us.anthropic.claude-sonnet-4-6'

export const DEFAULT_BEDROCK_REGION = 'us-east-1'

/** Default parser proxy URL for packaged app builds (override in Settings). */
export const DEFAULT_PARSER_PROXY_URL = ''

/** Parser proxy HTTP timeout (client-side). */
export const PARSER_PROXY_TIMEOUT_MS = 10 * 60 * 1000

/** Maximum properties that can be selected and reviewed per mapping batch. */
export const MAX_PROPERTIES_PER_RUN = 5

export const POLICY_TYPE_LABELS: Record<string, string> = {
  CIOR: 'Child In Own Room (CIOR)',
  children_sharing: 'Children Sharing',
  single_room: 'Single Room Tiering',
  free_child: 'Free Child Policy',
  age_brackets: 'Child Age Brackets',
  triple_quad: 'Triple / Quad Occupancy',
}

export const STEP_LABELS: Record<number, string> = {
  1: 'Upload & Identify',
  2: 'Rate Extraction & Policy Review',
  3: 'PE Service Matching',
  4: 'Prior Year Comparison',
  5: 'Excel Generation',
  6: 'Validation Report',
}

export const MIN_PAX_FALLBACK = 1
export const MAX_PAX_FALLBACK = 99
export const MIN_STAY_FALLBACK = 1
export const MAX_STAY_FALLBACK = 99
export const RATE_CHANGE_THRESHOLD_PCT = 15
