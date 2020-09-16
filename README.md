# java-class-reader
Read and write java class files in node or browser base on java-class-tools
[java-class-tools](https://github.com/leonardosnt/java-class-tools)


### usage
```js
const { Reader } = require('java-class-reader');

const classPath = path.resolve(__dirname, './Foo.class');

const result = new Reader(classPath).getAllInfo();

console.log(JSON.stringify(result, null, 4));
```

