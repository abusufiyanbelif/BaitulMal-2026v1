import fs from 'fs';
import path from 'path';

const srcDir = 'C:\\Users\\Admin\\Documents\\baitulamal_2026v1\\src';

function scanDir(dir: string, results: string[] = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDir(fullPath, results);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            
            // Match useDoc and useCollection patterns
            const docRegex = /doc\(firestore,\s*['"](.+?)['"](?:\s*,\s*(.+?))?\)/g;
            const collectionRegex = /collection\(firestore,\s*['"](.+?)['"]\)/g;
            
            let match;
            while ((match = docRegex.exec(content)) !== null) {
                results.push(`FILE: ${fullPath} | DOC PATH: ${match[1]} | ARGS: ${match[2] || 'none'}`);
            }
            while ((match = collectionRegex.exec(content)) !== null) {
                results.push(`FILE: ${fullPath} | COLL PATH: ${match[1]}`);
            }
        }
    }
    return results;
}

const allResults = scanDir(path.join(srcDir, 'app'));
allResults.push(...scanDir(path.join(srcDir, 'hooks')));
allResults.push(...scanDir(path.join(srcDir, 'components')));

console.log(allResults.join('\n'));
