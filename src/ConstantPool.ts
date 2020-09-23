import {
    ConstantType,
} from 'java-class-tools';

import { isEmpty, parseName } from './utils';
import { bytes2String } from './bytes';

// java 9
const CONSTANT_Module = 19;
const CONSTANT_Package = 20;

/**
 * get value from constant_pool
 * @param constant_pool <T extends ConstantPoolInfo>[]
 * @param index name index
 */
export function readData(constant_pool: any[], index: number) {
    if (isEmpty(constant_pool) || isEmpty(index)) return {};

    const info = constant_pool[index];
    if (isEmpty(info) || isEmpty(info.tag)) return {};

    switch (info.tag) {
        case ConstantType.UTF8:
        case ConstantType.INTEGER:
        case ConstantType.FLOAT:
        {
            const value = bytes2String(info.bytes);
            return {
                name: parseName(value),
            };
        }
        case ConstantType.LONG:
        case ConstantType.DOUBLE:
        {
            return {
                /* global BigInt */
                name: ((BigInt(info.high_bytes) << 32n) + BigInt(info.low_bytes)).toString(),
            };
        }
        case ConstantType.CLASS:
        case ConstantType.STRING:
        {
            const value = constant_pool[info.name_index | info.string_index];
            const valueChild = bytes2String(value.bytes);
            return {
                name: parseName(valueChild),
            };
        }
        case ConstantType.FIELDREF:
        case ConstantType.METHODREF:
        case ConstantType.INTERFACE_METHODREF:
        {
            const clazzInfo = constant_pool[info.class_index];

            const classInfoNameInfo = constant_pool[clazzInfo.name_index];
            const clazz = bytes2String(classInfoNameInfo.bytes);

            const nameAndTypeInfo = constant_pool[info.name_and_type_index];
            const nameAndTypeNameInfo = constant_pool[nameAndTypeInfo.name_index];
            const name = bytes2String(nameAndTypeNameInfo.bytes);
            const descriptorInfo = constant_pool[nameAndTypeInfo.descriptor_index];
            const descriptor = bytes2String(descriptorInfo.bytes);

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
            } = info;

            const nameInfo = constant_pool[name_index];
            const name = bytes2String(nameInfo.bytes);
            const descriptorInfo = constant_pool[descriptor_index];
            const descriptor = bytes2String(descriptorInfo.bytes);

            return {
                name: parseName(name),
                descriptor: parseName(descriptor),
            };
        }
        case ConstantType.METHOD_HANDLE:
        {
            const { reference_kind: referenceKind, reference_index: referenceIndex } = info;
            return {
                referenceKind,
                referenceIndex,
            };
        }
        case ConstantType.METHOD_TYPE:
        {
            // MethodTypeInfo
            const descriptorInfo = constant_pool[info.descriptor_index];
            const descriptor = bytes2String(descriptorInfo.bytes);

            return {
                descriptor: parseName(descriptor),
            };
        }
        case ConstantType.DYNAMIC:
        {
            return {};
        }
        case ConstantType.INVOKE_DYNAMIC:
        {
            const nameAndTypeInfo = constant_pool[info.name_and_type_index];
            const nameAndTypeName = constant_pool[nameAndTypeInfo.name_index];
            const name = bytes2String(nameAndTypeName.bytes);

            return {
                name: parseName(name),
            };
        }
        case CONSTANT_Module:
        {
            return {};
        }
        case CONSTANT_Package:
        {
            return {};
        }
        default:
        {
            const value = bytes2String(info.bytes);
            return {
                name: parseName(value),
            };
        }
    }
}
