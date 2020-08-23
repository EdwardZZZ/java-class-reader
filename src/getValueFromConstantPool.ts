import { isEmpty, parseName } from './utils';
import { bytes2String } from './bytes';

export function getValueFromConstantPool(constant_pool, name_index?: number) {
    if (isEmpty(constant_pool) || isEmpty(name_index)) return {};
    const nameIndex = constant_pool[name_index];
    if (isEmpty(nameIndex) || isEmpty(nameIndex.tag)) return {};

    switch (nameIndex.tag) {
        case 1:
        case 3:
        case 4:
        {
            const value = bytes2String(nameIndex.bytes);
            return {
                name: parseName(value),
            };
        }
        case 5:
        case 6:
        {
            return {
                /* global BigInt */
                name: ((BigInt(nameIndex.high_bytes) << 32n) + BigInt(nameIndex.low_bytes)).toString(),
            };
        }
        case 7:
        case 8:
        {
            const value = constant_pool[nameIndex.name_index | nameIndex.string_index];
            const valueChild = bytes2String(value.bytes);
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
            const clazz = bytes2String(classChildIndex.bytes);

            const nameAndTypeIndex = constant_pool[nameIndex.name_and_type_index];
            const nameAndTypeChildIndex = constant_pool[nameAndTypeIndex.name_index];
            const name = bytes2String(nameAndTypeChildIndex.bytes);
            const descriptorIndex = constant_pool[nameAndTypeIndex.descriptor_index];
            const descriptor = bytes2String(descriptorIndex.bytes);

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
            const name = bytes2String(nameIndex1.bytes);
            const descriptorIndex = constant_pool[descriptor_index];
            const descriptor = bytes2String(descriptorIndex.bytes);

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
            const name = bytes2String(nameAndTypeChildIndex.bytes);

            return {
                name: parseName(name),
            };
        }
        default:
        {
            const value = bytes2String(nameIndex.bytes);
            return {
                name: parseName(value),
            };
        }
    }
}
