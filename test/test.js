const path = require('path');
const { ReadClass } = require('../dist/index');

const classPath = path.resolve(__dirname, 'FabricMultiTenantConnectionProvider.class');

const result = new ReadClass(classPath).getAllInfo();

console.log(JSON.stringify(result, null, 4));
