const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '../src/app');
const OUTPUT_FILE = path.join(__dirname, '../src/lib/registry-index.json');

function getAllPages(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllPages(dirPath + "/" + file, arrayOfFiles);
        } else {
            if (file === 'page.tsx') {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });

    return arrayOfFiles;
}

function generateIndex() {
    const pages = getAllPages(APP_DIR);
    const registry = pages.map((fullPath, index) => {
        const relativePath = path.relative(APP_DIR, fullPath);
        const route = '/' + relativePath.replace(/\\/g, '/').replace(/\/page\.tsx$/, '').replace(/^page\.tsx$/, '');
        
        // Try to read file to find purpose
        const content = fs.readFileSync(fullPath, 'utf8');
        const purposeMatch = content.match(/\/\/\s*Purpose:\s*(.*)/i);
        
        const stats = fs.statSync(fullPath);

        return {
            id: index + 1,
            path: fullPath,
            route: route || '/',
            name: route.split('/').pop() || 'Home',
            purpose: purposeMatch ? purposeMatch[1] : 'Application Module',
            createdAt: stats.birthtime.toISOString(),
            updatedAt: stats.mtime.toISOString(),
            suggested: [] 
        };
    });

    // Simple suggestion logic: next/prev
    registry.forEach((item, i) => {
        item.prev = i > 0 ? registry[i-1].route : null;
        item.next = i < registry.length - 1 ? registry[i+1].route : null;
        
        const suggestions = registry
            .filter((_, idx) => idx !== i)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3)
            .map(s => ({ route: s.route, name: s.name }));
        
        item.suggested = suggestions;
    });

    // Scan Docs
    const docs = {
        releases: scanDir(path.join(__dirname, '../docs/releases')),
        userGuides: scanDir(path.join(__dirname, '../docs/user-guides')),
        architecture: scanDir(path.join(__dirname, '../docs/architecture'))
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ pages: registry, docs }, null, 2));
    console.log(`📂 Registry Index generated with ${registry.length} pages and ${docs.releases.length + docs.userGuides.length + docs.architecture.length} documents.`);
}

function scanDir(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.md'))
        .map(f => ({
            name: f,
            path: path.join(dir, f),
            updatedAt: fs.statSync(path.join(dir, f)).mtime.toISOString()
        }));
}

generateIndex();
