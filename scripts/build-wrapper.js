const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../logs/build');
const VERSION_FILE = path.join(__dirname, '../src/lib/version.json');

const { updateVersion } = require('./version-utils');

function runBuild() {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

    // Auto-increment version before build
    const version = updateVersion('Build', 'Automated build initiated via npm run build');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const date = new Date().toISOString().split('T')[0];
    
    console.log(`🚀 Initiating Institutional Build Sequence [v${version}]...`);
    
    try {
        const output = execSync('next build', { encoding: 'utf8' });
        console.log(output);
        
        const successLog = `BUILD SUCCESS LOG - ${new Date().toLocaleString()}\nVersion: ${version}\n\n${output}`;
        const logPath = path.join(LOGS_DIR, `build-success-${date}-v${version}-${timestamp}.log`);
        fs.writeFileSync(logPath, successLog);
        
        console.log('✅ Build Successful.');
        console.log('🔄 Triggering Automated Documentation Suite...');
        execSync('npm run docs:generate', { stdio: 'inherit' });
        
    } catch (error) {
        console.error('❌ Build Failed.');
        
        const errorLog = `BUILD FAILURE LOG - ${new Date().toLocaleString()}\nVersion: ${version}\n\n` + 
                         `STDOUT:\n${error.stdout}\n\n` + 
                         `STDERR:\n${error.stderr}\n\n` + 
                         `ERROR MESSAGE:\n${error.message}`;
        
        const logPath = path.join(LOGS_DIR, `build-error-${date}-v${version}-${timestamp}.log`);
        fs.writeFileSync(logPath, errorLog);
        
        console.error(error.stdout);
        console.error(error.stderr);
        
        console.log(`\n⚠️ Error details saved to: logs/build/${path.basename(logPath)}`);
        process.exit(1);
    }
}

runBuild();
