const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.join(__dirname, '../src/lib/version.json');
const COMMIT_SUMMARY_FILE = path.join(__dirname, '../commit-summary.txt');

function generateBuildSummary() {
    if (!fs.existsSync(VERSION_FILE)) return;

    try {
        const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
        const latest = versionData.history[0] || { 
            version: versionData.version, 
            type: 'Build', 
            message: 'Documentation Refresh', 
            reference: 'n/a', 
            branch: 'n/a', 
            commit: 'n/a', 
            steps: 'Manual verification' 
        };

        const summary = `release: v${latest.version}\n\nType: ${latest.type}\nMessage: ${latest.message}\nReference: ${latest.reference || 'n/a'}\nBranch: ${latest.branch}\nCommit: ${latest.commit}\n\nVerification Steps:\n${latest.steps || 'Manual verification required.'}\n\n---\n*Build Summary Updated: ${new Date().toLocaleString()}*`;
        
        fs.writeFileSync(COMMIT_SUMMARY_FILE, summary);
        console.log(`📝 Build commit summary synchronized: commit-summary.txt`);
    } catch (e) {
        console.error('Failed to update build summary:', e.message);
    }
}

generateBuildSummary();
