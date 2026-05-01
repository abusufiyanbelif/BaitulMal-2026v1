const fs = require('fs');
const content = fs.readFileSync('src/app/profile/page.tsx', 'utf8');

let openBraces = 0;
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let openCount = (line.match(/\{/g) || []).length;
    let closeCount = (line.match(/\}/g) || []).length;
    openBraces += openCount - closeCount;
    if (i >= 220 && i <= 240) {
        console.log(`Line ${i + 1}: ${line.trim()} | Balance: ${openBraces}`);
    }
}
console.log('Final Balance:', openBraces);
