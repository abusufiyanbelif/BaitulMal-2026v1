const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '../src');
const ARCH_DIR = path.join(__dirname, '../docs/architecture');

function generateArchitectureDocs() {
    if (!fs.existsSync(ARCH_DIR)) fs.mkdirSync(ARCH_DIR, { recursive: true });

    const collectionMap = scanCollections();
    
    // Generate Collection Map
    let md = `# 🏗️ Institutional Data Architecture\n\n`;
    md += `Mapping between Application Modules and Firestore Collections.\n\n`;
    md += `| Module / File | Firestore Collection | Access Type |\n`;
    md += `| :--- | :--- | :--- |\n`;
    
    collectionMap.forEach(item => {
        md += `| \`${item.file}\` | \`${item.collection}\` | ${item.type} |\n`;
    });

    fs.writeFileSync(path.join(ARCH_DIR, 'collection-map.md'), md);
    console.log(`🏗️ Architecture documentation updated: collection-map.md`);
}

function scanCollections() {
    const maps = [];
    const files = getAllFiles(APP_DIR);

    files.forEach(file => {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return;
        const content = fs.readFileSync(file, 'utf8');
        const relPath = path.relative(APP_DIR, file);

        // Find collection names
        const collRegex = /\.collection\(['"](\w+)['"]\)/g;
        let match;
        while ((match = collRegex.exec(content)) !== null) {
            maps.push({
                file: relPath,
                collection: match[1],
                type: content.includes('.set(') || content.includes('.update(') || content.includes('.add(') ? 'Read/Write' : 'Read-Only'
            });
        }
    });

    // Deduplicate
    return maps.filter((v, i, a) => a.findIndex(t => (t.file === v.file && t.collection === v.collection)) === i);
}

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function(file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file));
        }
    });
    return arrayOfFiles;
}

generateArchitectureDocs();
