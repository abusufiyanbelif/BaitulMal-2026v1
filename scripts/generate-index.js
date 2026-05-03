const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '../src/app');
const OUTPUT_FILE = path.join(__dirname, '../src/lib/registry-index.json');

function getAllPages(dirPath) {
    let results = [];
    const list = fs.readdirSync(dirPath);
    list.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllPages(filePath));
        } else {
            if (file === 'page.tsx') {
                results.push(filePath);
            }
        }
    });
    return results;
}

function generateIndex() {
    const pages = getAllPages(APP_DIR);
    const registry = pages.map((fullPath, index) => {
        const relativePath = path.relative(APP_DIR, fullPath);
        const route = '/' + relativePath.replace(/\\/g, '/').replace(/\/page\.tsx$/, '').replace(/^page\.tsx$/, '');
        
        // Scan file content for metadata
        const content = fs.readFileSync(fullPath, 'utf8');
        const purposeMatch = content.match(/\/\/\s*Purpose:\s*(.*)/i);
        
        // Extract Collections
        const collections = [];
        const collRegex = /\.collection\(['"](\w+)['"]\)/g;
        let cMatch;
        while ((cMatch = collRegex.exec(content)) !== null) {
            collections.push(cMatch[1]);
        }

        // Extract Actions
        const actions = [];
        const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
        let bMatch;
        while ((bMatch = btnRegex.exec(content)) !== null) {
            let label = bMatch[1].replace(/<[^>]*>/g, '').trim();
            if (label && label.length < 50) actions.push(label);
        }

        // Extract Fields
        const fields = [];
        const labelRegex = /<Label[^>]*>([\s\S]*?)<\/Label>/g;
        let lMatch;
        while ((lMatch = labelRegex.exec(content)) !== null) {
            const label = lMatch[1].replace(/<[^>]*>/g, '').trim();
            if (label && label.length < 40) fields.push(label);
        }

        const stats = fs.statSync(fullPath);

        const projectRelativePath = path.relative(path.join(__dirname, '..'), fullPath).replace(/\\/g, '/');

        return {
            id: index + 1,
            path: projectRelativePath,
            route: route || '/',
            name: route.split('/').pop() || 'Home',
            purpose: purposeMatch ? purposeMatch[1] : 'Application Module',
            createdAt: stats.birthtime.toISOString(),
            updatedAt: stats.mtime.toISOString(),
            collections: [...new Set(collections)],
            actions: [...new Set(actions)],
            fields: [...new Set(fields)],
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

    const newRegistry = JSON.stringify({ pages: registry, docs }, null, 2);
    
    // Archiving Logic
    const versionFile = path.join(__dirname, '../src/lib/version.json');
    if (fs.existsSync(versionFile)) {
        const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
        const previousVersion = process.env.PREVIOUS_VERSION || versionData.version;
        const historyDir = path.join(__dirname, '../docs/system_manual/history', `release-v${previousVersion}`);
        
        if (fs.existsSync(OUTPUT_FILE)) {
            if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            fs.renameSync(OUTPUT_FILE, path.join(historyDir, `registry-index-${timestamp}.json`));
            console.log(`📂 Archived previous registry index to ${historyDir}`);
        }
    }

    fs.writeFileSync(OUTPUT_FILE, newRegistry);
    console.log(`📂 Registry Index generated with ${registry.length} pages and ${docs.releases.length + docs.userGuides.length + docs.architecture.length} documents.`);
}

function scanDir(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.md'))
        .map(f => {
            const fullFilePath = path.join(dir, f);
            return {
                name: f,
                path: path.relative(path.join(__dirname, '..'), fullFilePath).replace(/\\/g, '/'),
                updatedAt: fs.statSync(fullFilePath).mtime.toISOString()
            };
        });
}

generateIndex();
