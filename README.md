# java-class-reader
Read and write java class files in node or browser base on java-class-tools

[java-class-tools](https://github.com/leonardosnt/java-class-tools)

### Usage

#### Code

```javascript
const fs = require('fs');
const path = require('path');
const { ClassReader } = require('java-class-reader');

const classPath = path.resolve(__dirname, './Foo.class');
const buffer = fs.readFileSync(classPath);

// Create a new ClassReader with the binary data (Buffer, Uint8Array, or number[])
const reader = new ClassReader(buffer);

// Get the parsed ClassFile object
const result = reader.getClassFile();

console.log(JSON.stringify(result, null, 4));
```

#### API

```typescript
export default class ClassReader {
    /**
     * Create a new ClassReader instance.
     * @param data The binary data of the class file (Buffer, Uint8Array, or number[])
     */
    constructor(data: Uint8Array | number[] | Buffer);

    /**
     * Returns the complete parsed class file structure.
     * This includes resolved constant pool entries, fields, methods, attributes, etc.
     */
    getClassFile(): Omit<ClassFile, 'constant_pool' | 'constant_pool_count'>;
}
```

#### Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build project
npm run build
```
