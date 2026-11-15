# Results

Every run is kept, including failures.

- `serv-smoke-<model>.json`: live SERV feature combinations (`pnpm smoke`). Each case records whether the call worked, latency, tokens, whether the JSON parsed and whether the answer was right.
- `runs/`: single full reviews of a sample (`scripts/smoke/review.ts`), the complete `ReviewResult` with every SERV call.
- `benchmark/`: frozen-benchmark runs (`pnpm bench <config> <model>`), one file per run, graded in code against `fixtures/benchmark/labels.json`. The Evaluation page shows the latest run per configuration.
- `benchmark/errored/`: runs where SERV returned errors or empty bodies for whole requests, kept for the record and excluded from the Evaluation table. The first two came from running two benchmarks in parallel (HTTP 400) and from empty 200 responses; see the README's note on SERV behavior.
- `benchmark/errored/2026-11-15T20-14-50…` and `…20-15-05…`: SERV answered HTTP 402 (account out of credits) partway through. Before that, the full pipeline scored 10/10, 9/9 and 6/6 on the three demo requests; the features-off run scored 10/10 on Upward Bound and then received a truncated body.
