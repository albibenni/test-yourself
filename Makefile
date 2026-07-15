.PHONY: install dev build test lint format clean

# Install dependencies
install:
	pnpm install

# Run the Tauri Desktop App in development mode
dev:
	pnpm tauri dev

# Build the Tauri Desktop App for production (creates the .app)
build:
	pnpm tauri build

# Run the Vitest testing suite
test:
	pnpm test

# Run ESLint to check for code issues
lint:
	pnpm lint

# Run Prettier to format all files
format:
	pnpm indent:write

# Clean all generated files, caches, and node_modules
clean:
	rm -rf node_modules dist dist-ssr src-tauri/target
