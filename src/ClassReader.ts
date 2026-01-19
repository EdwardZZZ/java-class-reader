import { ClassParser } from './ClassParser';
import { ClassFile } from './types';

export default class ClassReader {
    private classFile: ClassFile;

    constructor(data: Uint8Array | number[] | Buffer) {
        const parser = new ClassParser(data);
        this.classFile = parser.parse();
    }

    /**
     * Returns the parsed class file structure.
     * @param env 'prod' or 'dev'. If 'prod', excludes constant_pool, constant_pool_count, attributes_count, attributes.
     */
    getClassFile(env: 'prod' | 'dev' = 'dev'): Partial<ClassFile> {
        if (env === 'prod') {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { constant_pool, constant_pool_count, attributes_count, attributes, fields, methods, ...rest } = this.classFile;

            const prodFields = fields.map((field) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { attributes_count: _, attributes: __, ...fieldRest } = field;
                return fieldRest;
            });

            const prodMethods = methods.map((method) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { attributes_count: _, attributes: __, ...methodRest } = method;
                return methodRest;
            });

            return {
                ...rest,
                fields: prodFields as any,
                methods: prodMethods as any,
            };
        }
        return this.classFile;
    }
}
