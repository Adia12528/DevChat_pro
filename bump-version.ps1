# DevChat Pro - Version Bump Script
# Usage: .\bump-version.ps1 [patch|minor|major]

param(
    [ValidateSet('patch', 'minor', 'major')]
    [string]$Type = 'patch'
)

Write-Host "🔄 Bumping version ($Type)..." -ForegroundColor Cyan

Set-Location "$PSScriptRoot\frontend"

# Bump version in package.json
npm version $Type --no-git-tag-version

# Update version.js and service-worker.js
node update-version.js

# Get new version
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$newVersion = $packageJson.version

Set-Location $PSScriptRoot

# Git commit and push
Write-Host "📦 Committing version $newVersion..." -ForegroundColor Green
git add .
git commit -m "Bump version to v$newVersion"
git push origin main

Write-Host "✅ Successfully bumped to v$newVersion and pushed to GitHub!" -ForegroundColor Green
Write-Host "⏳ Vercel will auto-deploy in ~1-2 minutes" -ForegroundColor Yellow
