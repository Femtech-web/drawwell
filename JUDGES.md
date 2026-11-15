# For judges

Drawwell checks a Department of Education G5 drawdown before the grantee writes the 255-character justification ED has required since November 1, 2026. Code proves the errors, SERV Reasoning applies 2 CFR 200 to each line, and the grantee decides the judgment calls.

Everything below can be checked on the live site (no account) or from a clone with `pnpm install` (most checks need no SERV key).

## Three minutes

1. **Live site → Review a drawdown → Upward Bound · November advance → Run the review.** One live SERV call, about a minute. The sidebar shows the model ID (with `-serv-multipath`), the time, and how many citations were verified word for word.
2. **Read "Fix before submitting".** A tutoring invoice drawn twice and a rental paid too late (code), and a $27 receipt mismatch SERV found and code confirmed.
3. **Read "Needs your judgment".** $38 of wine isolated from a catering bill, a display panel that is really equipment, business-class airfare. None are rejected for you. Decide them.
4. **Step 4 → Draft with SERV.** Watch the checks: length, program, every category with its exact amount, dates, no personal data. Change an amount in the box and watch a check fail.
5. **Open evidence report.** Every dollar traced to its row, document, rule and decision, with each SERV call's model, features and request ID.
6. **Evaluation page.** Four configurations on 37 labeled rows, including a held-out request, with every miss listed.

## Claims

| # | Claim | How to check | Expected | Evidence |
|---|---|---|---|---|
| 1 | Every review is a live SERV Reasoning call | Run a review; read the sidebar and the report's Method section | Model `gpt-5.4-mini-serv-multipath`, a SERV request ID, latency and token counts | [`src/serv/client.ts`](src/serv/client.ts); recorded calls in [`docs/results/runs/`](docs/results/runs/) |
| 2 | The SERV feature combinations Drawwell uses were tested on the live API | `pnpm smoke` (needs a key) | Seven combinations, from plain to Multipath + Shadow Agent + Prompt Guard + strict schema, each with valid JSON and the right answer | [`docs/results/serv-smoke-gpt-5.4-mini.json`](docs/results/serv-smoke-gpt-5.4-mini.json) |
| 3 | Only code can block a request; the model cannot create an error by itself | `pnpm test` | `verify.test.ts`: "never produces a model-only blocking error" passes | [`src/engine/verify.ts`](src/engine/verify.ts) |
| 4 | A citation is shown only if its quote is in the dated eCFR text word for word | `pnpm test`; in a review, compare any quote with the linked eCFR section | Invented quotes are dropped and the conclusion falls back to review | [`src/rules/cfr.ts`](src/rules/cfr.ts), [`src/rules/2cfr200/`](src/rules/2cfr200/) (refresh: `pnpm rules`) |
| 5 | The code checks catch duplicates, out-of-period costs, unpaid reimbursements, early advances, budget overruns and the equipment threshold | `pnpm test` | `checks.test.ts` lists the exact findings for each sample | [`src/engine/checks.ts`](src/engine/checks.ts) |
| 6 | SERV reconciles receipts with the ledger, and code confirms it | Upward Bound review, row L-1104 | "Document total doesn't match the ledger": $1,263.00 vs $1,236.00, with the receipt line quoted | [`fixtures/awards/upward-bound/docs/RCPT-BN-2291.txt`](fixtures/awards/upward-bound/docs/RCPT-BN-2291.txt) |
| 7 | SERV isolates an unallowable line inside a larger charge | Upward Bound review, row L-1105 | "Remove $38.00 from this charge?" with the wine line quoted and 2 CFR 200.423 | [`RCPT-MESA-1106.txt`](fixtures/awards/upward-bound/docs/RCPT-MESA-1106.txt) |
| 8 | Costs that depend on exceptions or the award are not rejected automatically | Upward Bound L-1108 (business class); benchmark rows H-03 and H-06 | Judgment items; zero over-calls in Drawwell runs | [Evaluation page](README.md#proven-on-a-frozen-benchmark) |
| 9 | Instructions hidden in a receipt don't steer the review | Talent Search sample, row N-1105 | "Instructions hidden in the record" for a person to check; the beer line still isolated | [`RCPT-NSM-1110.txt`](fixtures/awards/talent-search/docs/RCPT-NSM-1110.txt) |
| 10 | The justification check matches ED's required elements | `pnpm test`; type in the comment box | HHS's documented "payroll" example fails four checks; a complete one passes | [`src/engine/justification.ts`](src/engine/justification.ts) |
| 11 | Drawwell beats a plain AI call on what matters in money | Evaluation page | The plain call proposes false partial removals and false receipt mismatches; Drawwell's verification blocks them | [`docs/results/benchmark/`](docs/results/benchmark/) |
| 12 | An empty SERV response doesn't break a review | `pnpm test` | `review.test.ts`: retried without Prompt Guard, both attempts recorded | [`src/engine/review.ts`](src/engine/review.ts) |
| 13 | No key or records leak | Read the API routes; CI | Key server-only; request bodies never logged; gitleaks on every push; no `.env` tracked | [`.github/workflows/ci.yml`](.github/workflows/ci.yml), [`src/app/api/review/route.ts`](src/app/api/review/route.ts) |
| 14 | State agencies can check a whole queue of district justifications | Live site → For state reviewers | Sample queue: 3 ready, 5 need follow-up ("payroll", amounts that don't add up, "Fringe" instead of "Fringe Benefits", an email address, 300+ characters) | [`src/engine/reviewer.ts`](src/engine/reviewer.ts), `tests/reviewer.test.ts` |

## What this does not show

- **Real grantees.** All records are synthetic and the organizations fictional; no grantee has submitted a request prepared with Drawwell.
- **ED's acceptance.** Passing the checks means the required elements are present and the numbers match the records, not that ED will approve the payment.
- **Breadth.** 37 labeled rows written by the builder; G5 only; 25 sections of 2 CFR 200.
- **Speed at scale.** A review takes about a minute with all SERV features on; the public demo is rate-limited to protect the credit balance.

More: [threat model and what you still trust](docs/threat-model.md).
