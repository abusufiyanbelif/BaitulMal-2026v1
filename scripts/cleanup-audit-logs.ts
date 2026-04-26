
import { cleanupAuditLogsAction } from '../src/app/audit/actions';

async function main() {
    const days = process.argv[2] ? parseInt(process.argv[2]) : 90;
    
    console.log(`--- AUDIT LOG CLEANUP ---`);
    console.log(`Target: Logs older than ${days} days`);
    
    const result = await cleanupAuditLogsAction(days);
    
    if (result.success) {
        console.log(`SUCCESS: ${result.message}`);
        console.log(`Deleted Count: ${result.count}`);
    } else {
        console.error(`FAILED: ${result.message}`);
        process.exit(1);
    }
    
    console.log(`--- PROCESS COMPLETE ---`);
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
