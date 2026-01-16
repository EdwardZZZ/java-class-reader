import { ClassParser } from './ClassParser';
import { ClassFile } from './types';

export default class ClassReader {
    private classFile: ClassFile;

    constructor(data: Uint8Array | number[] | Buffer) {
        const parser = new ClassParser(data);
        this.classFile = parser.parse();
    }

    /**
     * Returns the complete parsed class file structure.
     */
    getClassFile(): ClassFile {
        return this.classFile;
    }
}
