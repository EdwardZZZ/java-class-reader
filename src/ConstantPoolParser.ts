import { BufferReader } from './BufferReader';
import { ConstantPoolInfo, ConstantType } from './types';
import { bytes2String } from './bytes';
import { parseName } from './utils';

// Declare readData function first or move it up, but it depends on types which is fine.
// Since readData uses constant_pool (array) and index, it is stateless regarding the parser logic.
// However, parseConstantPool uses readData which is defined below it.
// To fix no-use-before-define, we can define readData first or use function hoisting (which works but linter complains).
// Best way: Export readData and keep it separate, or ignore the rule for these mutually recursive-like dependency (data dependency).
// Let's move readData up.

export function readData(constant_pool: ConstantPoolInfo[], index: number): any {
    if (!constant_pool || !index || index >= constant_pool.length) return {};

    const info = constant_pool[index];
    if (!info) return {};

    switch (info.tag) {
        case ConstantType.UTF8:
            return { name: parseName(info.value) };
        case ConstantType.INTEGER:
        case ConstantType.FLOAT:
            return { name: info.value.toString() };
        case ConstantType.LONG:
        case ConstantType.DOUBLE:
            // Convert BigInt to string explicitly if needed, though toString handles it.
            // But for JSON.stringify, we need to ensure the value in the object is a string if it was BigInt.
            // Here we return { name: ... } which is a string.
            return { name: info.value.toString() };
        case ConstantType.CLASS:
        case ConstantType.STRING:
            if (info.name) return { name: info.name };
            if (info.string_value) return { name: info.string_value };

            // eslint-disable-next-line no-case-declarations
            const val = constant_pool[info.name_index || info.string_index];
            if (val && val.value) {
                return { name: parseName(val.value) };
            }
            return {};
        case ConstantType.FIELDREF:
        case ConstantType.METHODREF:
        case ConstantType.INTERFACE_METHODREF:
            if (info.class_name && info.name && info.descriptor) {
                return {
                    class: info.class_name,
                    name: info.name,
                    descriptor: info.descriptor,
                };
            }

            // eslint-disable-next-line no-case-declarations
            const classInfo = constant_pool[info.class_index];
            // eslint-disable-next-line no-case-declarations
            const classNameInfo = constant_pool[classInfo.name_index];

            // eslint-disable-next-line no-case-declarations
            const nameAndType = constant_pool[info.name_and_type_index];
            // eslint-disable-next-line no-case-declarations
            const nameInfo = constant_pool[nameAndType.name_index];
            // eslint-disable-next-line no-case-declarations
            const typeInfo = constant_pool[nameAndType.descriptor_index];

            return {
                class: parseName(classNameInfo.value),
                name: parseName(nameInfo.value),
                descriptor: parseName(typeInfo.value),
            };
        case ConstantType.NAME_AND_TYPE:
            if (info.name && info.descriptor) {
                return {
                    name: info.name,
                    descriptor: info.descriptor,
                };
            }

            // eslint-disable-next-line no-case-declarations
            const nInfo = constant_pool[info.name_index];
            // eslint-disable-next-line no-case-declarations
            const dInfo = constant_pool[info.descriptor_index];
            return {
                name: parseName(nInfo.value),
                descriptor: parseName(dInfo.value),
            };
        default:
            if (info.value) return { name: parseName(info.value) };
            return {};
    }
}

export function parseConstantPool(reader: BufferReader, count: number): ConstantPoolInfo[] {
    const pool: ConstantPoolInfo[] = [];
    pool.push({ tag: 0 }); // Index 0 is unused

    // 1. First pass: Parse raw data
    for (let i = 1; i < count; i++) {
        const tag = reader.readU1();
        const info: ConstantPoolInfo = { tag };

        switch (tag) {
            case ConstantType.UTF8: {
                const len = reader.readU2();
                const bytes = reader.readBytes(len);
                // info.bytes = bytes; // Raw bytes removed
                info.value = bytes2String(Array.from(bytes));
                break;
            }
            case ConstantType.INTEGER: {
                let val = reader.readU4();
                if (val > 0x7FFFFFFF) val -= 0x100000000;
                info.value = val;
                break;
            }
            case ConstantType.FLOAT: {
                info.value = reader.readFloat();
                break;
            }
            case ConstantType.LONG: {
                const bigIntVal = reader.readLong();
                // Convert BigInt to string immediately to avoid JSON serialization issues later
                info.value = bigIntVal.toString();
                pool.push(info);
                pool.push({ tag: 0 }); // Padding for 2nd slot
                i++;
                continue;
            }
            case ConstantType.DOUBLE: {
                info.value = reader.readDouble();
                pool.push(info);
                pool.push({ tag: 0 }); // Padding for 2nd slot
                i++;
                continue;
            }
            case ConstantType.CLASS: {
                info.name_index = reader.readU2();
                break;
            }
            case ConstantType.STRING: {
                info.string_index = reader.readU2();
                break;
            }
            case ConstantType.FIELDREF:
            case ConstantType.METHODREF:
            case ConstantType.INTERFACE_METHODREF: {
                info.class_index = reader.readU2();
                info.name_and_type_index = reader.readU2();
                break;
            }
            case ConstantType.NAME_AND_TYPE: {
                info.name_index = reader.readU2();
                info.descriptor_index = reader.readU2();
                break;
            }
            case ConstantType.METHOD_HANDLE: {
                info.reference_kind = reader.readU1();
                info.reference_index = reader.readU2();
                break;
            }
            case ConstantType.METHOD_TYPE: {
                info.descriptor_index = reader.readU2();
                break;
            }
            case ConstantType.DYNAMIC:
            case ConstantType.INVOKE_DYNAMIC: {
                info.bootstrap_method_attr_index = reader.readU2();
                info.name_and_type_index = reader.readU2();
                break;
            }
            case ConstantType.MODULE: {
                info.name_index = reader.readU2();
                break;
            }
            case ConstantType.PACKAGE: {
                info.name_index = reader.readU2();
                break;
            }
            default:
                throw new Error(`Unknown constant tag: ${tag} at offset ${reader.getOffset() - 1}`);
        }
        pool.push(info);
    }

    // 2. Second pass: Resolve internal indices
    for (let i = 1; i < pool.length; i++) {
        const info = pool[i];
        if (!info || info.tag === 0) continue;

        switch (info.tag) {
            case ConstantType.CLASS:
            case ConstantType.MODULE:
            case ConstantType.PACKAGE:
                if (info.name_index) {
                    info.name = readData(pool, info.name_index).name;
                    delete info.name_index; // Cleanup
                }
                break;
            case ConstantType.STRING:
                if (info.string_index) {
                    info.string_value = readData(pool, info.string_index).name;
                    delete info.string_index; // Cleanup
                }
                break;
            case ConstantType.NAME_AND_TYPE:
                if (info.name_index) {
                    info.name = readData(pool, info.name_index).name;
                    delete info.name_index; // Cleanup
                }
                if (info.descriptor_index) {
                    info.descriptor = readData(pool, info.descriptor_index).name;
                    delete info.descriptor_index; // Cleanup
                }
                break;
            case ConstantType.FIELDREF:
            case ConstantType.METHODREF:
            case ConstantType.INTERFACE_METHODREF:
                if (info.class_index) {
                    info.class_name = readData(pool, info.class_index).name;
                    delete info.class_index; // Cleanup
                }
                if (info.name_and_type_index) {
                    const nat = readData(pool, info.name_and_type_index);
                    info.name = nat.name;
                    info.descriptor = nat.descriptor;
                    delete info.name_and_type_index; // Cleanup
                }
                break;
            case ConstantType.METHOD_TYPE:
                if (info.descriptor_index) {
                    info.descriptor = readData(pool, info.descriptor_index).name;
                    delete info.descriptor_index; // Cleanup
                }
                break;
            case ConstantType.DYNAMIC:
            case ConstantType.INVOKE_DYNAMIC:
                if (info.name_and_type_index) {
                    const nat = readData(pool, info.name_and_type_index);
                    info.name = nat.name;
                    info.descriptor = nat.descriptor;
                    delete info.name_and_type_index; // Cleanup
                }
                break;
            default:
                // No additional resolution needed for other types
                break;
        }
    }

    return pool;
}
