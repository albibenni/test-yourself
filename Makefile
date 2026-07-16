.PHONY: install dev build test test-ui test-rust coverage coverage-rust coverage-ui lint format clean

# Install dependencies
install:
	pnpm install

# Run the Tauri Desktop App in development mode
dev:
	pnpm tauri dev

# Build the Tauri Desktop App for production (creates the .app)
build:
	pnpm tauri build

# Run all tests (Frontend and Backend)
test: test-ui test-rust

# Run the Vitest testing suite (Frontend)
test-ui:
	pnpm test

# Run the Cargo testing suite (Backend)
test-rust:
	cd src-tauri && cargo test

# Run ESLint to check for code issues
lint:
	pnpm lint

# Run Prettier and rustfmt to format all files
format:
	pnpm indent:write
	cd src-tauri && cargo fmt

# Clean all generated files, caches, and node_modules
clean:
	rm -rf node_modules dist dist-ssr src-tauri/target

# Run code coverage for Rust backend
coverage-rust:
	@command -v cargo-llvm-cov >/dev/null 2>&1 || (echo "cargo-llvm-cov is required. Install with: cargo install cargo-llvm-cov"; exit 1)
	@command -v jq >/dev/null 2>&1 || (echo "jq is required. Install it with your package manager (e.g. sudo apt install jq)."; exit 1)
	@command -v column >/dev/null 2>&1 || (echo "column is required (usually provided by util-linux/bsdextrautils)."; exit 1)
	@tmp_file="$$(mktemp)"; \
	cd src-tauri && cargo llvm-cov --workspace --all-features --json --summary-only --output-path "$$tmp_file" -- --test-threads=1; \
	jq -r '"File\tLines %\tRegions %\tFunctions %", (.data[0].files[] | "\(.filename)\t\(.summary.lines.percent // 0)\t\(.summary.regions.percent // 0)\t\(.summary.functions.percent // 0)"), "TOTAL\t\(.data[0].totals.lines.percent // 0)\t\(.data[0].totals.regions.percent // 0)\t\(.data[0].totals.functions.percent // 0)"' "$$tmp_file" | column -t -s "$$(printf '\t')"; \
	rm -f "$$tmp_file"

# Run code coverage for Frontend
coverage-ui:
	@command -v jq >/dev/null 2>&1 || (echo "jq is required. Install it with your package manager."; exit 1)
	@command -v column >/dev/null 2>&1 || (echo "column is required."; exit 1)
	@pnpm vitest run --coverage.enabled --coverage.reporter=json-summary >/dev/null 2>&1; \
	jq -r '"File\tLines %\tBranches %\tFunctions %", (to_entries | .[] | select(.key != "total") | "\(.key | sub("^.*/src/"; "src/"))\t\(.value.lines.pct // 0)\t\(.value.branches.pct // 0)\t\(.value.functions.pct // 0)"), "TOTAL\t\(.total.lines.pct // 0)\t\(.total.branches.pct // 0)\t\(.total.functions.pct // 0)"' coverage/coverage-summary.json | column -t -s "$$(printf '\t')"

# Run combined coverage summary
coverage:
	@command -v cargo-llvm-cov >/dev/null 2>&1 || (echo "cargo-llvm-cov is required. Install with: cargo install cargo-llvm-cov"; exit 1)
	@command -v jq >/dev/null 2>&1 || (echo "jq is required."; exit 1)
	@command -v column >/dev/null 2>&1 || (echo "column is required."; exit 1)
	@echo "Running Rust coverage..."
	@tmp_file="$$(mktemp)"; \
	cd src-tauri && cargo llvm-cov --workspace --all-features --json --summary-only --output-path "$$tmp_file" -- --test-threads=1 >/dev/null 2>&1; \
	backend_lines=$$(jq -r '.data[0].totals.lines.percent | if type == "number" then (.*100|round)/100 else 0 end' "$$tmp_file"); \
	backend_funcs=$$(jq -r '.data[0].totals.functions.percent | if type == "number" then (.*100|round)/100 else 0 end' "$$tmp_file"); \
	rm -f "$$tmp_file"; \
	echo "Running Frontend coverage..."; \
	cd .. && pnpm vitest run --coverage.enabled --coverage.reporter=json-summary >/dev/null 2>&1; \
	frontend_lines=$$(jq -r '.total.lines.pct | if type == "number" then . else 0 end' coverage/coverage-summary.json); \
	frontend_funcs=$$(jq -r '.total.functions.pct | if type == "number" then . else 0 end' coverage/coverage-summary.json); \
	echo ""; \
	echo "=== COMBINED COVERAGE SUMMARY ==="; \
	printf "Part\tLines %%\tFunctions %%\n" > coverage-summary.tmp; \
	printf "Backend (Rust)\t$$backend_lines\t$$backend_funcs\n" >> coverage-summary.tmp; \
	printf "Frontend (React)\t$$frontend_lines\t$$frontend_funcs\n" >> coverage-summary.tmp; \
	column -t -s "$$(printf '\t')" coverage-summary.tmp; \
	rm -f coverage-summary.tmp
