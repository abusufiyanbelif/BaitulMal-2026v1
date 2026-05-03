const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VERSION_FILE = path.join(__dirname, '../src/lib/version.json');

function getGitInfo() {
    try {
        const hash = execSync('git rev-parse --short HEAD').toString().trim();
        const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
        const remote = execSync('git remote get-url origin').toString().trim();
        const repo = remote.split('/').pop().replace('.git', '');
        return { hash, branch, repo };
    } catch (e) {
        return { hash: 'n/a', branch: 'n/a', repo: 'BaitulMal-2026v1' };
    }
}

function updateVersion(type = 'Build', message = 'Automated build update', reference = '', steps = '') {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${year}.${month}.${day}`;

    let versionData = {
        version: `${datePrefix}.1`,
        buildDate: now.toISOString(),
        history: []
    };

    if (fs.existsSync(VERSION_FILE)) {
        try {
            versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
            const parts = versionData.version.split('.');
            const currentPrefix = parts.slice(0, 3).join('.');
            let buildNum = parseInt(parts[3]) || 0;

            if (currentPrefix === datePrefix) {
                buildNum += 1;
            } else {
                buildNum = 1;
            }
            versionData.version = `${datePrefix}.${buildNum}`;
        } catch (e) {
            console.error('Error parsing version file, resetting...');
        }
    }

    versionData.buildDate = now.toISOString();
    const gitInfo = getGitInfo();
    
    const entry = {
        version: versionData.version,
        date: now.toISOString(),
        commit: gitInfo.hash,
        branch: gitInfo.branch,
        repo: gitInfo.repo,
        reference: reference,
        steps: steps,
        type: type.charAt(0).toUpperCase() + type.slice(1).toLowerCase(),
        message: message
    };
    
    if (!versionData.history) versionData.history = [];
    versionData.history.unshift(entry);
    versionData.history = versionData.history.slice(0, 50);

    fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2));
    return versionData.version;
}

module.exports = { updateVersion };
