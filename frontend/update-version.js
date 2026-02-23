// Script to auto-generate version.js from package.json
const fs = require('fs');
const path = require('path');

// Read package.json
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
);

const version = packageJson.version;
const buildDate = new Date().toISOString();
const buildId = Date.now();

// Generate version.js
const versionContent = `// Auto-generated version file - DO NOT EDIT MANUALLY
// This file is updated automatically during build
export const APP_VERSION = '${version}';
export const BUILD_DATE = '${buildDate}';
export const CACHE_VERSION = \`devchat-pro-v\${APP_VERSION}\`;
`;

// Write version.js
fs.writeFileSync(
  path.join(__dirname, 'src', 'version.js'),
  versionContent,
  'utf8'
);

console.log(`✅ Version updated to ${version} (${buildDate})`);

// Update service-worker.js cache name
const swPath = path.join(__dirname, 'public', 'service-worker.js');
let swContent = fs.readFileSync(swPath, 'utf8');

// Replace CACHE_NAME with new version
swContent = swContent.replace(
  /const CACHE_NAME = ['"]devchat-pro-v[^'"]+['"]/,
  `const CACHE_NAME = 'devchat-pro-v${version}-b${buildId}'`
);

fs.writeFileSync(swPath, swContent, 'utf8');
console.log(`✅ Service Worker cache updated to v${version}`);
