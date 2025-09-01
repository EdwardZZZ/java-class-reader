import { Opcode } from 'java-class-tools';
import { handleError } from './ErrorHandler';
import { ErrorType } from './ErrorHandler';

// 创建基础InstructionMap
export const InstructionMap = new Map();

// 从java-class-tools库加载Opcode
for (const key in Opcode) {
    if (Object.prototype.hasOwnProperty.call(Opcode, key)) {
        InstructionMap.set(Opcode[key], key);
    }
}

// 补充常见的缺失操作码
const AdditionalOpcodes = {
    0x00: 'NOP',
    0x01: 'ACONST_NULL',
    0x02: 'ICONST_M1',
    0x03: 'ICONST_0',
    0x04: 'ICONST_1',
    0x05: 'ICONST_2',
    0x06: 'ICONST_3',
    0x07: 'ICONST_4',
    0x08: 'ICONST_5',
    0x09: 'LCONST_0',
    0x0A: 'LCONST_1',
    0x0B: 'FCONST_0',
    0x0C: 'FCONST_1',
    0x0D: 'FCONST_2',
    0x0E: 'DCONST_0',
    0x0F: 'DCONST_1',
    0x10: 'BIPUSH',
    0x11: 'SIPUSH',
    0x12: 'LDC',
    0x13: 'LDC_W',
    0x14: 'LDC2_W',
    0x15: 'ILOAD',
    0x16: 'LLOAD',
    0x17: 'FLOAD',
    0x18: 'DLOAD',
    0x19: 'ALOAD',
    0x1A: 'ILOAD_0',
    0x1B: 'ILOAD_1',
    0x1C: 'ILOAD_2',
    0x1D: 'ILOAD_3',
    0x1E: 'LLOAD_0',
    0x1F: 'LLOAD_1',
    // 可以根据需要继续添加更多操作码
};

// 将补充的操作码添加到InstructionMap
for (const [code, name] of Object.entries(AdditionalOpcodes)) {
    const opcode = parseInt(code, 16);
    if (!InstructionMap.has(opcode)) {
        InstructionMap.set(opcode, name);
    }
}

// 添加一个安全的获取指令名称的函数
export function getInstructionName(opcode: number): string {
    const name = InstructionMap.get(opcode);
    if (name) {
        return name;
    }
    // 对于未知操作码，可以选择抛出错误或返回UNKNOWN格式
    // 这里我们返回UNKNOWN格式但同时记录警告
    console.warn(`Unknown opcode: 0x${opcode.toString(16).padStart(2, '0')}`);
    return `UNKNOWN_${opcode}`;
}

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

// ACC常量和getACC函数保持不变
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

export function getACC(flag: number): string[] {
    if (ACC[flag]) return [ACC[flag]];

    for (let i = 0; i < ACCKeys.length; i++) {
        const temp: number = +ACCKeys[i];
        if (flag > temp) {
            return [...getACC(flag - temp), ACC[temp]];
        }
    }
}
