const fs = require('fs');
const path = require('path');

const REGISTRY_FILE = path.join(__dirname, '../src/lib/registry-index.json');
const GUIDES_DIR = path.join(__dirname, '../docs/user-guides');
const HISTORY_DIR = path.join(__dirname, '../docs/user-guides/history');
const VERSION_FILE = path.join(__dirname, '../src/lib/version.json');

function generateUserGuides() {
    if (!fs.existsSync(REGISTRY_FILE)) return;
    const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    const pages = registry.pages || [];
    const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    const currentVersion = versionData.version;
    const previousVersion = process.env.PREVIOUS_VERSION || currentVersion;

    const releaseHistoryDir = path.join(HISTORY_DIR, `release-v${previousVersion}`);

    if (!fs.existsSync(GUIDES_DIR)) fs.mkdirSync(GUIDES_DIR, { recursive: true });
    if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });

    pages.forEach(page => {
        const guideName = page.route.replace(/\//g, '-').replace(/^-/, '') || 'home';
        const guidePath = path.join(GUIDES_DIR, `${guideName}.md`);
        
        // Scan page content for details
        const content = fs.readFileSync(page.path, 'utf8');
        const actionItems = extractActionItems(content);
        const useCases = inferUseCases(page.route, content);
        const fields = extractFields(content);
        const collections = scanCollectionsForPage(content);
        const reproSteps = extractReproductionSteps(content);

        const newContent = generateMarkdown(page, currentVersion, useCases, actionItems, fields, collections, reproSteps);

        if (fs.existsSync(guidePath)) {
            const oldContent = fs.readFileSync(guidePath, 'utf8');
            if (oldContent !== newContent) {
                // Version changed or content updated, move to history in version-specific folder
                const today = new Date().toISOString().split('T')[0];
                const dateSpecificHistoryDir = path.join(releaseHistoryDir, today);
                if (!fs.existsSync(dateSpecificHistoryDir)) fs.mkdirSync(dateSpecificHistoryDir, { recursive: true });
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const historyFilename = `${guideName}-${timestamp}.md`;
                fs.renameSync(guidePath, path.join(dateSpecificHistoryDir, historyFilename));
                fs.writeFileSync(guidePath, newContent);
                console.log(`📝 Updated User Guide: ${guideName} (Archived to ${dateSpecificHistoryDir})`);
            }
        } else {
            fs.writeFileSync(guidePath, newContent);
            console.log(`🆕 Created User Guide: ${guideName}`);
        }
    });
}

function extractReproductionSteps(content) {
    const steps = [];
    const stepRegex = /\/\/\s*(?:Reproduction\s+)?Step:\s*(.*)/gi;
    let match;
    while ((match = stepRegex.exec(content)) !== null) {
        steps.push(match[1].trim());
    }
    return steps;
}

function extractActionItems(content) {
    const items = [];
    // Find Button labels with surrounding context
    const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
    let match;
    while ((match = btnRegex.exec(content)) !== null) {
        let label = match[1].replace(/<[^>]*>/g, '').trim();
        if (label && label.length < 50) {
            // Try to find if it triggers a handle function
            const btnContent = match[0];
            const clickMatch = btnContent.match(/onClick={([^}]+)}/);
            const action = clickMatch ? ` (Triggers ${clickMatch[1]})` : '';
            items.push({ label, description: `Interactive button to initiate ${label.toLowerCase()} operation${action}.` });
        }
    }
    // Find handleX functions
    const funcRegex = /const\s+(handle\w+)\s*=/g;
    while ((match = funcRegex.exec(content)) !== null) {
        const funcName = match[1];
        if (!items.find(i => i.label === funcName)) {
            items.push({ label: funcName, description: `Internal logic handler for ${funcName.replace('handle', '')} workflow.` });
        }
    }
    return items;
}

function extractFields(content) {
    const fields = [];
    const labelRegex = /<Label[^>]*>([\s\S]*?)<\/Label>/g;
    let match;
    while ((match = labelRegex.exec(content)) !== null) {
        const label = match[1].replace(/<[^>]*>/g, '').trim();
        if (label && label.length < 40) fields.push(label);
    }
    const placeholderRegex = /placeholder="([^"]+)"/g;
    while ((match = placeholderRegex.exec(content)) !== null) {
        fields.push(`Input: ${match[1]}`);
    }
    return [...new Set(fields)];
}

function scanCollectionsForPage(content) {
    const collections = [];
    const collRegex = /\.collection\(['"](\w+)['"]\)/g;
    let match;
    while ((match = collRegex.exec(content)) !== null) {
        collections.push(match[1]);
    }
    return [...new Set(collections)];
}

function inferUseCases(route, content) {
    const cases = [];
    if (route.includes('dashboard')) cases.push('Monitor institutional statistics and metrics in real-time.');
    if (route.includes('settings')) cases.push('Configure administrative parameters, API keys, and resource limits.');
    if (route.includes('profile')) cases.push('Update user identity, contact details, and security credentials.');
    if (route.includes('donations')) cases.push('Manage financial contributions, verify receipts, and track donor history.');
    if (route.includes('campaigns')) cases.push('Create and monitor social outreach initiatives and fundraising goals.');
    if (route.includes('beneficiaries')) cases.push('Maintain records of individuals receiving institutional support.');
    if (route.includes('leads')) cases.push('Track potential support requests and initial inquiry data.');
    
    // Add logic-based use cases
    if (content.includes('export')) cases.push('Generate and download data reports for external audit.');
    if (content.includes('upload')) cases.push('Attach supporting documentation or evidence to institutional records.');
    if (content.includes('verify')) cases.push('Perform administrative verification of submitted data.');

    if (cases.length === 0) cases.push('Standard institutional operations and data management.');
    return [...new Set(cases)];
}

function generateMarkdown(page, version, useCases, actionItems, fields, collections, reproSteps) {
    return `# 📘 User Guide: ${page.route}
    
**Build Version:** \`${version}\`
**Last Updated:** ${new Date().toLocaleString()}
**Internal Route:** \`${page.route}\`

---

## 🎯 Purpose
${page.purpose || 'Institutional module for administrative operations.'}

## 📋 Primary Use Cases
${useCases.map(uc => `- ${uc}`).join('\n')}

## 🧪 Reproducible Steps
${reproSteps.length > 0 
    ? reproSteps.map(s => `- ${s}`).join('\n')
    : `- Navigate to \`${page.route}\` through the institutional dashboard.\n- Interact with the available data fields and action buttons listed below.`}

## 🏗️ Data Architecture (Firestore)
${collections.length > 0 
    ? `Interacts with the following collections:\n${collections.map(c => `- \`${c}\``).join('\n')}`
    : '*No direct Firestore collection interactions detected.*'}

## ⌨️ Fields & Data Mapping
${fields.length > 0
    ? `The following fields are mapped within this interface:\n${fields.map(f => `- ${f}`).join('\n')}`
    : '*No distinct data fields identified.*'}

## ⚡ Interactive Action Items
${actionItems.length > 0 
    ? actionItems.map(item => `- **${item.label}**: ${item.description}`).join('\n')
    : '*No direct action items identified for this interface.*'}

## 🛡️ Security & Access
Access to this module is restricted based on institutional roles (Admin, Staff, or Portal User). Ensure you have the necessary clearance before attempting modifications.

---
*Generated by Institutional Documentation Engine v1.2*`;
}

generateUserGuides();
