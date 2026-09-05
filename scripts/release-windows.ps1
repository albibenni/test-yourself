param(
    [ValidateSet("patch", "minor", "major")]
    [string]$Type = "patch"
)

$ErrorActionPreference = "Stop"

function Assert-LastCommand {
    param([string]$Description)

    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

$workingTreeChanges = & git status --porcelain
Assert-LastCommand "Reading Git status"
if ($workingTreeChanges) {
    throw "Release aborted: commit or stash your working-tree changes first."
}

$releaseCommitted = $false

try {
    Write-Host "Starting $Type release..."

    & pnpm version $Type --no-git-tag-version
    Assert-LastCommand "Updating the package version"

    $package = Get-Content -LiteralPath "package.json" -Raw | ConvertFrom-Json
    $newVersion = [string]$package.version
    if ([string]::IsNullOrWhiteSpace($newVersion)) {
        throw "The new package version could not be determined."
    }

    & node -e 'const fs = require("fs"); const version = process.argv[1]; const file = "src-tauri/tauri.conf.json"; const conf = JSON.parse(fs.readFileSync(file)); conf.version = version; fs.writeFileSync(file, JSON.stringify(conf, null, 2) + "\n");' $newVersion
    Assert-LastCommand "Updating the Tauri version"

    & node -e 'const fs = require("fs"); const version = process.argv[1]; const file = "src-tauri/Cargo.toml"; let toml = fs.readFileSync(file, "utf8"); toml = toml.replace(/^version = ".*"$/m, `version = "${version}"`); fs.writeFileSync(file, toml);' $newVersion
    Assert-LastCommand "Updating the Cargo version"

    & node -e 'const fs = require("fs"); const version = process.argv[1]; const file = "aur/PKGBUILD"; let pkg = fs.readFileSync(file, "utf8"); pkg = pkg.replace(/^pkgver=.*$/m, `pkgver=${version}`); fs.writeFileSync(file, pkg);' $newVersion
    Assert-LastCommand "Updating the AUR version"

    & pnpm tauri build --no-bundle
    Assert-LastCommand "Building the application"

    & pnpm run indent:write
    Assert-LastCommand "Formatting release files"

    & git add -A
    Assert-LastCommand "Staging release files"

    & git commit -m "chore: release v$newVersion"
    Assert-LastCommand "Creating the release commit"
    $releaseCommitted = $true

    & git tag "v$newVersion"
    Assert-LastCommand "Creating the release tag"

    & git push --atomic origin main "v$newVersion"
    Assert-LastCommand "Pushing the release"

    Write-Host ""
    Write-Host "Successfully released v$newVersion. GitHub Actions is now building the installers."
    Write-Host ""
    Write-Host "App Store Connect steps after CI finishes:"
    Write-Host "1. Open App Store Connect -> My Apps -> Test Yourself."
    Write-Host "2. Wait for the uploaded build to finish processing."
    Write-Host "3. Create or open the new iOS version."
    Write-Host "4. Complete the required metadata, screenshots, age rating, and privacy details."
    Write-Host "5. Select the uploaded build under Build."
    Write-Host "6. Complete the export-compliance questions."
    Write-Host "7. Click Add for Review, resolve warnings, and click Submit for Review."
    Write-Host "8. Choose manual release or automatic release after approval."
    Write-Host "Apple review is required before the update becomes public."
}
catch {
    if (-not $releaseCommitted) {
        & git restore --source=HEAD --staged --worktree .
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Release failed and the generated changes could not be rolled back completely."
        }
    }
    throw
}
