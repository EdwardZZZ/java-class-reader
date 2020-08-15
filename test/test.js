const fs = require('fs');
const path = require('path');
const { ClassReader } = require('../dist/index');

const testDir = path.resolve('./test');

const files = fs.readdirSync(testDir);
console.log(files);

for (const file of files) {
    if (file.slice('-6') !== '.class') continue;

    const classPath = path.resolve(testDir, file);

    const result = new ClassReader(classPath).getAllInfo();

    console.log(JSON.stringify(result, null, 4));
}

