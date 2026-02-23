#!/usr/bin/env node
/**
 * Post-commit hook to auto-bump version
 * Bumps patch version, updates version.js and service-worker.js, commits and pushes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  const frontendDir = __dirname;
  const packageJsonPath = path.join(frontendDir, 'package.json');
  
  // Read current package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = packageJson.version;
  
  console.log(`📦 Current version: ${currentVersion}`);
  
  // Bump patch version (e.g., 2.10.0 -> 2.10.1)
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  const newVersion = `${major}.${minor}.${patch + 1}`;
  
  // Update package.json version
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  console.log(`✅ Bumped to version: ${newVersion}`);
  
  // Update version.js and service-worker.js
  const buildDate = new Date().toISOString();
  
  const versionJs = `// Auto-generated version file - DO NOT EDIT MANUALLY
// This file is updated automatically during build and version bump
export const APP_VERSION = '${newVersion}';
export const BUILD_DATE = '${buildDate}';
export const CACHE_VERSION = \`devchat-pro-v\${APP_VERSION}\`;
`;
  
  fs.writeFileSync(path.join(frontendDir, 'src', 'version.js'), versionJs, 'utf8');
  console.log(`✅ Updated version.js`);
  
  // Update service-worker.js cache name
  const swPath = path.join(frontendDir, 'public', 'service-worker.js');
  let swContent = fs.readFileSync(swPath, 'utf8');
  swContent = swContent.replace(
    /const CACHE_NAME = ['"]devchat-pro-v[^'"]+['"]/,
    `const CACHE_NAME = 'devchat-pro-v${newVersion}'`
  );
  fs.writeFileSync(swPath, swContent, 'utf8');
  console.log(`✅ Updated service-worker.js cache`);
  
  // Stage the version bump files
  try {
    execSync('git add package.json src/version.js public/service-worker.js', { 
      cwd: frontendDir,
      stdio: 'pipe'
    });
  } catch (e) {
    console.log('⚠️  Could not stage version files');
  }
  
  // Commit version bump (with --no-verify to skip hooks)
  try {
    execSync(`git commit --no-verify -m "chore: release v${newVersion}"`, { 
      cwd: frontendDir,
      stdio: 'pipe'
    });
    console.log(`✅ Committed version bump to v${newVersion}`);
  } catch (e) {
    console.log(`ℹ️  No changes to commit for version bump (already committed)`);
  }
  
  // Push to GitHub
  try {
    execSync('git push', { 
      cwd: frontendDir,
      stdio: 'pipe'
    });
    console.log(`✅ Pushed changes to GitHub`);
  } catch (e) {
    console.log(`⚠️  Push failed - you may need to push manually`);
  }
  
  console.log('');
  console.log(`🎉 Version bumped successfully!`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

