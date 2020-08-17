import * as fs from 'fs';
import * as path from 'path';

export const InstructionMap = new Map();
(() => {
    const txtArr = fs.readFileSync(path.resolve(__dirname, '../ins.txt')).toString().split('\n');
    for (let i = 0; i < txtArr.length; i++) {
        InstructionMap.set(+txtArr[i], txtArr[++i]);
    }
})();

export const BaseType = {
    Z: 'boolean',
    B: 'byte',
    C: 'char',
    D: 'double',
    F: 'float',
    I: 'int',
    J: 'long',
    S: 'short',
};
export const BaseTypeKeys = Object.keys(BaseType);

export const ACC = {
    0x0001: 'public',
    0x0002: 'private',
    0x0004: 'protected',
    0x0008: 'static',
    0x0010: 'final',
    0x0020: 'synchronized',
    0x0040: 'bridge',
    0x0080: 'varargs',
    0x0100: 'native',
    0x0400: 'abstract',
    0x0800: 'strict',
    0x1000: 'synthetic',
    0X2000: 'annotation',
    0X4000: 'enum',
};
export const ACCKeys = Object.keys(ACC).reverse();

export function getACC(flag: number) {
    if (ACC[flag]) return [ACC[flag]];

    for (let i = 0; i < ACCKeys.length; i++) {
        const temp: number = +ACCKeys[i];
        if (flag > temp) {
            return [...getACC(flag - temp), ACC[temp]];
        }
    }
}
