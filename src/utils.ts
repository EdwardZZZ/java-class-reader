import { BaseTypeKeys, BaseType } from './Const';

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
