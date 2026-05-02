const fs = require('fs');
const path = require('path');

const REGISTRY_FILE = 'src/lib/registry-index.json';
const GUIDES_DIR = 'docs/user-guides';

if (!fs.existsSync(REGISTRY_FILE)) {
    console.log('Registry file not found');
    process.exit(1);
}

const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
const pages = registry.pages || [];
const existingGuides = fs.readdirSync(GUIDES_DIR);

console.log('--- Missing User Guides ---');
pages.forEach(page => {
    const guideName = (page.route.replace(/\//g, '-').replace(/^-/, '') || 'home') + '.md';
    if (!existingGuides.includes(guideName)) {
        console.log(`Missing: ${guideName} (Route: ${page.route})`);
    }
});
