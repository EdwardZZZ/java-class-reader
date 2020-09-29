# java-class-reader
Read and write java class files in node or browser base on java-class-tools

[java-class-tools](https://github.com/leonardosnt/java-class-tools)

### usage
#### code
```js
const { ClassReader } = require('java-class-reader');

const classPath = path.resolve(__dirname, './Foo.class');

const result = new ClassReader(classPath).getAllInfo();

console.log(JSON.stringify(result, null, 4));
```
#### type
```js
export default class ClassReader {
    constructor(data: Uint8Array | Buffer | number[] | string);

    getAllInfo({ showCode }?: any): {
        package: string;
        dependClass: string[];
        fullyQualifiedName: string;
        superClass: string;
        interfaceName: string[];
        classInfo: TStringKey;
        methodsInfo: any[];
        fieldsInfo: any[];
        enumFieldsInfo: any[];
        enumInfos: TStringKey[];
    };
    getInterfaceName(): string[];
    getFullyQualifiedName(): string;
    getSuperClass(): string;
    getDependClass(): string[];
    getClassInfo(): TStringKey;
    getMethodsInfo({ showCode, }?: {
        showCode?: boolean;
    }): any[];
    getFieldsInfo(): {
        fieldsInfo: any[];
        enumFieldsInfo: any[];
    };
}
```
