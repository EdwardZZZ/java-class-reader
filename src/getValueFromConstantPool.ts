import {
    ConstantType,
} from 'java-class-tools';

import { isEmpty, parseName } from './utils';
import { bytes2String } from './bytes';

/**
 * get value from constant_pool
 * @param constant_pool <T extends ConstantPoolInfo>[]
 * @param index name index
 */
export function getValueFromConstantPool(constant_pool: any[], name_index?: number) {
    if (isEmpty(constant_pool) || isEmpty(name_index)) return {};
    const nameIndex = constant_pool[name_index];
    if (isEmpty(nameIndex) || isEmpty(nameIndex.tag)) return {};

    switch (nameIndex.tag) {
        case ConstantType.UTF8:
        case ConstantType.INTEGER:
        case ConstantType.FLOAT:
        {
            const value = bytes2String(nameIndex.bytes);
            return {
                name: parseName(value),
            };
        }
        case ConstantType.LONG:
        case ConstantType.DOUBLE:
        {
            return {
                /* global BigInt */
                name: ((BigInt(nameIndex.high_bytes) << 32n) + BigInt(nameIndex.low_bytes)).toString(),
            };
        }
        case ConstantType.CLASS:
        case ConstantType.STRING:
        {
            const value = constant_pool[nameIndex.name_index | nameIndex.string_index];
            const valueChild = bytes2String(value.bytes);
            return {
                name: parseName(valueChild),
            };
        }
        case ConstantType.FIELDREF:
        case ConstantType.METHODREF:
        case ConstantType.INTERFACE_METHODREF:
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
        case ConstantType.NAME_AND_TYPE:
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
        case ConstantType.METHOD_HANDLE:
        {
            return {};
        }
        case ConstantType.METHOD_TYPE:
        {
            return {};
        }
        case ConstantType.DYNAMIC:
        {
            return {};
        }
        case ConstantType.INVOKE_DYNAMIC:
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
