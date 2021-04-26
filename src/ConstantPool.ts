import {
    ConstantPoolInfo, ClassInfo, FieldRefInfo, MethodRefInfo, InterfaceMethodRefInfo,
    StringInfo, IntegerInfo, FloatInfo, LongInfo, DoubleInfo, NameAndTypeInfo, Utf8Info,
    MethodHandleInfo, MethodTypeInfo, InvokeDynamicInfo,
    ConstantType, Annotation,
} from 'java-class-tools';

import { isEmpty, parseName } from './utils';
import { bytes2String } from './bytes';

// java 9
const CONSTANT_Module = 19;
const CONSTANT_Package = 20;

type TConstantPoolInfo = ConstantPoolInfo & ClassInfo & FieldRefInfo & MethodRefInfo &
    InterfaceMethodRefInfo & StringInfo & IntegerInfo & FloatInfo & LongInfo & DoubleInfo &
    NameAndTypeInfo & Utf8Info & MethodHandleInfo & MethodTypeInfo & InvokeDynamicInfo;

/**
 * get value from constant_pool
 * @param constant_pool <T extends ConstantPoolInfo>[]
 * @param index name index
 */
export function readData(constant_pool: ConstantPoolInfo[], index: number): {
    name?: any,
    class?: string,
    descriptor?: string,
    referenceKind?: number,
    referenceIndex?: number,
} {
    if (isEmpty(constant_pool) || isEmpty(index)) return {};

    const pool = constant_pool as TConstantPoolInfo[];
    const info = pool[index];
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
            const value = pool[info.name_index | info.string_index];
            const valueChild = bytes2String(value.bytes);
            return {
                // TODO name: valueChild,
                name: parseName(valueChild),
            };
        }
        case ConstantType.FIELDREF:
        case ConstantType.METHODREF:
        case ConstantType.INTERFACE_METHODREF:
        {
            const clazzInfo = pool[info.class_index];

            const classInfoNameInfo = pool[clazzInfo.name_index];
            const clazz = bytes2String(classInfoNameInfo.bytes);

            const nameAndTypeInfo = pool[info.name_and_type_index];
            const nameAndTypeNameInfo = pool[nameAndTypeInfo.name_index];
            const name = bytes2String(nameAndTypeNameInfo.bytes);
            const descriptorInfo = pool[nameAndTypeInfo.descriptor_index];
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

            const nameInfo = pool[name_index];
            const name = bytes2String(nameInfo.bytes);
            const descriptorInfo = pool[descriptor_index];
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
            const descriptorInfo = pool[info.descriptor_index];
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
            const nameAndTypeInfo = pool[info.name_and_type_index];
            const nameAndTypeName = pool[nameAndTypeInfo.name_index];
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

/**
 * get annotation
 * @param constant_pool ConstantPoolInfo[]
 * @param annotations Annotation[]
 */
export function getAnnotations(constant_pool: ConstantPoolInfo[], annotations: Annotation[]) {
    const annotationsResult = {};
    annotations.forEach(({ type_index, element_value_pairs }: Annotation) => {
        const annotationAttr = {};
        const attributeName = readData(constant_pool, type_index);

        if (element_value_pairs !== undefined) {
            element_value_pairs.forEach(({ element_name_index, element_value }: any) => {
                const name = readData(constant_pool, element_name_index);
                const attributeValue = readData(constant_pool, element_value.value.const_value_index);
                if (attributeValue === undefined) return;
                annotationAttr[name.name] = attributeValue.name;
            });
        }

        annotationsResult[attributeName.name] = annotationAttr;
    });

    return annotationsResult;
}
