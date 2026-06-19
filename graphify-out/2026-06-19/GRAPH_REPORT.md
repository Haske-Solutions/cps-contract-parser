# Graph Report - .  (2026-06-19)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 993 nodes · 1998 edges · 68 communities (57 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1c3a5233`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Parse Session UI|Parse Session UI]]
- [[_COMMUNITY_Main Process & IPC|Main Process & IPC]]
- [[_COMMUNITY_Renderer App Shell|Renderer App Shell]]
- [[_COMMUNITY_Rate Comparison & Export|Rate Comparison & Export]]
- [[_COMMUNITY_Batch Export Service|Batch Export Service]]
- [[_COMMUNITY_Mismatch Detection & Preload|Mismatch Detection & Preload]]
- [[_COMMUNITY_Package Config|Package Config]]
- [[_COMMUNITY_shadcn Component Registry|shadcn Component Registry]]
- [[_COMMUNITY_Data Grid Column Builders|Data Grid Column Builders]]
- [[_COMMUNITY_npm Dependencies|npm Dependencies]]
- [[_COMMUNITY_TypeScript Renderer Config|TypeScript Renderer Config]]
- [[_COMMUNITY_UI Migration Plan|UI Migration Plan]]
- [[_COMMUNITY_Mismatch Gate Resolution|Mismatch Gate Resolution]]
- [[_COMMUNITY_TypeScript Main Config|TypeScript Main Config]]
- [[_COMMUNITY_Supplier Picker & Service Match|Supplier Picker & Service Match]]
- [[_COMMUNITY_Policy Review UI|Policy Review UI]]
- [[_COMMUNITY_Session History|Session History]]
- [[_COMMUNITY_Session Detail & Banner|Session Detail & Banner]]
- [[_COMMUNITY_Alert Dialog UI|Alert Dialog UI]]
- [[_COMMUNITY_Session Detail Modal|Session Detail Modal]]
- [[_COMMUNITY_Build & Release Config|Build & Release Config]]
- [[_COMMUNITY_Editable Data Grid|Editable Data Grid]]
- [[_COMMUNITY_Row Value Coercion|Row Value Coercion]]
- [[_COMMUNITY_Data Grid Row Factories|Data Grid Row Factories]]
- [[_COMMUNITY_MotherDuck Token Settings|MotherDuck Token Settings]]
- [[_COMMUNITY_File Upload Component|File Upload Component]]
- [[_COMMUNITY_Progress UI|Progress UI]]
- [[_COMMUNITY_Tabs UI|Tabs UI]]
- [[_COMMUNITY_Renderer Entry Point|Renderer Entry Point]]
- [[_COMMUNITY_Renderer Button|Renderer Button]]
- [[_COMMUNITY_Shared Button|Shared Button]]
- [[_COMMUNITY_Scroll Area UI|Scroll Area UI]]
- [[_COMMUNITY_E2E Test Suite|E2E Test Suite]]
- [[_COMMUNITY_Renderer Utils (cn)|Renderer Utils (cn)]]
- [[_COMMUNITY_Shared Utils (cn)|Shared Utils (cn)]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_Playwright Config|Playwright Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Vite Config|Vite Config]]
- [[_COMMUNITY_Vitest Config|Vitest Config]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 60|Community 60]]

## God Nodes (most connected - your core abstractions)
1. `Supplier` - 26 edges
2. `scripts` - 25 edges
3. `ParseSession` - 19 edges
4. `ExtractionResult` - 18 edges
5. `compilerOptions` - 17 edges
6. `Badge()` - 16 edges
7. `compilerOptions` - 15 edges
8. `SessionActions` - 13 edges
9. `readConfig()` - 13 edges
10. `ServiceMatch` - 13 edges

## Surprising Connections (you probably didn't know these)
- `ParseSession Page` --semantically_similar_to--> `Sidebar Navigation (Parse Session / History / Settings)`  [INFERRED] [semantically similar]
  .agent_context/approach.md → playwright-report/data/1012e9b420c66df3f81d21271f20d6e5bbd3a01b.png
- `App Shell Navigation` --semantically_similar_to--> `Sidebar Navigation (Parse Session / History / Settings)`  [INFERRED] [semantically similar]
  .agent_context/approach.md → playwright-report/data/1012e9b420c66df3f81d21271f20d6e5bbd3a01b.png
- `AWS Bedrock Credentials Settings Section` --semantically_similar_to--> `Claude claude-sonnet-4-6 via Amazon Bedrock`  [INFERRED] [semantically similar]
  playwright-report/data/1012e9b420c66df3f81d21271f20d6e5bbd3a01b.png → src/main/prompts/CPS_Contract_Parser_System_Prompt_V5_6.md
- `GitHub Release Provider` --semantically_similar_to--> `Publish Release Job`  [INFERRED] [semantically similar]
  electron-builder.yml → .github/workflows/build.yml
- `Settings Page Screenshot (Playwright test)` --semantically_similar_to--> `Settings Page Screenshot (test-finished)`  [INFERRED] [semantically similar]
  playwright-report/data/1012e9b420c66df3f81d21271f20d6e5bbd3a01b.png → test-results/app-smoke-window-electronA-9d5d0-ed-with-expected-namespaces-electron/test-finished-1.png

## Import Cycles
- None detected.

## Communities (68 total, 11 thin omitted)

### Community 0 - "Parse Session UI"
Cohesion: 0.06
Nodes (65): handle(), Handler, registerHandlers(), assertArray(), assertBatchSessionContext(), assertConfirmedPolicies(), assertExtractionMappingTargets(), assertExtractRatesOptions() (+57 more)

### Community 1 - "Main Process & IPC"
Cohesion: 0.05
Nodes (47): Props, Props, detectMismatches(), api, CachedExtractionEntry, ExtractionApplyResult, isExtractionSuggestedForSupplier(), normalizeName() (+39 more)

### Community 2 - "Renderer App Shell"
Cohesion: 0.08
Nodes (45): Props, applyResolution(), buildRows(), buildWorkbookBuffer(), buildWorkbookFromEditedRows(), findServiceMatch(), generateExcel(), resolveExportRows() (+37 more)

### Community 3 - "Rate Comparison & Export"
Cohesion: 0.08
Nodes (44): applyGroupSelection(), capIncludedSelections(), countIncludedMappings(), countRemainingReviewable(), defaultCollapsedMappingGroupIds(), groupHasContractFormMatch(), isMappingReviewed(), prepareGroupsForNextBatch() (+36 more)

### Community 4 - "Batch Export Service"
Cohesion: 0.10
Nodes (36): autoConfirmedPolicies(), buildBatchSession(), createZipArchive(), generateBatchZip(), sanitizeFilename(), streamToBuffer(), zipBufferEntries(), closeMotherduck() (+28 more)

### Community 5 - "Mismatch Detection & Preload"
Cohesion: 0.08
Nodes (30): App Shell Navigation, History Page, ParseSession Page, PolicyReview Component, shadcn/ui Migration Plan (ELE-51), Settings Page Screenshot (Playwright test), Ambiguity handling, Claude claude-sonnet-4-6 via Amazon Bedrock (+22 more)

### Community 6 - "Package Config"
Cohesion: 0.10
Nodes (20): ConfirmDialog(), Props, SettingsSection(), formatSavedAt(), Props, SavedMotherduckToken(), formatSavedAt(), Props (+12 more)

### Community 7 - "shadcn Component Registry"
Cohesion: 0.08
Nodes (25): scripts, branding:generate, build, build:main, build:renderer, dev, dev:main, dev:renderer (+17 more)

### Community 8 - "Data Grid Column Builders"
Cohesion: 0.15
Nodes (14): LocalState, MismatchGate(), Props, Resolution, toArrayBuffer(), toExportSession(), Mismatch, MismatchResolution (+6 more)

### Community 9 - "npm Dependencies"
Cohesion: 0.09
Nodes (23): dependencies, archiver, @aws-sdk/client-bedrock-runtime, @aws-sdk/credential-provider-node, @base-ui/react, class-variance-authority, clsx, @duckdb/node-api (+15 more)

### Community 10 - "TypeScript Renderer Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 11 - "UI Migration Plan"
Cohesion: 0.11
Nodes (7): useIsMobile(), Input(), Separator(), SidebarContext, SidebarContextProps, SidebarProvider(), Skeleton()

### Community 12 - "Mismatch Gate Resolution"
Cohesion: 0.09
Nodes (21): dependencies, @aws-sdk/client-bedrock-runtime, @aws-sdk/credential-provider-node, express, express-rate-limit, tsx, description, devDependencies (+13 more)

### Community 13 - "TypeScript Main Config"
Cohesion: 0.19
Nodes (18): BedrockClientOptions, buildClient(), checkBedrockCredentials(), ClaudeContentBlock, ClaudeResponse, invokeClaude(), mapBedrockError(), shouldRetryBedrock() (+10 more)

### Community 14 - "Supplier Picker & Service Match"
Cohesion: 0.09
Nodes (21): compilerOptions, allowSyntheticDefaultImports, baseUrl, esModuleInterop, isolatedModules, jsx, lib, module (+13 more)

### Community 15 - "Policy Review UI"
Cohesion: 0.15
Nodes (15): buildColumnsFromFields(), buildExtractedRateColumns(), buildExtrasRowColumns(), buildPriorRateColumns(), buildRateRowColumns(), EXTRACTED_RATE_FIELDS, EXTRAS_ROW_FIELDS, FieldConfig (+7 more)

### Community 16 - "Session History"
Cohesion: 0.10
Nodes (21): devDependencies, autoprefixer, concurrently, electron, electron-builder, @electron/notarize, electron-playwright-helpers, eslint (+13 more)

### Community 17 - "Session Detail & Banner"
Cohesion: 0.20
Nodes (17): assertPdfPair(), base64ToUint8Array(), buildDiscoveryUserText(), buildPeCatalogContext(), collectJsonCandidates(), decodePdfPayload(), DiscoverProxyRequest, extractBalancedJsonObject() (+9 more)

### Community 18 - "Alert Dialog UI"
Cohesion: 0.14
Nodes (15): ExtractionProgressCallback, ExtractionPropertyCompleteCallback, extractRates(), extractRatesForMappings(), mapWithConcurrency(), slimExtractionOptions(), buildExtractionUserText(), ExtractRatesOptions (+7 more)

### Community 19 - "Session Detail Modal"
Cohesion: 0.11
Nodes (18): compilerOptions, baseUrl, esModuleInterop, lib, module, moduleResolution, noUnusedLocals, noUnusedParameters (+10 more)

### Community 20 - "Build & Release Config"
Cohesion: 0.19
Nodes (11): ExcelPreview(), ExportRowSeed, SettingsSectionProps, Card(), CardContent(), CardDescription(), CardHeader(), CardTitle() (+3 more)

### Community 21 - "Editable Data Grid"
Cohesion: 0.18
Nodes (15): COLORS, compositeIcon(), dmgBackgroundSvg(), fs, headerSvg(), ICON, { Jimp }, main() (+7 more)

### Community 22 - "Row Value Coercion"
Cohesion: 0.18
Nodes (9): History(), SessionDetailModal(), HistorySession, Table(), TableBody(), TableCell(), TableHead(), TableHeader() (+1 more)

### Community 23 - "Data Grid Row Factories"
Cohesion: 0.19
Nodes (12): Props, Props, Props, SessionBanner(), isSessionInProgress(), LOADING_MESSAGES, statusLabel(), STEP_LABELS (+4 more)

### Community 24 - "MotherDuck Token Settings"
Cohesion: 0.13
Nodes (13): ParseSession(), View, viewTitles, SidebarContent(), SidebarFooter(), SidebarGroup(), SidebarGroupContent(), SidebarHeader() (+5 more)

### Community 25 - "File Upload Component"
Cohesion: 0.28
Nodes (13): discoverViaProxy(), extractViaProxy(), mapProxyHttpError(), normalizeProxyUrl(), ParserProxyConfig, proxyFetch(), proxyFetchOnce(), proxyHeaders() (+5 more)

### Community 26 - "Progress UI"
Cohesion: 0.26
Nodes (9): buildServiceMatchColumns(), createEmptyExtractedRate(), createEmptyExtrasRow(), createEmptyPriorRate(), createEmptyRateRow(), createEmptyServiceMatch(), Props, ServiceMatchingPanel() (+1 more)

### Community 27 - "Tabs UI"
Cohesion: 0.19
Nodes (13): App ID: com.chelipeacock.contract-parser, electron-builder Configuration, DuckDB Native Module asar Unpack, GitHub Release Provider, macOS DMG Build Target (x64 + arm64), Windows NSIS Installer Target (x64), Cheli and Peacock Safaris, CPS Contract Parser End User License Agreement (+5 more)

### Community 28 - "Renderer Entry Point"
Cohesion: 0.23
Nodes (8): CardProps, ExtractedSupplierPicker(), AppErrorBoundaryProps, AppErrorBoundaryState, Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 29 - "Renderer Button"
Cohesion: 0.22
Nodes (7): displayStep(), formatDate(), SessionHeader(), SEVERITY_LABELS, statusBadgeVariant(), statusLabel(), Spinner()

### Community 30 - "Shared Button"
Cohesion: 0.21
Nodes (6): PolicyReview(), POLICY_TYPE_LABELS, Badge(), badgeVariants, Checkbox(), Textarea()

### Community 31 - "Scroll Area UI"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, lib, module, moduleResolution, noUnusedLocals, noUnusedParameters, outDir (+4 more)

### Community 32 - "E2E Test Suite"
Cohesion: 0.29
Nodes (10): coerceExtractedRate(), coerceExtrasRow(), coercePriorRate(), coerceRateRow(), EXTRACTED_NUMERIC_KEYS, PRIOR_RATE_NUMERIC_KEYS, RATE_NUMERIC_KEYS, formatCellValue() (+2 more)

### Community 33 - "Renderer Utils (cn)"
Cohesion: 0.18
Nodes (5): Sheet(), SheetContent(), SheetDescription(), SheetHeader(), SheetTitle()

### Community 34 - "Shared Utils (cn)"
Cohesion: 0.22
Nodes (5): requireApiKey(), parserRouter, app, limiter, PORT

### Community 35 - "Tailwind Config"
Cohesion: 0.44
Nodes (8): anchorTermFromFilenames(), catalogAnchorTermsFromFilenames(), commonWordPrefix(), deriveSupplierSearchTerm(), groupBrandFromTerm(), leadingBrandToken(), propertyBrandFromTerm(), supplierSearchTermsFromFilenames()

### Community 36 - "Playwright Config"
Cohesion: 0.22
Nodes (8): author, description, main, name, repository, type, url, version

### Community 37 - "PostCSS Config"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 38 - "Vite Config"
Cohesion: 0.32
Nodes (5): EditableDataGrid(), Props, PriorRatePanel(), Props, PriorRate

### Community 39 - "Vitest Config"
Cohesion: 0.25
Nodes (5): extractedRateGridId(), priorRateGridId(), rateRowGridId(), serviceMatchGridId(), WithGridId

### Community 41 - "Community 41"
Cohesion: 0.25
Nodes (7): CPS Parser API (Backend Proxy), Desktop app configuration, Docker deploy (VPS), Endpoints, Environment variables, Local development, Security notes

### Community 42 - "Community 42"
Cohesion: 0.39
Nodes (6): asString(), CONFIDENCE_LEVELS, normalizeDate(), normalizeDetected(), normalizeDiscoveryResult(), SupplierDiscoveryResult

### Community 43 - "Community 43"
Cohesion: 0.50
Nodes (6): cacheDir(), cacheFilePath(), getCachedExtraction(), hashPdfPair(), setCachedExtraction(), setExtractionCacheRootForTests()

### Community 44 - "Community 44"
Cohesion: 0.33
Nodes (3): FileUpload(), Props, Label()

### Community 46 - "Community 46"
Cohesion: 0.33
Nodes (6): Sidebar(), SidebarMenuButton(), sidebarMenuButtonVariants, SidebarRail(), SidebarTrigger(), useSidebar()

### Community 50 - "Community 50"
Cohesion: 0.67
Nodes (3): Content Security Policy (renderer), Renderer Entry Point (index.html), React Root Mount Point (#root)

## Knowledge Gaps
- **275 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+270 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Supplier` connect `Main Process & IPC` to `Renderer App Shell`, `Rate Comparison & Export`, `Batch Export Service`, `Data Grid Column Builders`, `Session Detail & Banner`, `Alert Dialog UI`, `Data Grid Row Factories`, `File Upload Component`, `Renderer Entry Point`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `ParseSession` connect `Data Grid Row Factories` to `Parse Session UI`, `Main Process & IPC`, `Renderer App Shell`, `Batch Export Service`, `Data Grid Column Builders`, `Row Value Coercion`, `MotherDuck Token Settings`, `Renderer Button`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `Badge()` connect `Shared Button` to `Main Process & IPC`, `Rate Comparison & Export`, `Package Config`, `Data Grid Column Builders`, `Policy Review UI`, `Build & Release Config`, `Row Value Coercion`, `Data Grid Row Factories`, `MotherDuck Token Settings`, `Progress UI`, `Renderer Entry Point`, `Renderer Button`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _278 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Parse Session UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05909351692484223 - nodes in this community are weakly interconnected._
- **Should `Main Process & IPC` be split into smaller, more focused modules?**
  _Cohesion score 0.053075396825396824 - nodes in this community are weakly interconnected._
- **Should `Renderer App Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.08395989974937343 - nodes in this community are weakly interconnected._