const fs = require('fs');
const path = require('path');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function stringifyWithDepth(obj, maxDepth = 2, indent = 2) {
    function helper(value, depth) {
        if (value === null || typeof value !== 'object') {
            return JSON.stringify(value);
        }

        // 超过指定层级，直接压缩
        if (depth >= maxDepth) {
            return JSON.stringify(value);
        }

        const pad = ' '.repeat(indent * depth);
        const padInner = ' '.repeat(indent * (depth + 1));

        if (Array.isArray(value)) {
            const items = value
                .map((v) => padInner + helper(v, depth + 1))
                .join(',\n');
            return `[\n${items}\n${pad}]`;
        }

        const entries = Object.entries(value)
            .map(([k, v]) => `${padInner}${JSON.stringify(k)}: ${helper(v, depth + 1)}`)
            .join(',\n');

        return `{\n${entries}\n${pad}}`;
    }

    return helper(obj, 0);
}

const { ClassReader } = require('../dist/index'); // Use built files or ts-node

const testDir = path.resolve(__dirname, '../src/__test__/data');

let files = fs.readdirSync(testDir);

files = files.slice(1, 6);

for (const file of files) {
    if (file.slice(-6) !== '.class') continue;

    const classPath = path.resolve(testDir, file);
    const buffer = fs.readFileSync(classPath);

    console.log(`Reading ${file}...`);
    try {
        const reader = new ClassReader(buffer);
        console.log('--- PROD ENV ---');
        const resultProd = reader.getClassFile('prod');
        console.log(`Successfully read ${file}. Magic: ${resultProd.magic.toString(16)}`);
        // We only check keys here to verify filtering
        console.log('Keys in prod result:', Object.keys(resultProd));
        console.log(stringifyWithDepth(resultProd, 2));

        console.log('\n--- DEV ENV ---');
        const resultDev = reader.getClassFile('dev');
        console.log('Keys in dev result:', Object.keys(resultDev));
        if (resultDev.methods && resultDev.methods.length > 0) {
            console.log('Keys in dev first method:', Object.keys(resultDev.methods[0]));
        }
    } catch (e) {
        console.error(`Failed to read ${file}:`, e);
    }
    console.log('\n');
}
