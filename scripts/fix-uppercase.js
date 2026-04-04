const fs = require('fs');
const path = require('path');

function titleCase(str) {
  return str.toLowerCase().split(' ').map(function(word) {
    if (word.length === 0) return word;
    return word.replace(word[0], word[0].toUpperCase());
  }).join(' ');
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // 1. Replace tailwind uppercase class with capitalize in exact class boundaries
    content = content.replace(/(\s|"|'|`)uppercase(\s|"|'|`)/g, '$1capitalize$2');

    // 2. Identify pure uppercase strings between standard JSX tags and fix them.
    // e.g. <CardTitle>VERIFIED DONATIONS</CardTitle> -> <CardTitle>Verified Donations</CardTitle>
    // We'll use a regex that matches ALL CAPS with at least one letter and some spaces
    // e.g. >SOME TEXT< or >TEXT<
    content = content.replace(/>([^<]*[A-Z][A-Z\s]+[^<]*)<\//g, (match, p1) => {
        // Only title case if the ENTIRE thing is upper-case (except spaces/punctuation)
        const stripped = p1.trim();
        if (stripped.length > 2 && stripped === stripped.toUpperCase() && /[A-Z]/.test(stripped)) {
            const transformed = titleCase(p1);
            return `>${transformed}</`;
        }
        return match;
    });

    if (original !== content) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated: ${filePath}`);
    }
}

function traverseDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!file.startsWith('.') && file !== 'node_modules') {
                traverseDir(fullPath);
            }
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            processFile(fullPath);
        }
    }
}

const srcDir = path.join(__dirname, '..', 'src');
traverseDir(srcDir);
console.log('Complete!');
