# Submission kit

## Write-up (form)

**Drawwell: prepare a Department of Education G5 drawdown you can defend, line by line.**

Since November 1, 2026, every Department of Education grant recipient must justify each G5 payment request in 255 characters or fewer: the program name, the expense categories and amounts, and the expense dates. A flagged justification comes back by email and the payment waits. HHS has required the same since 2025, and Head Start programs reported held-up payroll and rent.

Drawwell is for the one-person finance office behind a TRIO program, a community school partnership or a charter network. You pick the expenses for a draw. Code proves what can be proven against your own records: invoices already drawn, costs outside the budget period, unpaid costs on a reimbursement award, advances drawn too early, categories over budget. One SERV Reasoning call then reads every remaining line with its receipt, the award terms and the 2 CFR 200 text, and decides the budget category, whether the cost is allowable or needs judgment, what the receipt actually totals, and which line inside a larger charge is unallowable. Drawwell keeps a SERV citation only if its quote appears word for word in the dated eCFR text, and a receipt total only if the quoted line is in the document. Costs that depend on exceptions or the award are never marked unallowable automatically; the administrator decides. SERV then drafts the 255-character justification from the final totals, code checks every required element, and an evidence report traces each dollar for ED's follow-up questions.

**How it uses SERV Reasoning:** every review is a live call to SERV with Multipath (the cost principles are a branching policy matrix), Shadow Agent (validated against a testable hint before answering), Prompt Guard (receipts are third-party text) and a strict JSON schema whose enums come from the request. Feature combinations were tested against the live API; an empty SERV response is retried and then served without Multipath, and the evidence report records which features answered.

**Track:** Open Track.

**Built during the hackathon:** everything (new project, Nov 15, 2026).

## X post (draft)

Since Nov 1, every @usedgov grantee has to justify each G5 drawdown in 255 characters.

Drawwell checks the draw first: invoices drawn twice, receipts that don't match the ledger, the wine on a catering bill. Then it writes the justification.

Code proves the errors. SERV Reasoning applies 2 CFR 200 line by line, and every citation is checked word for word against the eCFR. The judgment calls stay with you.

Built for @openservai SERV Hackathon 02, Open Track.
Live: https://drawwell.vercel.app · Code: https://github.com/Femtech-web/drawwell

## Demo video (about 2.5 minutes)

1. **The rule (15s).** Landing page. "Since November 1, every Department of Education grantee has to justify each drawdown in 255 characters: program, categories and amounts, dates. If ED flags it, the payment waits."
2. **The award (15s).** Review → Upward Bound · November advance. Point at the award summary: advance payment, 3-business-day window, $5,000 equipment threshold. "Fictional organization, synthetic records."
3. **The expenses (15s).** Scroll the ledger, open L-1105 to show the catering receipt with the wine line. Run the review; say it is one live SERV call with Multipath, Shadow Agent and Prompt Guard.
4. **Fix before submitting (30s).** September tutoring invoice drawn again (code). Room rental 10 business days out (code). Receipt $1,263 vs ledger $1,236 (SERV found it, code verified the quote).
5. **Judgment (40s).** Remove $38 of wine (show the receipt quote and 200.423). Display panel: coded Supplies, looks like Equipment, no equipment in the award. Business-class airfare: exceptions exist, so it is a judgment call, not a rejection. Make the decisions.
6. **Justification (25s).** Budget position table shows Supplies over budget. Draft with SERV; show the checks turning green and 2xx/255. Edit a number to show a check fail, undo.
7. **Evidence report (15s).** Line-by-line trace, decisions, SERV calls with model and features.
8. **Proof (15s).** Evaluation page: four configurations on 37 labeled rows; point at unsafe misses, false partial removals, citations kept. "Every run is listed, failures included."
