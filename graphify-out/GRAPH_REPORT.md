# Graph Report - .  (2026-06-19)

## Corpus Check
- 124 files · ~63,240 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 742 nodes · 1614 edges · 40 communities (35 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.88)
- Token cost: 3,200 input · 2,100 output

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
- [[_COMMUNITY_Tabs UI|Tabs UI]]
- [[_COMMUNITY_Renderer Entry Point|Renderer Entry Point]]
- [[_COMMUNITY_Renderer Button|Renderer Button]]
- [[_COMMUNITY_Shared Button|Shared Button]]
- [[_COMMUNITY_E2E Test Suite|E2E Test Suite]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]

## God Nodes (most connected - your core abstractions)
1. `Supplier` - 22 edges
2. `scripts` - 19 edges
3. `ParseSession` - 19 edges
4. `compilerOptions` - 17 edges
5. `Badge()` - 16 edges
6. `ExtractionResult` - 15 edges
7. `compilerOptions` - 15 edges
8. `SessionActions` - 13 edges
9. `ServiceMatch` - 13 edges
10. `ExtractedRate` - 12 edges

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
- 1-file cycle: `src/renderer/components/Settings/Settings.tsx -> src/renderer/components/Settings/Settings.tsx`

## Hyperedges (group relationships)
- **End-to-End Release Pipeline (Test -> Build -> Release)** — workflows_build_unit_test_job, workflows_build_build_job, workflows_build_release_job, workflows_build_electron_builder, electron_builder_yml_github_publish [EXTRACTED 1.00]
- **Contract Parsing Invariants (I1-I3) Governing Output Integrity** — prompts_cps_contract_parser_system_prompt_v5_6_invariant_i1, prompts_cps_contract_parser_system_prompt_v5_6_invariant_i2, prompts_cps_contract_parser_system_prompt_v5_6_invariant_i3, prompts_cps_contract_parser_system_prompt_v5_6_suppliers_schema [EXTRACTED 1.00]
- **Settings Page UI Sections (AWS Bedrock + PE MCP + Session History)** — settings_ui_aws_bedrock_credentials, settings_ui_pink_elephant_mcp_endpoint, settings_ui_session_history_management, data_1012e9b420c66df3f81d21271f20d6e5bbd3a01b_settings_screenshot [EXTRACTED 1.00]

## Communities (40 total, 5 thin omitted)

### Community 0 - "Parse Session UI"
Cohesion: 0.05
Nodes (62): ExcelPreview(), ExtractedSupplierPicker(), Props, ParseSession(), PolicyReview(), PriorRatePanel(), ServiceMatchingPanel(), ExtractRatesOptions (+54 more)

### Community 1 - "Main Process & IPC"
Cohesion: 0.06
Nodes (55): handle(), Handler, registerHandlers(), asString(), CONFIDENCE_LEVELS, normalizeDate(), normalizeDetected(), normalizeDiscoveryResult() (+47 more)

### Community 2 - "Renderer App Shell"
Cohesion: 0.06
Nodes (34): useIsMobile(), App(), View, viewTitles, Settings(), Separator(), Sheet(), SheetContent() (+26 more)

### Community 3 - "Rate Comparison & Export"
Cohesion: 0.08
Nodes (45): Props, applyResolution(), buildRows(), buildWorkbookBuffer(), buildWorkbookFromEditedRows(), findServiceMatch(), resolveExportRows(), asNumber() (+37 more)

### Community 4 - "Batch Export Service"
Cohesion: 0.10
Nodes (39): autoConfirmedPolicies(), buildBatchSession(), createZipArchive(), generateBatchZip(), sanitizeFilename(), streamToBuffer(), zipBufferEntries(), generateExcel() (+31 more)

### Community 5 - "Mismatch Detection & Preload"
Cohesion: 0.08
Nodes (34): Props, detectMismatches(), Props, api, Props, BatchZipResult, ChildRate, ConfirmedPolicy (+26 more)

### Community 6 - "Package Config"
Cohesion: 0.05
Nodes (42): author, description, devDependencies, autoprefixer, concurrently, electron, electron-builder, electron-playwright-helpers (+34 more)

### Community 7 - "shadcn Component Registry"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 8 - "Data Grid Column Builders"
Cohesion: 0.15
Nodes (16): buildColumnsFromFields(), buildExtractedRateColumns(), buildExtrasRowColumns(), buildPriorRateColumns(), buildRateRowColumns(), EXTRACTED_RATE_FIELDS, EXTRAS_ROW_FIELDS, FieldConfig (+8 more)

### Community 9 - "npm Dependencies"
Cohesion: 0.09
Nodes (22): dependencies, archiver, @aws-sdk/client-bedrock-runtime, @aws-sdk/credential-provider-node, @base-ui/react, class-variance-authority, clsx, @duckdb/node-api (+14 more)

### Community 10 - "TypeScript Renderer Config"
Cohesion: 0.09
Nodes (21): compilerOptions, allowSyntheticDefaultImports, baseUrl, esModuleInterop, isolatedModules, jsx, lib, module (+13 more)

### Community 11 - "UI Migration Plan"
Cohesion: 0.12
Nodes (21): App Shell Navigation, History Page, ParseSession Page, PolicyReview Component, shadcn/ui Migration Plan (ELE-51), Settings Page Screenshot (Playwright test), Claude claude-sonnet-4-6 via Amazon Bedrock, CPS Contract Form PDF Input (+13 more)

### Community 12 - "Mismatch Gate Resolution"
Cohesion: 0.15
Nodes (12): LocalState, MismatchGate(), Props, Resolution, MismatchResolution, Dialog(), DialogContent(), DialogDescription() (+4 more)

### Community 13 - "TypeScript Main Config"
Cohesion: 0.11
Nodes (18): compilerOptions, baseUrl, esModuleInterop, lib, module, moduleResolution, noUnusedLocals, noUnusedParameters (+10 more)

### Community 14 - "Supplier Picker & Service Match"
Cohesion: 0.21
Nodes (9): buildServiceMatchColumns(), serviceMatchGridId(), CardProps, SettingsSectionProps, Card(), CardContent(), CardDescription(), CardHeader() (+1 more)

### Community 15 - "Policy Review UI"
Cohesion: 0.18
Nodes (8): ConfirmDialog(), SettingsSection(), Alert(), AlertDescription(), AlertTitle(), alertVariants, Checkbox(), Textarea()

### Community 16 - "Session History"
Cohesion: 0.18
Nodes (9): History(), toArrayBuffer(), toExportSession(), Table(), TableBody(), TableCell(), TableHead(), TableHeader() (+1 more)

### Community 17 - "Session Detail & Banner"
Cohesion: 0.19
Nodes (12): Props, Props, Props, SessionBanner(), isSessionInProgress(), LOADING_MESSAGES, statusLabel(), STEP_LABELS (+4 more)

### Community 18 - "Alert Dialog UI"
Cohesion: 0.21
Nodes (9): Props, AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader() (+1 more)

### Community 19 - "Session Detail Modal"
Cohesion: 0.20
Nodes (8): displayStep(), formatDate(), SessionDetailModal(), SessionHeader(), SEVERITY_LABELS, statusBadgeVariant(), statusLabel(), Spinner()

### Community 20 - "Build & Release Config"
Cohesion: 0.19
Nodes (13): App ID: com.chelipeacock.contract-parser, electron-builder Configuration, DuckDB Native Module asar Unpack, GitHub Release Provider, macOS DMG Build Target (x64 + arm64), Windows NSIS Installer Target (x64), Cheli and Peacock Safaris, CPS Contract Parser End User License Agreement (+5 more)

### Community 21 - "Editable Data Grid"
Cohesion: 0.24
Nodes (6): EditableDataGrid(), Props, extractedRateGridId(), priorRateGridId(), rateRowGridId(), WithGridId

### Community 22 - "Row Value Coercion"
Cohesion: 0.33
Nodes (9): coerceExtractedRate(), coerceExtrasRow(), coercePriorRate(), coerceRateRow(), EXTRACTED_NUMERIC_KEYS, PRIOR_RATE_NUMERIC_KEYS, RATE_NUMERIC_KEYS, parseBooleanInput() (+1 more)

### Community 23 - "Data Grid Row Factories"
Cohesion: 0.36
Nodes (6): createEmptyExtractedRate(), createEmptyExtrasRow(), createEmptyPriorRate(), createEmptyRateRow(), createEmptyServiceMatch(), ExportRowSeed

### Community 24 - "MotherDuck Token Settings"
Cohesion: 0.39
Nodes (6): formatSavedAt(), Props, SavedMotherduckToken(), MotherduckTokenPreview, Badge(), badgeVariants

### Community 25 - "File Upload Component"
Cohesion: 0.40
Nodes (3): FileUpload(), Props, Label()

### Community 28 - "Renderer Entry Point"
Cohesion: 0.67
Nodes (3): Content Security Policy (renderer), Renderer Entry Point (index.html), React Root Mount Point (#root)

## Knowledge Gaps
- **183 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+178 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ParseSession` connect `Session Detail & Banner` to `Main Process & IPC`, `Renderer App Shell`, `Rate Comparison & Export`, `Batch Export Service`, `Mismatch Detection & Preload`, `Session History`, `Session Detail Modal`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `Supplier` connect `Parse Session UI` to `Main Process & IPC`, `Rate Comparison & Export`, `Batch Export Service`, `Mismatch Detection & Preload`, `Supplier Picker & Service Match`, `Session Detail & Banner`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `Badge()` connect `MotherDuck Token Settings` to `Parse Session UI`, `Renderer App Shell`, `Mismatch Detection & Preload`, `Data Grid Column Builders`, `Supplier Picker & Service Match`, `Policy Review UI`, `Session History`, `Session Detail & Banner`, `Session Detail Modal`, `Editable Data Grid`, `Data Grid Row Factories`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _186 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Parse Session UI` be split into smaller, more focused modules?**
  _Cohesion score 0.0531883632089333 - nodes in this community are weakly interconnected._
- **Should `Main Process & IPC` be split into smaller, more focused modules?**
  _Cohesion score 0.05765765765765766 - nodes in this community are weakly interconnected._
- **Should `Renderer App Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.055523085914669784 - nodes in this community are weakly interconnected._