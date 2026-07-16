.PHONY: install dev build test test-ui test-rust lint format clean

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

# Run Prettier to format all files
format:
	pnpm indent:write

# Clean all generated files, caches, and node_modules
clean:
	rm -rf node_modules dist dist-ssr src-tauri/target
