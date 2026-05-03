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
        
        // Get the last commit that is NOT a release commit
        const lastNonRelease = execSync('git log --grep="^release: " --invert-grep -1 --pretty=%B').toString().trim();
        const lines = lastNonRelease.split('\n');
        const subject = lines[0] || 'Manual Build Update';
        
        // Try to parse structured fields if they exist in the commit message
        let type = 'Build';
        let message = subject;
        let reference = 'n/a';
        let steps = 'Manual verification required.';

        lines.forEach(line => {
            if (line.toLowerCase().startsWith('type:')) {
                const parts = line.split(':');
                if (parts.length > 1) type = parts.slice(1).join(':').trim();
            }
            if (line.toLowerCase().startsWith('message:')) {
                const parts = line.split(':');
                if (parts.length > 1) message = parts.slice(1).join(':').trim();
            }
            if (line.toLowerCase().startsWith('reference:')) {
                const parts = line.split(':');
                if (parts.length > 1) reference = parts.slice(1).join(':').trim();
            }
            if (line.toLowerCase().startsWith('verification steps:')) {
                const parts = line.split(':');
                if (parts.length > 1) steps = parts.slice(1).join(':').trim();
            }
        });

        // Use the commit hash of the ACTUAL last commit (which might be the release commit)
        // or should we use the hash of the last NON-release commit?
        // Usually, the release hash is what's being built.
        
        return { hash, branch, repo, type, message, reference, steps };
    } catch (e) {
        return { 
            hash: 'n/a', 
            branch: 'n/a', 
            repo: 'BaitulMal-2026v1', 
            type: 'Build', 
            message: 'Automated build update', 
            reference: 'n/a', 
            steps: 'Manual verification required.' 
        };
    }
}

function updateVersion(overrideType = null, overrideMessage = null, overrideReference = null, overrideSteps = null) {
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
        reference: overrideReference || gitInfo.reference,
        steps: overrideSteps || gitInfo.steps,
        type: (overrideType || gitInfo.type).charAt(0).toUpperCase() + (overrideType || gitInfo.type).slice(1).toLowerCase(),
        message: overrideMessage || gitInfo.message
    };
    
    if (!versionData.history) versionData.history = [];
    versionData.history.unshift(entry);
    versionData.history = versionData.history.slice(0, 50);

    fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2));
    return versionData.version;
}

module.exports = { updateVersion };
