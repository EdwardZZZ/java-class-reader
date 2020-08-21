import { isEmpty, bytesToValue, parseName } from './utils';

// enum ConstantType {
//     UTF8 = 1,
//     INTEGER = 3,
//     FLOAT = 4,
//     LONG = 5,
//     DOUBLE = 6,
//     CLASS = 7,
//     STRING = 8,
//     FIELDREF = 9,
//     METHODREF = 10,
//     INTERFACE_METHODREF = 11,
//     NAME_AND_TYPE = 12,
//     METHOD_HANDLE = 15,
//     METHOD_TYPE = 16,
//     INVOKE_DYNAMIC = 18
// }
export function getValueFromConstantPool(constant_pool, name_index?: number) {
    if (isEmpty(constant_pool) || isEmpty(name_index)) return {};
    const nameIndex = constant_pool[name_index];
    if (isEmpty(nameIndex) || isEmpty(nameIndex.tag)) return {};

    switch (nameIndex.tag) {
        case 1:
        case 3:
        case 4:
        {
            const value = bytesToValue(nameIndex.bytes);
            return {
                name: parseName(value),
            };
        }
        case 5:
        case 6:
        {
            const buff = Buffer.alloc(8);
            buff.writeInt32BE(nameIndex.high_bytes);
            buff.writeInt32BE(nameIndex.low_bytes, 4);
            return {
                name: buff.readBigInt64BE(),
            };
        }
        case 7:
        case 8:
        {
            const value = constant_pool[nameIndex.name_index | nameIndex.string_index];
            const valueChild = bytesToValue(value.bytes);
            return {
                name: parseName(valueChild),
            };
        }
        case 9:
        case 10:
        case 11:
        {
            const classIndex = constant_pool[nameIndex.class_index];

            const classChildIndex = constant_pool[classIndex.name_index];
            const clazz = bytesToValue(classChildIndex.bytes);

            const nameAndTypeIndex = constant_pool[nameIndex.name_and_type_index];
            const nameAndTypeChildIndex = constant_pool[nameAndTypeIndex.name_index];
            const name = bytesToValue(nameAndTypeChildIndex.bytes);
            const descriptorIndex = constant_pool[nameAndTypeIndex.descriptor_index];
            const descriptor = bytesToValue(descriptorIndex.bytes);

            return {
                class: parseName(clazz),
                name: parseName(name),
                descriptor: parseName(descriptor),
            };
        }
        case 12:
        {
            const {
                descriptor_index,
                name_index,
            } = nameIndex;

            const nameIndex1 = constant_pool[name_index];
            const name = bytesToValue(nameIndex1.bytes);
            const descriptorIndex = constant_pool[descriptor_index];
            const descriptor = bytesToValue(descriptorIndex.bytes);

            return {
                name: parseName(name),
                descriptor: parseName(descriptor),
            };
        }
        case 15:
        {
            return {};
        }
        case 16:
        {
            return {};
        }
        case 18:
        {
            const nameAndTypeIndex = constant_pool[nameIndex.name_and_type_index];
            const nameAndTypeChildIndex = constant_pool[nameAndTypeIndex.name_index];
            const name = bytesToValue(nameAndTypeChildIndex.bytes);

            return {
                name: parseName(name),
            };
        }
        default:
        {
            const value = bytesToValue(nameIndex.bytes);
            return {
                name: parseName(value),
            };
        }
    }
}
