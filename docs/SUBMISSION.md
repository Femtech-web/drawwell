# Submission kit

## Write-up (form)

**Drawwell: prepare a Department of Education G5 drawdown you can defend, line by line.**

Since November 1, 2026, every Department of Education grant recipient must justify each G5 payment request in 255 characters or fewer: the program name, the expense categories and amounts, and the expense dates. A flagged justification comes back by email and the payment waits. HHS has required the same since 2025, and Head Start programs reported held-up payroll and rent.

Drawwell is for the one-person finance office behind a TRIO program, a community school partnership or a charter network. You pick the expenses for a draw. Code proves what can be proven against your own records: invoices already drawn, costs outside the budget period, unpaid costs on a reimbursement award, advances drawn too early, categories over budget. One SERV Reasoning call then reads every remaining line with its receipt, the award terms and the 2 CFR 200 text, and decides the budget category, whether the cost is allowable or needs judgment, what the receipt actually totals, and which line inside a larger charge is unallowable. Drawwell keeps a SERV citation only if its quote appears word for word in the dated eCFR text, and a receipt total only if the quoted line is in the document. Costs that depend on exceptions or the award are never marked unallowable automatically; the administrator decides. SERV then drafts the 255-character justification from the final totals, code checks every required element, and an evidence report traces each dollar for ED's follow-up questions.

Receipts can be the PDFs grantees already have: Drawwell reads them as text and holds them to the same word-for-word checks. And because federal education money reaches districts through the state, states now review every district's justification first; Drawwell's reviewer view checks a whole queue against ED's required elements, in the browser.

**Proof:** on a frozen benchmark of 37 labeled expenses (one request held out from prompt development), Drawwell's answers were defensible on all 37 with no unsafe misses, and it isolated every unallowable line to the cent. One plain AI call on the same expenses proposed 12 deductions that weren't there. Every run, failures included, is published on the Evaluation page.

**How it uses SERV Reasoning:** every review is a live call to SERV with Multipath (the cost principles are a branching policy matrix), Shadow Agent (validated against a testable hint before answering), Prompt Guard (receipts are third-party text) and a strict JSON schema whose enums come from the request. Feature combinations were tested against the live API. SERV sometimes answers empty or slowly, so each review gives full features 150 seconds, then retries without Prompt Guard, then with features off, and the evidence report records which configuration answered.

**Track:** Open Track.

**Built during the hackathon:** everything (new project, Nov 15, 2026).

## X post (draft)

Since Nov 1, every @usedgov grantee has to justify each G5 drawdown in 255 characters.

Drawwell checks the draw first: invoices drawn twice, receipts that don't match the ledger, the wine on a catering bill. Then it writes the justification.

Code proves the errors. SERV Reasoning applies 2 CFR 200 line by line, and every citation is checked word for word against the eCFR. The judgment calls stay with you.

Reads PDF receipts. Checks a state's whole queue of district justifications.

Built for @openservai SERV Hackathon 02, Open Track.
Live: https://drawwell.vercel.app · Code: https://github.com/Femtech-web/drawwell

## Demo video

VIDEO_URL (about 2.5 minutes, narrated; fictional organization and synthetic records throughout)

**Links for the form:** live site https://drawwell.vercel.app · repo https://github.com/Femtech-web/drawwell · video VIDEO_URL · X post (add after posting)
