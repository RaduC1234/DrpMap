const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('Converting Excel to JSON...');

try {
    // Read Excel file from public folder
    const excelPath = path.join(__dirname, 'public', 'Questions.xlsx');

    if (!fs.existsSync(excelPath)) {
        console.error('❌ Questions.xlsx not found in public/ folder');
        process.exit(1);
    }

    // Read the Excel file
    const workbook = XLSX.readFile(excelPath);
    console.log('✅ Excel file loaded');

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    console.log(`✅ Processing sheet: ${sheetName}`);

    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    console.log(`✅ Converted ${jsonData.length} rows to JSON`);

    // Create assets folder if it doesn't exist
    const assetsPath = path.join(__dirname, 'src', 'assets');
    if (!fs.existsSync(assetsPath)) {
        fs.mkdirSync(assetsPath, { recursive: true });
        console.log('✅ Created src/assets folder');
    }

    // Write JSON file to assets
    const jsonPath = path.join(assetsPath, 'questions.json');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
    console.log(`✅ JSON file created: ${jsonPath}`);

    // Also copy to public for immediate testing
    const publicJsonPath = path.join(__dirname, 'public', 'questions.json');
    fs.writeFileSync(publicJsonPath, JSON.stringify(jsonData, null, 2));
    console.log(`✅ JSON also copied to public/ for testing`);

    // Show sample data
    if (jsonData.length > 0) {
        console.log('\n📋 Sample question:');
        console.log('Question:', jsonData[0].Intrebare?.substring(0, 50) + '...');
        console.log('Answers:', { a: jsonData[0].a, b: jsonData[0].b, c: jsonData[0].c, d: jsonData[0].d });
        console.log('Correct:', jsonData[0].Raspuns_corect);
    }

    console.log('\n🎉 Conversion completed successfully!');
    console.log('📁 Files created:');
    console.log('   - src/assets/questions.json (for production build)');
    console.log('   - public/questions.json (for development)');

} catch (error) {
    console.error('❌ Error converting Excel:', error.message);
    process.exit(1);
}