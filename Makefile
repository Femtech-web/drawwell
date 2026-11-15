# Drawwell. Needs Node 22 and pnpm; SERV targets need SERV_API_KEY in .env.
.PHONY: install test dev build rules smoke bench

install:
	pnpm install

test:
	pnpm test

dev:
	pnpm dev

build:
	pnpm build

# Refresh the 2 CFR 200 snapshot from the eCFR API.
rules:
	pnpm rules

# Live SERV feature combinations, then the full benchmark (sequential; parallel runs hit SERV errors).
smoke:
	pnpm smoke

bench:
	pnpm bench code-only
	pnpm bench single-call gpt-5.4-mini
	pnpm bench drawwell-plain gpt-5.4-mini
	pnpm bench drawwell gpt-5.4-mini
