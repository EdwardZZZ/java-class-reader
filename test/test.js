const path = require('path');
const { ClassReader } = require('../dist/index');

const classPath = path.resolve(__dirname, 'Out.class');

const result = new ClassReader(classPath).getFieldsInfo();

console.log(JSON.stringify(result, null, 4));
