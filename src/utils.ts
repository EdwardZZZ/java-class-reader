import { BaseTypeKeys, BaseType } from './Const';
import { readData } from './ConstantPool';

export const type = (obj: any): string => Object.prototype.toString.call(obj).slice(8, -1);

export const isEmpty = ((undef) => (obj: any) => (obj === undef || obj === null))();

export const isString = (obj: any): obj is string => type(obj) === 'String';

export const replaceSlash = (str: string) => str.replace(/\//g, '.');

export const mixinArr = (arr1: string[], arr2: string[]) => {
    arr2.forEach((str) => {
        if (!arr1.includes(str)) {
            arr1.push(str);
        }
    });
};

/**
 * 从指定位置解析类型描述符
 * @param str 类型描述符字符串
 * @param start 起始位置
 * @returns [解析后的类型, 解析的长度]
 */
function parseTypeAt(str: string, start: number): [string, number] {
    const char = str[start];

    // 基本类型
    if (BaseTypeKeys.includes(char)) {
        return [BaseType[char], 1];
    }

    // 数组类型
    if (char === '[') {
        const [elementType, length] = parseTypeAt(str, start + 1);
        return [`${elementType}[]`, length + 1];
    }

    // 引用类型 (修复泛型解析问题)
    if (char === 'L') {
        let end = start;
        let bracketDepth = 0; // 跟踪泛型尖括号嵌套深度

        // 查找匹配的结束分号，考虑泛型嵌套
        while (end < str.length) {
            if (str[end] === '<') bracketDepth++;
            if (str[end] === '>') bracketDepth--;
            if (str[end] === ';' && bracketDepth === 0) break;
            end++;
        }

        if (end === str.length) {
            throw new Error(`Invalid reference type descriptor: ${str.substring(start)}`);
        }

        const className = str.substring(start + 1, end);
        const readableName = replaceSlash(className).replace(/\$/g, '.');
        return [readableName, end - start + 1];
    }

    throw new Error(`Unknown type descriptor: ${char} at position ${start}`);
}

/**
 * 解析方法参数列表
 * @param paramPart 参数部分字符串
 * @returns 参数类型数组
 */
function parseMethodParameters(paramPart: string): string[] {
    const params: string[] = [];
    let i = 0;
    while (i < paramPart.length) {
        const [type, length] = parseTypeAt(paramPart, i);
        params.push(type);
        i += length;
    }
    return params;
}

/**
 * 解析类型描述符
 * @param descriptor 类型描述符
 * @returns 解析后的可读类型名称
 */
function parseTypeDescriptor(descriptor: string): string {
    // 特殊情况: void 类型
    if (descriptor === 'V') return 'void';

    // 处理基本类型
    if (BaseTypeKeys.includes(descriptor)) {
        return BaseType[descriptor];
    }

    // 处理数组类型
    if (descriptor.startsWith('[')) {
        const elementType = parseTypeDescriptor(descriptor.substring(1));
        return `${elementType}[]`;
    }

    // 处理引用类型
    if (descriptor.startsWith('L') && descriptor.endsWith(';')) {
        const className = descriptor.substring(1, descriptor.length - 1);
        // 处理内部类
        return replaceSlash(className).replace(/\$/g, '.');
    }

    // 处理泛型参数引用，如 TT;
    if (descriptor.startsWith('T') && descriptor.endsWith(';')) {
        return descriptor.substring(1, descriptor.length - 1);
    }

    return replaceSlash(descriptor);
}

/**
 * 解析泛型参数定义
 * @param paramDef 泛型参数定义
 * @returns 解析后的泛型参数
 */
function parseGenericParameter(paramDef: string): string {
    // 例如 T:Ljava/lang/Object;
    const parts = paramDef.split(':');
    if (parts.length === 2) {
        const [name, bound] = parts;
        const boundType = parseTypeDescriptor(bound);
        return `${name} extends ${boundType}`;
    }
    return paramDef;
}

/**
 * 处理 java 类型名称，根据 Java 字节码规范解析类型描述符
 * @param {*} name 类型描述符
 * @returns 解析后的可读类型名称
 */
export function parseName(name: string): any {
    try {
        if (isEmpty(name)) return name;

        // 处理方法签名: (参数类型列表)返回值类型
        const methodSignatureMatch = name.match(/^\((.*)\)(.*)$/);
        if (methodSignatureMatch) {
            const [, paramPart, returnPart] = methodSignatureMatch;
            const params = paramPart ? parseMethodParameters(paramPart) : [];
            const returnType = parseTypeDescriptor(returnPart);
            return [params, returnType];
        }

        // 处理泛型类型参数声明，如 <T:Ljava/lang/Object;>
        const genericParamMatch = name.match(/^<([\w:;/.]+)>$/);
        if (genericParamMatch) {
            const [, paramDef] = genericParamMatch;
            return parseGenericParameter(paramDef);
        }

        // 处理普通类型描述符
        return parseTypeDescriptor(name);
    } catch (e) {
        return name;
    }
}

/**
 * 解析方法参数注解
 * @param constant_pool 常量池
 * @param parameter_annotations 参数注解数据
 * @returns 解析后的参数注解数组，每个元素对应一个参数的注解集合
 */
export function getParameterAnnotations(constant_pool: any[], parameter_annotations: any[]): any[] {
    if (!parameter_annotations || parameter_annotations.length === 0) return [];

    return parameter_annotations.map((paramAnnos: any) => {
        const annotations: any = {};
        paramAnnos.forEach((anno: any) => {
            const typeName = readData(constant_pool, anno.type_index).name;
            const annoInfo: any = {};

            if (anno.element_value_pairs) {
                anno.element_value_pairs.forEach((pair: any) => {
                    const elemName = readData(constant_pool, pair.element_name_index).name;
                    const elemValue = pair.value;
                    annoInfo[elemName] = elemValue.value;
                });
            }

            annotations[replaceSlash(typeName)] = annoInfo;
        });
        return annotations;
    });
}

/**
 * 验证类型描述符是否有效
 * @param typeName 类型名称
 * @returns 类型是否有效的布尔值
 */
export function isValidType(typeName: string): boolean {
    if (!typeName) return false;

    // 基本类型验证
    const baseTypes = ['void', 'boolean', 'byte', 'char', 'short', 'int', 'long', 'float', 'double'];
    if (baseTypes.includes(typeName)) return true;

    // 数组类型验证 (以[]结尾且元素类型有效)
    if (typeName.endsWith('[]')) {
        return isValidType(typeName.slice(0, -2));
    }

    // 引用类型验证 (包含包名且符合Java类名规范)
    return /^[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)*$/.test(typeName);
}

/**
 * 解析栈映射表中的类型信息
 * @param types 栈映射类型数组
 * @param constant_pool 常量池
 * @returns 解析后的可读类型数组
 */
export function parseStackMapTypes(types: any[], constant_pool: any[]): string[] {
    if (!types || types.length === 0) return [];

    const typeMap: Record<number, string> = {
        0: 'top',          // 0: 未使用的变量槽
        1: 'int',          // 1: int类型
        2: 'float',        // 2: float类型
        3: 'double',       // 3: double类型
        4: 'long',         // 4: long类型
        5: 'null',         // 5: null类型
        6: 'uninitialized_this' // 6: 未初始化的this
    };

    return types.map((typeInfo: any) => {
        if (typeof typeInfo === 'number') {
            return typeMap[typeInfo] || `unknown_${typeInfo}`;
        }

        // 引用类型 (CONSTANT_Class_info索引)
        if (typeInfo.class_info_index) {
            return replaceSlash(readData(constant_pool, typeInfo.class_info_index).name);
        }

        // 未初始化的对象引用
        if (typeInfo.offset) {
            return `uninitialized@${typeInfo.offset}`;
        }

        return 'unknown_type';
    });
}
