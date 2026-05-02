const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '../src');
const ARCH_DIR = path.join(__dirname, '../docs/architecture');
const HISTORY_DIR = path.join(__dirname, '../docs/architecture/history');
const VERSION_FILE = path.join(__dirname, '../src/lib/version.json');

function generateArchitectureDocs() {
    if (!fs.existsSync(ARCH_DIR)) fs.mkdirSync(ARCH_DIR, { recursive: true });
    if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });

    const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    const currentVersion = versionData.version;
    const previousVersion = process.env.PREVIOUS_VERSION || currentVersion;
    const releaseHistoryDir = path.join(HISTORY_DIR, `release-v${previousVersion}`);

    const collectionMap = scanCollections();
    
    // Generate Collection Map
    let md = `# 🏗️ Institutional Data Architecture\n\n`;
    md += `**Build Version:** \`${currentVersion}\`\n`;
    md += `**Last Updated:** ${new Date().toLocaleString()}\n\n`;
    md += `Mapping between Application Modules and Firestore Collections.\n\n`;
    md += `| Module / File | Firestore Collection | Access Type |\n`;
    md += `| :--- | :--- | :--- |\n`;
    
    collectionMap.forEach(item => {
        md += `| \`${item.file}\` | \`${item.collection}\` | ${item.type} |\n`;
    });

    const filePath = path.join(ARCH_DIR, 'collection-map.md');

    if (fs.existsSync(filePath)) {
        const oldContent = fs.readFileSync(filePath, 'utf8');
        if (oldContent !== md) {
            // Archive old version
            if (!fs.existsSync(releaseHistoryDir)) fs.mkdirSync(releaseHistoryDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            fs.renameSync(filePath, path.join(releaseHistoryDir, `collection-map-${timestamp}.md`));
            console.log(`🏗️ Archived previous architecture map to ${releaseHistoryDir}`);
        }
    }

    fs.writeFileSync(filePath, md);
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
