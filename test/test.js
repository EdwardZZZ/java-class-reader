const path = require('path');
const { ClassReader } = require('../dist/index');

const classPath = path.resolve(__dirname, 'FabricMultiTenantConnectionProvider.class');

const result = new ClassReader(classPath).getAllInfo();

console.log(JSON.stringify(result, null, 4));
