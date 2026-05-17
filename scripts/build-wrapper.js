const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../logs/build');
const VERSION_FILE = path.join(__dirname, '../src/lib/version.json');

const { updateVersion } = require('./version-utils');

function runBuild() {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

    // Parse arguments for version override
    const args = process.argv.slice(2);
    let overrideType = null;
    let overrideMessage = null;
    let overrideReference = null;
    let overrideSteps = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--type' && args[i+1]) overrideType = args[++i];
        if (args[i] === '--message' && args[i+1]) overrideMessage = args[++i];
        if (args[i] === '--reference' && args[i+1]) overrideReference = args[++i];
        if (args[i] === '--steps' && args[i+1]) overrideSteps = args[++i];
    }

    // Auto-increment version before build
    const version = updateVersion(overrideType, overrideMessage, overrideReference, overrideSteps);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const date = new Date().toISOString().split('T')[0];
    
    // Force Webpack cache invalidation for app-footer client bundle
    const appFooterPath = path.join(__dirname, '../src/components/app-footer.tsx');
    if (fs.existsSync(appFooterPath)) {
        let footerContent = fs.readFileSync(appFooterPath, 'utf8');
        footerContent = footerContent.replace(/\/\/ Build Timestamp: .*/g, `// Build Timestamp: ${timestamp}`);
        if (!footerContent.includes('// Build Timestamp:')) {
            footerContent = `// Build Timestamp: ${timestamp}\n` + footerContent;
        }
        fs.writeFileSync(appFooterPath, footerContent);
    }

    console.log(`🚀 Initiating Organization Build Sequence [v${version}]...`);
    
    try {
        const output = execSync('npx next build', { encoding: 'utf8' });
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
