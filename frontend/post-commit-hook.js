#!/usr/bin/env node
/**
 * Post-commit hook to auto-bump version
 * Usage: Add this to .git/hooks/post-commit or call it from your commit script
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  // Read package.json
  const packageJsonPath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const currentVersion = packageJson.version;
  console.log(`📦 Current version: ${currentVersion}`);
  
  // Bump patch version
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  const newVersion = `${major}.${minor}.${patch + 1}`;
  
  // Update package.json
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  console.log(`✅ Bumped version to ${newVersion}`);
  
  // Run update-version.js to sync version.js and service-worker.js
  require('./update-version.js');
  
  // Stage and commit the version update
  execSync('git add -A', { cwd: __dirname });
  execSync(`git commit --no-verify -m "chore: bump version to ${newVersion}"`, { cwd: __dirname });
  execSync('git push', { cwd: __dirname });
  console.log(`✅ Version push complete`);
  
} catch (error) {
  console.error('❌ Error in post-commit hook:', error.message);
  process.exit(1);
}
