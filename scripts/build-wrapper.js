const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../build-error.log');

function runBuild() {
    console.log('🚀 Initiating Institutional Build Sequence...');
    
    try {
        // Run build. We don't use 'inherit' because we want to capture output on failure
        const output = execSync('next build', { encoding: 'utf8' });
        console.log(output);
        
        // If success, clean up log
        if (fs.existsSync(LOG_FILE)) {
            fs.unlinkSync(LOG_FILE);
        }
        console.log('✅ Build Successful.');
        
        // Trigger documentation generation
        console.log('🔄 Triggering Automated Documentation Suite...');
        execSync('npm run docs:generate', { stdio: 'inherit' });
        
    } catch (error) {
        console.error('❌ Build Failed. Logging error details...');
        
        // Extract stderr and stdout from error object
        const errorLog = `BUILD FAILURE LOG - ${new Date().toLocaleString()}\n\n` + 
                         `STDOUT:\n${error.stdout}\n\n` + 
                         `STDERR:\n${error.stderr}\n\n` + 
                         `ERROR MESSAGE:\n${error.message}`;
        
        fs.writeFileSync(LOG_FILE, errorLog);
        
        // Also print to console so user/agent sees it
        console.error(error.stdout);
        console.error(error.stderr);
        
        console.log(`\n⚠️ Error details saved to: ${path.basename(LOG_FILE)}`);
        process.exit(1);
    }
}

runBuild();
