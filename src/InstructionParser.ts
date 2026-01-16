import { Opcode, OpcodeOperandCount, OpcodeMnemonics } from './Opcodes';

export interface Instruction {
    opcode: number;
    mnemonic: string;
    operands: number[];
    bytecodeOffset: number;
}

export class InstructionParser {
    static fromBytecode(bytecode: number[] | Uint8Array): Instruction[] {
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

            instructions.push({
                opcode,
                mnemonic: OpcodeMnemonics[opcode] || `unknown_${opcode}`,
                operands,
                bytecodeOffset,
            });

            offset += numOperandBytes;
        }

        return instructions;
    }
}
