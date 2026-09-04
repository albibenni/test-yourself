.PHONY: i dev dev-ios dev-ios-open dev-ios-device sim-ios open-ios build test test-ui test-rust coverage coverage-rust coverage-ui lint format clean release install-app uninstall-app remove-aur build-aur install-aur

# Use sccache for Make-driven Rust builds when it is installed locally. CI uses
# its own GitHub Actions cache and does not require this executable.
ifneq ($(shell command -v sccache 2>/dev/null),)
export RUSTC_WRAPPER := $(shell command -v sccache)
endif

# Install dependencies
i:
	pnpm install


# Run the Tauri Desktop App in development mode (runs on port 1422 to allow running alongside dev-ios)
dev:
	PORT=1422 pnpm tauri dev --config src-tauri/tauri.desktop.conf.json

# Run the Tauri App in the iOS Simulator (e.g. make dev-ios or make dev-ios DEVICE="iPhone 17 Pro")
dev-ios:
	pnpm tauri ios dev "$${DEVICE:-iPhone 17}"

# Run the Tauri App and open the Xcode project
dev-ios-open:
	pnpm tauri ios dev --open "$${DEVICE:-iPhone 17}"

# Run the Tauri app in Xcode on a physical iPhone.
# Usage: make dev-ios-device DEVICE="My iPhone" [HOST="192.168.1.42"]
dev-ios-device:
	@test -n "$${DEVICE}" || (echo 'Set DEVICE, e.g. make dev-ios-device DEVICE="Benni’s iPhone"'; exit 1)
	@HOST="$${HOST:-$$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)}"; \
	test -n "$$HOST" || (echo 'Could not detect your Mac IP; pass HOST=192.168.x.x'; exit 1); \
	echo "Using Mac host $$HOST"; \
	pnpm tauri ios dev --open --host "$$HOST" "$${DEVICE}"

# Open the iOS Simulator app on macOS
sim-ios:
	open -a Simulator

# Open the iOS Xcode project in Xcode
open-ios:
	open src-tauri/gen/apple/test-yourself.xcodeproj

# Build the Tauri Desktop App for production (creates the .app)
build:
	pnpm tauri build

# Install the app to your local ~/apps folder and register deep links
install-app:
	@echo "Building binary..."
	pnpm tauri build --no-bundle
	@echo "Installing to ~/apps/test-yourself..."
	@mkdir -p ~/apps
	@if [ -f src-tauri/target/release/test-yourself ]; then \
		cp src-tauri/target/release/test-yourself ~/apps/test-yourself; \
	elif [ -f src-tauri/target/release/tauri-app ]; then \
		cp src-tauri/target/release/tauri-app ~/apps/test-yourself; \
	else \
		echo "Error: Binary not found in src-tauri/target/release/"; exit 1; \
	fi
	@echo "Updating desktop file to point to ~/apps/test-yourself..."
	@mkdir -p ~/.local/share/applications
	@echo "[Desktop Entry]" > ~/.local/share/applications/testyourself.desktop
	@echo "Type=Application" >> ~/.local/share/applications/testyourself.desktop
	@echo "Name=Test Yourself" >> ~/.local/share/applications/testyourself.desktop
	@echo "Exec=$(HOME)/apps/test-yourself %u" >> ~/.local/share/applications/testyourself.desktop
	@echo "Icon=$(HOME)/.local/share/icons/testyourself.png" >> ~/.local/share/applications/testyourself.desktop
	@echo "Terminal=false" >> ~/.local/share/applications/testyourself.desktop
	@echo "Categories=Utility;" >> ~/.local/share/applications/testyourself.desktop
	@echo "MimeType=x-scheme-handler/test-yourself;" >> ~/.local/share/applications/testyourself.desktop
	@update-desktop-database ~/.local/share/applications || true
	@xdg-mime default testyourself.desktop x-scheme-handler/test-yourself || true
	@echo "🎉 Successfully installed! You can now run the app from ~/apps/test-yourself"

# Uninstall the app installed via make install-app
uninstall-app:
	@echo "Removing ~/apps/test-yourself binary..."
	@rm -f ~/apps/test-yourself
	@echo "Removing desktop entry..."
	@rm -f ~/.local/share/applications/testyourself.desktop
	@update-desktop-database ~/.local/share/applications || true
	@echo "Successfully uninstalled local app!"

# Uninstall package previously installed via yay / AUR / pacman
remove-aur:
	@echo "Removing test-yourself installed via yay/pacman..."
	yay -R test-yourself || sudo pacman -R test-yourself

# Build Arch Linux package locally via makepkg in aur directory
build-aur:
	@echo "Building Arch Linux package locally..."
	cd aur && makepkg -s

# Build and install Arch Linux package locally via makepkg in aur directory
install-aur:
	@echo "Building and installing Arch Linux package locally..."
	cd aur && makepkg -si

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
	rm -rf node_modules dist dist-ssr src-tauri/target src-tauri/obsidian-folder-picker/target src-tauri/obsidian-folder-picker/Cargo.lock aur/src aur/pkg aur/*.tar.gz aur/*.pkg.tar.zst

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

# Release automation: bump versions, tag, and push (e.g., make release type=minor)
#To bump the patch version (e.g. 0.1.0 -> 0.1.1):
#    make release
#  To bump the minor version (e.g. 0.1.1 -> 0.2.0):
#    make release type=minor
#  To bump the major version (e.g. 0.2.0 -> 1.0.0):
#    make release type=major
release:
	@set -eu; \
	if [ -n "$$(git status --porcelain)" ]; then \
		echo "Release aborted: commit or stash your working-tree changes first."; \
		exit 1; \
	fi; \
	release_committed=false; \
	trap 'release_status=$$?; if [ "$$release_committed" != true ]; then git restore --source=HEAD --staged --worktree .; fi; exit "$$release_status"' EXIT; \
	type=$(type); \
	if [ -z "$$type" ]; then type="patch"; fi; \
	echo "Starting $$type release..."; \
	pnpm version $$type --no-git-tag-version; \
	new_version=$$(node -p "require('./package.json').version"); \
	test -n "$$new_version"; \
	node -e "const fs = require('fs'); const file = 'src-tauri/tauri.conf.json'; const conf = JSON.parse(fs.readFileSync(file)); conf.version = '$$new_version'; fs.writeFileSync(file, JSON.stringify(conf, null, 2) + '\n');"; \
	node -e "const fs = require('fs'); const file = 'src-tauri/Cargo.toml'; let toml = fs.readFileSync(file, 'utf8'); toml = toml.replace(/^version = \".*\"$$/m, 'version = \"$$new_version\"'); fs.writeFileSync(file, toml);"; \
	node -e "const fs = require('fs'); const file = 'aur/PKGBUILD'; let pkg = fs.readFileSync(file, 'utf8'); pkg = pkg.replace(/^pkgver=.*$$/m, 'pkgver=' + '$$new_version'); fs.writeFileSync(file, pkg);"; \
	pnpm tauri build --no-bundle; \
	pnpm run indent:write; \
	git add -A; \
	git commit -m "chore: release v$$new_version"; \
	release_committed=true; \
	git tag v$$new_version; \
	git push --atomic origin main v$$new_version; \
	echo "\n🎉 Successfully released v$$new_version! GitHub Actions is now building the installers."; \
	echo ""; \
	echo "App Store Connect steps after CI finishes:"; \
	echo "1. Open App Store Connect → My Apps → Test Yourself."; \
	echo "2. Wait for the uploaded build to finish processing."; \
	echo "3. Create or open the new iOS version."; \
	echo "4. Complete the required metadata, screenshots, age rating, and privacy details."; \
	echo "5. Select the uploaded build under Build."; \
	echo "6. Complete the export-compliance questions."; \
	echo "7. Click Add for Review, resolve warnings, and click Submit for Review."; \
	echo "8. Choose manual release or automatic release after approval."; \
	echo "Apple review is required before the update becomes public."
