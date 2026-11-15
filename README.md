# Drawwell

**Prepare a Department of Education G5 drawdown you can defend, line by line.**

Since **November 1, 2026**, every Department of Education grant recipient must justify each G5 payment request: the program name, the expense categories and amounts, and the start and end dates of the expenses, in **255 characters or fewer** ([K-12 Dive on ED's Sept. 28 memo](https://www.k12dive.com/news/education-department-wants-grantees-to-defend-the-spend-DOGE/831743/), [ED G5 walkthrough](https://www.ed.gov/media/document/g5-grantee-dashboard-submitting-payments-requests-and-payment-justifications-september-28-2026-114638.pdf)). A flagged justification comes back by email and the payment waits. HHS has required the same since March 2025, and Head Start programs reported held-up payroll and rent ([American Prospect](https://prospect.org/2025/05/07/2025-05-07-congress-funded-head-start-trump-administration-holding-up-money/)).

Drawwell is for the one-person finance office behind a TRIO program, a community school partnership or a charter network. Pick the expenses for a draw, and Drawwell:

1. **Proves what code can prove** against your own records: invoices already drawn, the same invoice twice, costs outside the budget period, unpaid costs on a reimbursement award, advances drawn before the cash is needed, categories over the approved budget, items above the equipment threshold.
2. **Applies the rules to each line with SERV Reasoning:** budget category, allowability under 2 CFR 200 and your award terms, what the receipt actually totals, and the unallowable line hidden inside a larger charge.
3. **Verifies SERV's evidence in code:** a citation is kept only if its quote appears word for word in the dated eCFR text or the award term; a receipt total counts only if the quoted line is in the document.
4. **Leaves judgment to you:** costs that depend on exceptions, prior approval or your award are never marked unallowable automatically.
5. **Writes the 255-character justification** from the final totals, checked in code, and produces an **evidence report** for ED's follow-up questions.

Drawwell prepares a request. It does not submit to G5, approve payments or give legal advice.

**Live:** _deploy URL_ · **Demo video:** _link_ · **Track:** Open Track (SERV Hackathon Edition 02)

## How SERV Reasoning is used

Every review makes one live call to SERV (`inference-api.openserv.ai`, OpenAI-compatible chat completions) and every justification at least one more. The review call carries:

| SERV feature | Why |
|---|---|
| `-serv-multipath` | The cost principles are a policy matrix (unallowable unless an exception applies, the award includes it, or prior approval exists). Multipath is built for branching rules. |
| `serv_shadow_agent` | Validate-and-revise against a testable hint: every row answered once, quotes word for word, no "likely unallowable" when the cited rule has an exception that could apply. |
| `serv_prompt_guard` | Receipts and ledger descriptions are third-party text. |
| strict `json_schema` | Row IDs, ED 524 categories and CFR sections are enums built from the request. |

Rule text goes in the user message as data, not the system prompt, so Multipath's rewrite of the instructions cannot paraphrase the regulation SERV must quote. Feature combinations were tested against the live API before use (`scripts/smoke/serv.ts`, results in `docs/results/`).

## Status

| | Implemented | Tested | Demonstrated live |
|---|---|---|---|
| CSV parsing with line-numbered errors | yes | unit tests | upload panel |
| Code checks (duplicates, period, payment method, budget, equipment, instructions in data) | yes | unit tests on all samples | yes |
| SERV review (category, allowability, receipts, partial lines) | yes | benchmark | yes |
| Citation and document-quote verification | yes | unit tests + benchmark | yes |
| Justification drafting with code checks and retries | yes | unit tests (checks) | yes |
| Evidence report (print/PDF, JSON) | yes | manual | yes |
| USAspending lookup | **no** | | |
| Agencies other than ED / G5 | **no** | | |
| Reppo evaluation loop | **no** (Open Track) | | |

## Evaluation

Frozen benchmark: four synthetic drawdown requests, 37 labeled expense rows (`fixtures/benchmark/labels.json`), graded in code. One request (Charter Schools Program) was held out of prompt development. Four configurations, same labels:

<!-- results-table -->
| | Code rules only | One plain SERV call (gpt-5.4-mini) | Drawwell, SERV features off (gpt-5.4-mini) | Drawwell (gpt-5.4-mini) |
|---|---|---|---|---|
| Defensible allowability | 30/37 | 31/37 | 36/37 | 27/37 |
| Unanswered rows | 0 | 0 | 0 | 10 |
| Unsafe misses (lower is better) | 4 | 0 | 0 | 0 |
| Over-calls (lower is better) | 3 | 3 | 0 | 0 |
| Held-out request | 10/12 | 11/12 | 12/12 | 12/12 |
| Budget category | 34/36 | 32/36 | 35/36 | 35/36 |
| Receipt mismatches found | 2/2 | 2/2 | 2/2 | 1/2 |
| False receipt mismatches | 5 | 4 | 4 | 4 |
| Unallowable lines isolated (exact cents) | 0/3 | 0/3 | 2/3 | 2/3 |
| False partial removals | 0 | 12 | 2 | 0 |
| Planted instructions flagged | 2/2 | 2/2 | 2/2 | 2/2 |
| Citations kept word for word | n/a | 82 unchecked | 69/70 | 39/39 |
| Time for 4 requests | 0s | 51s | 34s | 161s |
| Estimated cost | $0.000 | $0.053 | $0.090 | $0.065 |

Runs: `2026-11-15T06-20-48-564Z-code-only-gpt-5.4-mini.json`, `2026-11-15T20-00-57-588Z-single-call-gpt-5.4-mini.json`, `2026-11-15T20-11-53-325Z-drawwell-plain-gpt-5.4-mini.json`, `2026-11-15T20-11-18-198Z-drawwell-gpt-5.4-mini.json`
<!-- /results-table -->

What the columns mean: **Code rules only** is Drawwell's code checks plus a generic red-flag keyword list. **One plain SERV call** is a minimal prompt with the documents, no rule text, no award terms, and no verification, which is how a typical app adds AI. **Drawwell, SERV features off** is the full Drawwell prompt and verification on the base model. **Drawwell** is what ships. Every run, including errored ones, is in `docs/results/`.

Read with care: 37 rows is small; the builder wrote the labels; three of four requests were seen while writing prompts; the keyword baseline was written after the demo rows existed.

**SERV behavior we hit:** all feature combinations work (`docs/results/serv-smoke-gpt-5.4-mini.json`), but SERV sometimes answered HTTP 200 with empty content and zero tokens (with Prompt Guard on, and right after a system-prompt change), and returned HTTP 400 when two benchmarks ran in parallel. Drawwell retries without Prompt Guard, then without Multipath, and records every attempt with the features it used; its own instruction scan runs regardless.

## Run it

```bash
pnpm install
cp .env.example .env   # add SERV_API_KEY
pnpm test              # engine unit tests, no key needed
pnpm smoke             # live SERV feature checks
pnpm bench drawwell gpt-5.4-mini
pnpm dev
```

## Layout

```
src/engine/      code checks, CSV, money, justification checks, SERV-output verification, orchestration
src/serv/        SERV client, prompts, schemas
src/rules/       2 CFR 200 snapshot (eCFR API) and ED guidance with provenance
src/app/         Next.js pages and API routes
fixtures/awards/ sample awards (fictional organizations, synthetic records)
fixtures/benchmark/ held-out request and frozen labels
scripts/         rules fetch, sample bundling, smoke tests, benchmark
docs/results/    every smoke, review and benchmark run
```

## Privacy

No database. Records go to the server only for the review call, are sent to SERV, and are discarded; logs hold timings and counts only. The SERV key stays server-side. Reviews are rate-limited per address with a daily cap. Sample awards use fictional organizations and synthetic records; use synthetic or de-identified data in the public demo.
