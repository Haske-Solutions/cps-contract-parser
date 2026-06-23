# CPS Contract Parser — Product Specification (v5.8)

**Status:** Active — aligned with the Electron desktop app (March 2026)  
**Supersedes:** Aspirational chat-agent sections in `CPS_Contract_Parser.md` (v5.6 knowledge base)

This document describes what the **desktop application actually does**. For the LLM extraction contract, see `src/main/prompts/systemPrompt.ts`. For PE column rules, see `src/shared/appendixA.ts` and `src/shared/constants.ts`.

---

## What the app does

1. **Upload** a supplier rate sheet PDF and CPS contract form PDF.
2. **Discover** accommodation suppliers/properties and map them to Pink Elephant catalog rows.
3. **Extract** rates and policies per property (Bedrock or parser proxy).
4. **Review** via human-in-the-loop gates (policies, service matching, prior rates, form/PDF mismatches).
5. **Export** a PE-import-ready Excel workbook (Rates, Extras, Validation Notes).

Warehouse lookups (supplier services, prior rates) run in **TypeScript after extraction** — not inside the LLM prompt.

---

## Workflow steps (`ParseSession`)

| Step | Label | What happens |
|------|-------|----------------|
| 1 | Upload & Identify | PDF upload, supplier discovery, PE mapping gate |
| 2 | Rate Extraction & Policy Review | Bedrock/proxy extract; policy confirmation gates |
| 3 | PE Service Matching | Token match accommodation/extras/policy services |
| 4 | Prior Rate Comparison | Warehouse prior-year rates |
| 5 | Generate Workbook | `exportService.buildRows` → Excel |
| 6 | Validation Report | Grid preview, download, batch walkthrough advance |

**Batch walkthrough:** Up to `MAX_PROPERTIES_PER_RUN` (5) properties per extraction batch. Each property runs steps 2–6 before advancing. State: `batchSessionStore.walkthrough`.

**Headless batch ZIP:** `generateBatchZip` builds workbooks without interactive gates. Policies are auto-confirmed; mismatches are **not** resolved — a `BATCH_UNREVIEWED_MISMATCHES` validation flag is emitted instead. Optional `reviewedPeIds` on `BatchSessionContext` limits ZIP to interactively reviewed suppliers.

---

## Spec ↔ code map

| Concern | Source of truth |
|---------|-----------------|
| LLM extraction schema | `src/main/prompts/systemPrompt.ts` |
| Extraction normalization | `src/main/services/extractionValidation.ts` |
| Mismatch detection | `src/shared/mismatchCollector.ts` |
| Service token matching | `src/shared/serviceTokenMatcher.ts`, `src/shared/serviceMatcher.ts` |
| Export session shape | `src/shared/sessionBuilder.ts` |
| Rate/extras row build | `src/main/services/exportService.ts`, `extrasEngine.ts`, `nonAccommodationBuilder.ts` |
| Excel output | `src/main/services/peWorkbookWriter.ts` |
| Appendix A rate types | `src/shared/appendixA.ts` |

---

## Human-in-the-loop gates

| Gate | When | Skipped in batch ZIP? |
|------|------|------------------------|
| Supplier mapping | Step 1 | N/A |
| Policy confirmation (CIOR, child sharing, etc.) | Step 2 | Yes — auto-confirmed |
| Service matching overrides | Step 3 | No automatic overrides |
| Prior rate review | Step 4 | No |
| Mismatch gate (form vs PDF) | Before step 5 | Yes — flagged in Validation Notes |
| Currency / no-accom / festive clarify | Step 2→4 | Context-dependent |

**Mismatch undo:** From step 6, users can reopen the mismatch gate and regenerate the workbook without re-extraction.

---

## Parser invocation

| Mode | When | Notes |
|------|------|-------|
| Direct Bedrock | No Parser API URL in Settings | AWS SSO profile from Settings |
| Parser proxy | Parser API URL configured | All discover/extract via HTTPS; multi-property runs serially |

See `server/README.md` for proxy endpoints and ops guidance.

---

## Regression testing

- **Unit:** `src/__tests__/` — module and parity tests
- **Golden export:** `goldenExport.test.ts` snapshots minimal row output
- **Parity:** `exportParity.test.ts` — interactive vs batch session on same fixture

Frozen extraction JSON fixtures should be added under `src/__tests__/fixtures/golden/` as real contracts are validated.
