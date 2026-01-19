import { Opcode, OpcodeOperandCount, OpcodeMnemonics } from './Opcodes';
import { readData } from './ConstantPoolParser';
import { ConstantPoolInfo } from './types';

export interface Instruction {
    opcode: number;
    mnemonic: string;
    operands: number[];
    bytecodeOffset: number;
    operandsResolved?: any[];
}

export class InstructionParser {
    static fromBytecode(bytecode: number[] | Uint8Array, constantPool?: ConstantPoolInfo[]): Instruction[] {
        const instructions: Instruction[] = [];
        let offset = 0;

        while (offset < bytecode.length) {
            const bytecodeOffset = offset;
            const opcode = bytecode[offset++];
            let numOperandBytes = 0;

            if (opcode === Opcode.TABLESWITCH) {
                const padding = offset % 4 ? 4 - offset % 4 : 0;
                // Don't advance offset yet, just calculate bytes needed
                // But we need to read values which are at offset + padding

                // Read high and low to calculate length
                const base = offset + padding;
                // default (4) + low (4) + high (4)
                const low = (bytecode[base + 4] << 24) | (bytecode[base + 5] << 16) | (bytecode[base + 6] << 8) | bytecode[base + 7];
                const high = (bytecode[base + 8] << 24) | (bytecode[base + 9] << 16) | (bytecode[base + 10] << 8) | bytecode[base + 11];
                const numJumpOffsets = high - low + 1;

                numOperandBytes = padding + 12 + numJumpOffsets * 4;
            } else if (opcode === Opcode.LOOKUPSWITCH) {
                const padding = offset % 4 ? 4 - offset % 4 : 0;
                const base = offset + padding;
                // default (4) + npairs (4)
                const npairs = (bytecode[base + 4] << 24) | (bytecode[base + 5] << 16) | (bytecode[base + 6] << 8) | bytecode[base + 7];

                numOperandBytes = padding + 8 + npairs * 8;
            } else if (opcode === Opcode.WIDE) {
                // WIDE is special
                const subOpcode = bytecode[offset];
                if (subOpcode === Opcode.IINC) {
                    numOperandBytes = 5; // opcode(1) + index(2) + const(2)
                } else {
                    numOperandBytes = 3; // opcode(1) + index(2)
                }
            } else {
                numOperandBytes = OpcodeOperandCount[opcode];
                if (numOperandBytes === undefined) {
                    throw new Error(`Unexpected opcode: ${opcode} at offset ${bytecodeOffset}`);
                }
                // Handle -1 for variable length if any other than switch (should not happen with standard opcodes)
                if (numOperandBytes === -1) {
                    throw new Error(`Variable length instruction not handled: ${opcode} at offset ${bytecodeOffset}`);
                }
            }

            const operands: number[] = [];
            for (let i = 0; i < numOperandBytes; i++) {
                operands.push(bytecode[offset + i]);
            }

            const instruction: Instruction = {
                opcode,
                mnemonic: OpcodeMnemonics[opcode] || `unknown_${opcode}`,
                operands,
                bytecodeOffset,
            };

            if (constantPool) {
                const resolved = InstructionParser.resolveOperands(opcode, operands, constantPool);
                if (resolved) {
                    instruction.operandsResolved = resolved;
                }
            }

            instructions.push(instruction);

            offset += numOperandBytes;
        }

        return instructions;
    }

    private static resolveOperands(opcode: number, operands: number[], constantPool: ConstantPoolInfo[]): any[] | null {
        // Handle instructions that use constant pool indices
        // 1-byte index: ldc
        if (opcode === Opcode.LDC) {
            const index = operands[0];
            return [readData(constantPool, index)];
        }

        // 2-byte index: ldc_w, ldc2_w, getstatic, putstatic, getfield, putfield,
        // invokevirtual, invokespecial, invokestatic, invokeinterface, new, anewarray, checkcast, instanceof
        if ([
            Opcode.LDC_W, Opcode.LDC2_W,
            Opcode.GETSTATIC, Opcode.PUTSTATIC, Opcode.GETFIELD, Opcode.PUTFIELD,
            Opcode.INVOKEVIRTUAL, Opcode.INVOKESPECIAL, Opcode.INVOKESTATIC, Opcode.INVOKEINTERFACE,
            Opcode.NEW, Opcode.ANEWARRAY, Opcode.CHECKCAST, Opcode.INSTANCEOF,
        ].includes(opcode)) {
            if (operands.length >= 2) {
                const index = (operands[0] << 8) | operands[1];
                return [readData(constantPool, index)];
            }
        }

        // invokedynamic: index (2 bytes) + 0 + 0
        if (opcode === Opcode.INVOKEDYNAMIC) {
            if (operands.length >= 2) {
                const index = (operands[0] << 8) | operands[1];
                return [readData(constantPool, index)];
            }
        }

        return null;
    }
}
