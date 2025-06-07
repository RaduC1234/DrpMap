const fs = require('fs');
const path = require('path');

console.log('Fixing index.html base href...');

const indexPath = path.join(__dirname, 'dist', 'drp-map', 'browser', 'index.html');

if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');

    // Fix the base href issue
    content = content.replace('<base href="\'./\'">', '<base href="./">');

    fs.writeFileSync(indexPath, content);
    console.log('✅ Fixed base href in index.html');
} else {
    console.error('❌ index.html not found at:', indexPath);
}