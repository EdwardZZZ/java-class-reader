const fs = require('fs');
const path = require('path');

const { ClassReader } = require('../src/index');
const buff = require('./class');

const testDir = path.resolve('./test');

const files = fs.readdirSync(testDir);

for (const file of files) {
    if (file.slice('-6') !== '.class') continue;

    const classPath = path.resolve(testDir, file);

    const result = new ClassReader(classPath).getAllInfo();

    console.log(JSON.stringify(result), '\n');
}

// const classPath = path.resolve(testDir, 'ResultDto$ResultCode.class');

// const result = new ClassReader(classPath).getAllInfo();

// console.log(JSON.stringify(result, null, 4));

