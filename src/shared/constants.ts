// Occupancy codes for extraction / token matching (not PE Appendix A rate types).
export interface OccupancyCodeDef {
  code: string
  name: string
  minPax: number
  maxPax: number
  minStay: number
  maxStay: number
}

export const OCCUPANCY_CODES: OccupancyCodeDef[] = [
  { code: 'DBL', name: 'Double', minPax: 2, maxPax: 2, minStay: 1, maxStay: 99 },
  { code: 'TWN', name: 'Twin', minPax: 2, maxPax: 2, minStay: 1, maxStay: 99 },
  { code: 'SGL', name: 'Single', minPax: 1, maxPax: 1, minStay: 1, maxStay: 99 },
  { code: 'TRP', name: 'Triple', minPax: 3, maxPax: 3, minStay: 1, maxStay: 99 },
  { code: 'QUD', name: 'Quad', minPax: 4, maxPax: 4, minStay: 1, maxStay: 99 },
  { code: 'FAM', name: 'Family', minPax: 2, maxPax: 6, minStay: 1, maxStay: 99 },
  { code: 'HON', name: 'Honeymoon', minPax: 2, maxPax: 2, minStay: 1, maxStay: 99 },
  { code: 'CIOR', name: 'Child In Own Room', minPax: 1, maxPax: 1, minStay: 1, maxStay: 99 },
  { code: 'CWA', name: 'Child With Adult', minPax: 1, maxPax: 1, minStay: 1, maxStay: 99 },
  { code: 'INF', name: 'Infant', minPax: 1, maxPax: 1, minStay: 1, maxStay: 99 },
  { code: 'CHD', name: 'Child', minPax: 1, maxPax: 1, minStay: 1, maxStay: 99 },
  { code: 'SGL1', name: 'Single Tier 1', minPax: 1, maxPax: 1, minStay: 1, maxStay: 99 },
  { code: 'SGL2', name: 'Single Tier 2', minPax: 1, maxPax: 1, minStay: 1, maxStay: 99 },
  { code: 'SGL3', name: 'Single Tier 3', minPax: 1, maxPax: 1, minStay: 1, maxStay: 99 },
]

/** @deprecated Use OCCUPANCY_CODES for room semantics; use appendixA for PE rate types. */
export const RATE_CODES = OCCUPANCY_CODES

export type RateCodeDef = OccupancyCodeDef

export const OCCUPANCY_CODE_SET = new Set(OCCUPANCY_CODES.map((r) => r.code))

/** @deprecated Use OCCUPANCY_CODE_SET */
export const RATE_CODE_SET = OCCUPANCY_CODE_SET

/** PE Rates sheet — 26 columns (v5.5). */
export const PE_RATES_COLUMNS = [
  'Supplier Name',
  'Supplier ID',
  'Supplier Code',
  'Service Name',
  'Service ID',
  'Service Code',
  'Date From',
  'Date To',
  'Agent Group ID',
  'Rate Code',
  'Rate Name',
  'Rate Plan',
  'Currency Code',
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
  'Is Exception',
  'Business_Model',
  'Supplier_Commission',
] as const

/** PE Extras sheet — 28 columns (v5.4). */
export const PE_EXTRAS_COLUMNS = [
  'Supplier Name',
  'Supplier Code',
  'Supplier Id',
  'Service Name',
  'Service Code',
  'Service ID',
  'Extra Type',
  'Extra Name',
  'Date From',
  'Date To',
  'Agent Group ID',
  'Rate Code',
  'Rate Name',
  'Currency',
  'Cost',
  'Sell',
  'Price Percent',
  'Tax Code',
  'Child Only',
  'Infant Only',
  'Markup',
  'Discount',
  'Mandatory',
  'No Report',
  'Commission',
  'Capacity Change',
  'Percent_from_child_price',
  'No_Voucher',
] as const

/** PE Validation Notes — 4 columns. */
export const PE_VALIDATION_COLUMNS = [
  'Item Type',
  'Service Name',
  'Issue',
  'Action Required',
] as const

/** @deprecated Use PE_RATES_COLUMNS */
export const RATES_COLUMNS = PE_RATES_COLUMNS

/** @deprecated Use PE_EXTRAS_COLUMNS */
export const EXTRAS_COLUMNS = PE_EXTRAS_COLUMNS

export const DEFAULT_MOTHERDUCK_DATABASE = 'PinkElephant'

export const BEDROCK_MODEL_ID = 'us.anthropic.claude-sonnet-4-6'

export const DEFAULT_BEDROCK_REGION = 'us-east-1'

export const DEFAULT_PARSER_PROXY_URL = 'https://api-cp.safarico.online'

export const PARSER_PROXY_TIMEOUT_MS = 10 * 60 * 1000

export const PARSER_RETRY_MAX_ATTEMPTS = 4
export const PARSER_RETRY_BASE_DELAY_MS = 1000
export const PARSER_RETRY_MAX_DELAY_MS = 30_000

export const MAX_PROPERTIES_PER_RUN = 5

export const MAX_CONCURRENT_EXTRACTIONS = 2
/** Serial extractions when using parser proxy to avoid rate-limit failures. */
export const MAX_CONCURRENT_PROXY_EXTRACTIONS = 1

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

export const DEFAULT_BUSINESS_MODEL = 'BM1'
export const DEFAULT_SUPPLIER_COMMISSION = 0
export const DEFAULT_TAX_CODE = 'S'

/** Default PE rate type for per-person accommodation (Appendix A). */
export const DEFAULT_ACCOMMODATION_RATE_TYPE = 'PPPN'
