# 🚀 Automatic Version Management

Your DevChat Pro now has **automatic version management** that keeps the website fresh with every deployment!

## ✨ What It Does

- **Auto-updates version** on every build
- **Clears browser cache** automatically with new versions
- **Shows version** in the menu dropdown
- **Logs version** in browser console
- **No manual work** needed!

## 📦 How It Works

1. **Build Time**: Before each build (dev or production), `update-version.js` runs automatically
2. **Version Sync**: Reads version from `package.json` and updates:
   - `frontend/src/version.js` - React app version
   - `frontend/public/service-worker.js` - Cache version
3. **Auto Deploy**: When you push to GitHub, Vercel builds and deploys with the new version
4. **Cache Busting**: New cache name forces browsers to download fresh code

## 🎯 Usage

### Method 1: Automatic (Recommended)
Just push code changes - version system runs automatically during build:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

### Method 2: Manual Version Bump
Use the PowerShell script to bump version and deploy:

```powershell
# Bump patch version (2.9.0 → 2.9.1)
.\bump-version.ps1 patch

# Bump minor version (2.9.0 → 2.10.0)
.\bump-version.ps1 minor

# Bump major version (2.9.0 → 3.0.0)
.\bump-version.ps1 major
```

The script will:
1. ✅ Update version in `package.json`
2. ✅ Regenerate `version.js` and update Service Worker
3. ✅ Commit and push to GitHub
4. ✅ Trigger Vercel auto-deployment

### Method 3: NPM Command
```bash
cd frontend
npm run version:bump
```

## 📍 Where Version Appears

1. **Menu Dropdown**: Bottom footer shows `v2.9.0 • 2/23/2026`
2. **Browser Console**: Colorful log on app load
3. **Service Worker**: Cache named `devchat-pro-v2.9.0`

## 🔧 Files Involved

- `frontend/package.json` - Source of truth for version
- `frontend/update-version.js` - Auto-generation script
- `frontend/src/version.js` - Generated version constants
- `frontend/public/service-worker.js` - Cache version (auto-updated)
- `bump-version.ps1` - Quick bump & deploy script

## 💡 Benefits

✅ **No stale cache issues** - Every version gets fresh cache
✅ **Easy troubleshooting** - Users can report exact version
✅ **Professional** - Shows you care about user experience
✅ **Automated** - Set it and forget it!

## 🎉 That's It!

Your website now auto-updates with each deployment. Users get fresh code instantly (after hard refresh for existing cached versions).
