const fs = require('fs');
const path = require('path');
require('ts-mocha');
const Mocha = require('mocha');
const mocha = new Mocha();

const ROOT = process.cwd();
const fullPath = (p) => path.resolve(ROOT, p);

/**
 * add *.spec.ts
 * Author by zhangzhihua
 * addFile eg: mocha.addFile('./test/tcp.spec.ts'));
 */
process.env.MOCHAMODE = 'multy';
fs.readdirSync(fullPath('test')).forEach((name) => {
    if (name.slice(-7) === 'spec.ts') {
        mocha.addFile(fullPath(`test/${name}`));
    }
});

mocha.run(() => {
    process.exit();
});