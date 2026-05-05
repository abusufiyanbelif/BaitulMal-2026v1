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
        
        // Check for uncommitted changes
        const isDirty = execSync('git status --porcelain').toString().trim().length > 0;
        
        // 1. Find the hash of the last release commit
        let lastReleaseHash = '';
        try {
            lastReleaseHash = execSync('git log --grep="^release: " -1 --pretty=%H').toString().trim();
        } catch (e) {}

        // 2. Get all commits since the last release (excluding the release commit itself)
        const logRange = lastReleaseHash ? `${lastReleaseHash}..HEAD` : 'HEAD';
        const rawCommits = execSync(`git log ${logRange} --pretty=format:"%B%n---COMMIT-END---"`).toString().trim();
        
        let type = 'Build';
        let message = '';
        let reference = 'n/a';
        let steps = isDirty ? 'Uncommitted changes detected. Manual verification required.' : 'Manual verification required.';

        if (rawCommits) {
            const commitBlocks = rawCommits.split('---COMMIT-END---').filter(b => b.trim());
            const subjects = [];
            const refs = new Set();

            commitBlocks.forEach(block => {
                const lines = block.trim().split('\n');
                if (lines[0]) subjects.push(lines[0]);

                lines.forEach(line => {
                    const l = line.toLowerCase();
                    if (l.startsWith('type:')) {
                        const t = line.split(':').slice(1).join(':').trim();
                        if (t) type = t;
                    }
                    if (l.startsWith('reference:')) {
                        const r = line.split(':').slice(1).join(':').trim();
                        if (r && r !== 'n/a') refs.add(r);
                    }
                });
            });

            message = subjects.join('; ');
            if (refs.size > 0) reference = Array.from(refs).join(', ');
        } else {
            // No new commits since last release, use last commit but mark as local
            const lastCommit = execSync('git log -1 --pretty=%B').toString().trim();
            const lines = lastCommit.split('\n');
            message = lines[0] || 'Manual Build Update';
        }

        if (isDirty) {
            message = message ? `${message} (with local changes)` : 'Local modifications only';
        }

        return { hash, branch, repo, type, message, reference, steps, isDirty };
    } catch (e) {
        return { 
            hash: 'n/a', 
            branch: 'n/a', 
            repo: 'BaitulMal-2026v1', 
            type: 'Build', 
            message: 'Manual Build (Git Error)', 
            reference: 'n/a', 
            steps: 'Manual verification required.',
            isDirty: true
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
