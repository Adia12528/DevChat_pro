# Auto-Version Bumping & Commit Workflow

This project includes automatic version management to keep your package.json, version.js, and service-worker.js in sync.

## Quick Start

### Option 1: PowerShell (Recommended for Windows)

```powershell
# Simple commit with auto-version bump
.\commit-with-auto-bump.ps1 -message "feat: added new feature"

# Or guided mode
.\commit-with-auto-bump.ps1
```

### Option 2: Batch Script

```batch
commit-with-auto-bump.bat "feat: added new feature"
```

### Option 3: Manual (Standard Git)

```bash
cd frontend
git add -A
git commit -m "feat: added new feature"
node post-commit-hook.js
```

## What Happens Automatically

When you use the auto-bump scripts:

1. **Commit your changes** - All staged changes are committed with your message
2. **Bump version** - Patch version increments (e.g., 2.10.0 → 2.10.1)
3. **Update files** - `version.js`, `service-worker.js`, and `package.json` are updated
4. **Create version commit** - A separate commit is created for the version bump
5. **Push to GitHub** - Everything is pushed to remote repository

## Example Workflow

```powershell
# Add your feature files
git add frontend/src/MyComponent.js

# Run the auto-commit script
.\commit-with-auto-bump.ps1 -message "feat: add new component"

# Result:
# ✅ Your changes committed
# ✅ Version bumped from 2.14.0 → 2.15.0
# ✅ Version files updated
# ✅ Changes pushed to GitHub
```

## Version Format

The version follows semantic versioning: `MAJOR.MINOR.PATCH`

- Automatic bumping increments the **PATCH** version
- To increment MINOR: run `npm version minor
` manually in frontend folder
- To increment MAJOR: run `npm version major` manually in frontend folder

## Files Updated

Each version bump updates these files automatically:

- `frontend/package.json` - Version number
- `frontend/src/version.js` - APP_VERSION, BUILD_DATE, CACHE_VERSION
- `frontend/public/service-worker.js` - CACHE_NAME
- Service Worker cache automatically clears old versions

## Troubleshooting

**Script doesn't run?**
- Make sure you're in PowerShell (not CMD) for .ps1 files
- Try: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

**Version not bumping?**
- Check Node.js is installed: `node --version`
- Manually run: `node frontend/post-commit-hook.js`

**Push failed?**
- Check internet connection
- Verify GitHub credentials
- Push manually: `git push`

## Tips

- Use conventional commit format: `feat:`, `fix:`, `chore:`, `docs:`, etc.
- Message examples:
  - `feat: add dropdown user list`
  - `fix: resolve circular dependency in escape handler`
  - `perf: optimize message rendering`
  - `docs: update README`

- The version bump happens AFTER your commit, so your feature commit has the old version
- This is intentional - your code version matches what actually runs
