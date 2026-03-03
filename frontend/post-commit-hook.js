// Git post-commit hook to auto-increment version
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Get the commit message
  const commitMsg = execSync('git log -1 --pretty=%B').toString().trim();
  
  // Check if commit message indicates a version bump
  if (commitMsg.includes('[bump version]')) {
    console.log('📦 Version bump detected, updating version...');
    
    // Run the version update script
    require('./update-version');
    
    // Add the updated version file to the commit
    execSync('git add src/version.js');
    
    // Amend the commit to include the version update
    execSync('git commit --amend --no-edit');
    
    console.log('✅ Version updated and commit amended');
  }
} catch (error) {
  console.error('❌ Failed to update version:', error.message);
}