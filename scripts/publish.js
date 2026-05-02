const fs = require('fs');
const path = require('path');

// Configuration
const VERSION_FILE = path.join(__dirname, '../src/lib/version.json');
const RELEASES_DIR = path.join(__dirname, '../docs/releases');

// Auto-trigger Documentation Generation
try {
    const { execSync } = require('child_process');
    console.log('🔄 Regenerating Institutional Documentation...');
    execSync('node scripts/generate-index.js');
    execSync('node scripts/generate-user-guides.js');
    execSync('node scripts/generate-architecture.js');
} catch (e) {
    console.error('Failed to generate documentation suite:', e.message);
}

// Args: node scripts/publish.js [type] [message] [reference] [steps]
const type = process.argv[2] || 'Enhancement'; 
const message = process.argv[3] || 'General improvements and stability fixes.';
const reference = process.argv[4] || ''; // e.g. #123 or #L500-800
const steps = process.argv[5] || ''; // Reproduce/Verify steps

function getGitInfo() {
    try {
        const { execSync } = require('child_process');
        const hash = execSync('git rev-parse --short HEAD').toString().trim();
        const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
        const remote = execSync('git remote get-url origin').toString().trim();
        const repo = remote.split('/').pop().replace('.git', '');
        return { hash, branch, repo };
    } catch (e) {
        return { hash: 'n/a', branch: 'n/a', repo: 'BaitulMal-2026v1' };
    }
}

function updateVersion() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${year}.${month}.${day}`;

    if (!fs.existsSync(RELEASES_DIR)) {
        fs.mkdirSync(RELEASES_DIR, { recursive: true });
    }

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
    
    // Add to history
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

    // Keep only last 50 history entries in JSON
    versionData.history = versionData.history.slice(0, 50);

    fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2));
    console.log(`✅ Version updated to: ${versionData.version}`);

    // Create Separate Release Doc
    createReleaseDoc(entry);
}

function createReleaseDoc(entry) {
    const filename = `release-v${entry.version}.md`;
    const filePath = path.join(RELEASES_DIR, filename);
    const dateStr = new Date(entry.date).toLocaleString();

    let content = `# 🚀 Release Documentation - v${entry.version}\n\n`;
    content += `**Date:** ${dateStr}\n`;
    content += `**Repo:** \`${entry.repo}\`\n`;
    content += `**Branch:** \`${entry.branch}\`\n`;
    content += `**Commit:** \`${entry.commit}\`\n`;
    if (entry.reference) {
        content += `**Reference:** \`${entry.reference}\`\n`;
    }
    content += `\n## 📋 Build Summary\n\n`;

    // Categorize
    const isBug = entry.type.toLowerCase() === 'bug';
    const isEnhancement = entry.type.toLowerCase() === 'enhancement';
    const isFeature = entry.type.toLowerCase() === 'feature' || entry.type.toLowerCase() === 'new feature';

    const msgWithRef = entry.reference ? `${entry.message} (${entry.reference})` : entry.message;

    content += `### 🐞 Bugs Fixed\n${isBug ? `- ${msgWithRef}` : '*No critical bugs reported in this build.*'}\n\n`;
    content += `### ⚡ Enhancements\n${isEnhancement ? `- ${msgWithRef}` : '*No infrastructure enhancements in this build.*'}\n\n`;
    content += `### ✨ New Features\n${isFeature ? `- ${msgWithRef}` : '*No new feature modules in this build.*'}\n\n`;
    
    content += `## 🔍 Verification Steps\n\n`;
    if (entry.steps) {
        content += `${entry.steps}\n\n`;
    } else {
        content += `1. Review the modified code in the referenced commit (\`${entry.commit}\`).\n`;
        content += `2. Verify that the build version \`${entry.version}\` is displayed correctly in the application footer.\n`;
        content += `3. Perform regression testing on the affected module: \`${entry.type}\`.\n\n`;
    }

    content += `---\n*Generated by Institutional Release Automator*`;

    fs.writeFileSync(filePath, content);
    console.log(`📄 Separate release document created: releases/${filename}`);
}

updateVersion();
