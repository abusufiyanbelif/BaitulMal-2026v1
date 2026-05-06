const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('--- Firebase Studio Success Verification ---');

// 1. Check Package Versions
console.log('\n[1] Checking Package Versions...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredVersions = {
  'firebase': '10.14.1',
  'firebase-admin': '12.7.0',
  'genkit': '1.28.0',
  'next': '14.2.35',
  'typescript': '5.9.3'
};

let versionsOk = true;
for (const [pkg, version] of Object.entries(requiredVersions)) {
  const currentVersion = packageJson.dependencies[pkg] || packageJson.devDependencies[pkg];
  if (currentVersion === version) {
    console.log(`✅ ${pkg}: ${currentVersion}`);
  } else {
    console.log(`❌ ${pkg}: Expected ${version}, found ${currentVersion}`);
    versionsOk = false;
  }
}

// 2. Check Firebase Config
console.log('\n[2] Checking Firebase Configuration...');
if (fs.existsSync('firebase.json')) {
  console.log('✅ firebase.json found');
  const firebaseJson = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
  if (firebaseJson.firestore && firebaseJson.firestore.rules) {
    console.log(`✅ Firestore rules mapped to: ${firebaseJson.firestore.rules}`);
  }
} else {
  console.log('❌ firebase.json NOT found');
}

if (fs.existsSync('.firebaserc')) {
  console.log('✅ .firebaserc found');
} else {
  console.log('❌ .firebaserc NOT found');
}

// 3. Check Resource Files
console.log('\n[3] Checking Resource Files...');
const resources = ['firestore.rules', 'storage.rules', 'firestore.indexes.json'];
for (const file of resources) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} found`);
  } else {
    console.log(`⚠️ ${file} NOT found (might be optional but recommended)`);
  }
}

console.log('\n--- Verification Complete ---');
if (versionsOk) {
  console.log('Project is aligned with Firebase Studio requirements.');
} else {
  console.log('Action Required: Please ensure package versions match the requirements.');
}
