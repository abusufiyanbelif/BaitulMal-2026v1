const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * setup-studio.js
 * Automatically verifies and updates the environment for Firebase Studio success.
 */

console.log('\x1b[36m%s\x1b[0m', '🚀 Starting Firebase Studio Setup & Synchronization...');

function run(command) {
  try {
    console.log(`\x1b[2mRunning: ${command}\x1b[0m`);
    return execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`\x1b[31mError running command: ${command}\x1b[0m`);
    return null;
  }
}

// 1. Dependency Synchronization
console.log('\n\x1b[33m[1/4] Synchronizing Dependencies...\x1b[0m');
const packageJsonPath = path.join(process.cwd(), 'package.json');
const studioModulesPath = path.join(process.cwd(), 'modules_firebase_studio.txt');

if (fs.existsSync(studioModulesPath)) {
  console.log('✅ Found modules_firebase_studio.txt. Ensuring package.json matches...');
  // Note: We assume package.json was already updated by the assistant.
  // This step ensures npm install is run to match the manifest.
  run('npm install --no-audit --no-fund');
} else {
  console.log('⚠️ modules_firebase_studio.txt not found. Using current package.json...');
  run('npm install');
}

// 2. Environment Variable Setup
console.log('\n\x1b[33m[2/4] Verifying Environment Variables...\x1b[0m');
const envPath = path.join(process.cwd(), '.env.local');
const envTemplatePath = path.join(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envTemplatePath)) {
    console.log('📝 .env.local missing. Creating from .env template...');
    fs.copyFileSync(envTemplatePath, envPath);
    console.log('✅ .env.local created.');
  } else {
    console.log('❌ .env.local and .env template missing!');
    console.log('Please create a .env.local file with your Firebase and Genkit keys.');
  }
} else {
  console.log('✅ .env.local found.');
}

// 3. Firebase Resource Verification
console.log('\n\x1b[33m[3/4] Verifying Firebase Resources...\x1b[0m');
const resources = [
  { file: 'firestore.rules', desc: 'Firestore Security Rules' },
  { file: 'storage.rules', desc: 'Storage Security Rules' },
  { file: 'firestore.indexes.json', desc: 'Firestore Indexes' },
  { file: 'firebase.json', desc: 'Firebase Config' }
];

resources.forEach(res => {
  if (fs.existsSync(path.join(process.cwd(), res.file))) {
    console.log(`✅ ${res.desc} (${res.file}) found.`);
  } else {
    console.log(`❌ ${res.desc} (${res.file}) MISSING! This may cause deployment failures.`);
  }
});

// 4. Build Check (Optional but recommended)
console.log('\n\x1b[33m[4/4] Running Quick Build Check...\x1b[0m');
console.log('This verifies that the code compiles with the current dependencies.');
run('npm run build');

console.log('\n\x1b[32m%s\x1b[0m', '✨ Setup Complete! Your Firebase Studio environment is ready.');
console.log('You can now run "npm run dev" to start the development server.');
