
import { getAdminServices } from '../src/lib/firebase-admin-sdk';
import { scanDataHealthAction, fixDataIssuesAction } from '../src/app/settings/data-health/actions';

async function main() {
    console.log('--- DATA HEALTH AUTOMATION ---');
    
    console.log('Step 1: Scanning for issues...');
    const scanResult = await scanDataHealthAction();
    
    if (!scanResult.success) {
        console.error('Scan Failed:', scanResult.message);
        process.exit(1);
    }
    
    console.log(`Scan Results: Found ${scanResult.issues.length} issues.`);
    
    const autoFixable = scanResult.issues.filter(i => i.canAutoFix);
    console.log(`Auto-Fixable: ${autoFixable.length} issues.`);
    
    if (autoFixable.length === 0) {
        console.log('No issues to fix. Database is healthy.');
        process.exit(0);
    }
    
    console.log('Step 2: Applying fixes...');
    const fixResult = await fixDataIssuesAction(autoFixable.map(i => i.id), scanResult.issues);
    
    if (!fixResult.success) {
        console.error('Fix Failed:', fixResult.message);
        process.exit(1);
    }
    
    console.log(`Success: Fixed ${fixResult.fixedCount} records.`);
    console.log('--- PROCESS COMPLETE ---');
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
