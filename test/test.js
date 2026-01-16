const fs = require('fs');
const path = require('path');

const { ClassReader } = require('../dist/index'); // Use built files or ts-node

const testDir = path.resolve(__dirname, '../src/__test__/data');

const files = fs.readdirSync(testDir);

for (const file of files) {
    if (file.slice(-6) !== '.class') continue;

    const classPath = path.resolve(testDir, file);
    const buffer = fs.readFileSync(classPath);

    console.log(`Reading ${file}...`);
    try {
        const reader = new ClassReader(buffer);
        const result = reader.getClassFile();
        console.log(`Successfully read ${file}. Magic: ${result.magic.toString(16)}`);
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(`Failed to read ${file}:`, e);
    }
    console.log('\n');
}
