# PowerShell script for committing with automatic version bump
# Usage: .\commit-with-auto-bump.ps1 -message "commit message"
# Or use predefined shortcuts: .\commit-with-auto-bump.ps1 -type feature

param(
    [string]$message,
    [string]$type  # feature, fix, chore, refactor, docs, style, perf
)

# If no message provided, ask for it
if (-not $message) {
    if ($type) {
        Write-Host ""
        Write-Host "Commit type: $type"
        Write-Host ""
    }
    $message = Read-Host "Enter commit message (or leave blank for guided mode)"
}

# If still no message, use guided mode
if (-not $message -and $type) {
    $detail = Read-Host "Enter what you changed"
    $message = "$type: $detail"
} elseif (-not $message) {
    Write-Host "Error: No commit message provided"
    exit 1
}

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendPath = Join-Path $scriptPath "frontend"

Write-Host ""
Write-Host "=== Committing: $message ===" -ForegroundColor Cyan
Write-Host ""

# Change to frontend directory
Push-Location $frontendPath

try {
    # Stage all changes
    & git add -A
    
    # Commit
    & git commit -m $message
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Commit failed or nothing to commit" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "=== Auto-bumping version ===" -ForegroundColor Cyan
    Write-Host ""
    
    # Auto-bump version using Node.js script
    & node "$frontendPath\post-commit-hook.js"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ All done! Version bumped, files updated, and pushed to GitHub" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠️  Version bump encountered an issue, but commit is complete" -ForegroundColor Yellow
    }
    
} finally {
    Pop-Location
}
