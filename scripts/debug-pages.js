const fs = require('fs');
const path = require('path');

const APP_DIR = 'src/app';

function getAllPages(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllPages(fullPath, arrayOfFiles);
        } else {
            if (file === 'page.tsx') {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

const pages = getAllPages(APP_DIR);
console.log(JSON.stringify(pages, null, 2));
