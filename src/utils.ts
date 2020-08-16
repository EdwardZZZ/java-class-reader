import * as fs from 'fs';
import * as path from 'path';
import { getValueFromConstantPool } from './getValueFromConstantPool';

export const isEmpty = ((undef) => (obj: any) => (obj === undef || obj === null))();

export function replaceSlash(str: any) {
    return str.replace(/\//g, '.');
}

export const InstructionMap = new Map();
(() => {
    const txtArr = fs.readFileSync(path.resolve(__dirname, '../ins.txt')).toString().split('\n');
    for (let i = 0; i < txtArr.length; i++) {
        InstructionMap.set(+txtArr[i], txtArr[++i]);
    }
})();

const BaseType = {
    Z: 'boolean',
    B: 'byte',
    C: 'char',
    D: 'double',
    F: 'float',
    I: 'int',
    J: 'long',
    S: 'short',
};
const BaseTypeKeys = Object.keys(BaseType);

const ACC = {
    0x0001: 'public',
    0x0002: 'private',
    0x0004: 'protected',
    0x0008: 'static',
    0x0010: 'final',
    0x0020: 'synchronized',
    0x0040: 'bridge',
    0x0080: 'varargs',
    0x0100: 'native',
    0x0400: 'abstract',
    0x0800: 'strict',
    0x1000: 'synthetic',
    0X2000: 'annotation',
    0X4000: 'enum',
};
const ACCKeys = Object.keys(ACC).reverse();

export function getACC(flag: number) {
    if (ACC[flag]) return [ACC[flag]];

    for (let i = 0; i < ACCKeys.length; i++) {
        const temp: number = +ACCKeys[i];
        if (flag > temp) {
            return [...getACC(flag - temp), ACC[temp]];
        }
    }
}

// TODO split([A-Z])
/* eslint-disable no-use-before-define */
/**
 * 格式化出入参
 * @param {*} str 参数
 * retrun [in, out];
 */
export function formatInOut(str: string) {
    if (isEmpty(str) || str === 'V' || str === '') return null;

    let tempStr = str;
    let tempStrArr = tempStr.split('');

    let startIndex = 0;
    let endIndex = 0;

    const resultArr = [];
    let endTempIndex = 0;
    /* eslint-disable no-constant-condition */
    while (true) {
        endIndex = 1 + tempStrArr.findIndex((s, i) => (/[BCDFIJSZ;]/.test(s) && i >= endTempIndex));
        const sliceStr = tempStr.substr(startIndex, endIndex);
        if ((sliceStr.indexOf(';') > -1 && sliceStr.split('>').length === sliceStr.split('<').length)
            || /^\[?[BCDFIJSZ]$/.test(sliceStr)) {
            resultArr.push(parseType(sliceStr));
            tempStr = tempStr.substr(endIndex);
            tempStrArr = tempStrArr.slice(endIndex);
            startIndex = 0;
            endIndex = 0;
            endTempIndex = 0;
        } else {
            endTempIndex = endIndex;
        }

        if (endIndex >= tempStrArr.length) break;
    }

    return resultArr;
}

// $ inner class
const packageReg = /^([*L[\w/$<>;]+;)$/;
const classReg = /^L([\w/$;]+);$/;
const typeReg = /^([^<>]+)<(.+)>$/;

/**
 * 处理类型 ，例如 'Ljava/util/Map<Ljava/util/Map<Ljava/lang/String;Lcom/bj58/fangchan/fangfe/entity/SimpleEntity;>;Lcom/bj58/fangchan/fangfe/entity/SimpleEntity;>;Ljava/util/Map<Ljava/lang/String;Lcom/bj58/fangchan/fangfe/entity/SimpleEntity;>;'
 * @param {*} name 类型值
 */
export function parseType(name: string) {
    if (isEmpty(name)) return name;
    if (name === 'TT;') return 'java.lang.Object';

    if (BaseTypeKeys.indexOf(name) > -1) {
        return BaseType[name];
    }

    const classResult = name.match(classReg);
    if (classResult) {
        return replaceSlash(classResult[1]);
    }

    if (name.indexOf('[') === 0) {
        return `${parseType(name.slice(1))}[]`;
    }

    const genericReg = /^L([\w/;]+)<(L?[\w/<>$;]+;)+>;$/;
    const genericResult = name.match(genericReg);
    if (genericResult) {
        const [, type1, type2] = genericResult;
        if (type1.slice(-3) === 'Map') {
            const [key, value] = formatInOut(type2);
            return `${replaceSlash(type1)}<${key},${value}>`;
        }
        return `${replaceSlash(type1)}<${parseType(type2)}>`;
    }
}

/**
 * 处理 java 类型名称
 * @param {*} name 名称
 */
export function parseName(name: any) {
    if (isEmpty(name) || !isNaN(name)) return name;

    const inoutReg = /^\(([[\w/<>;]+;?)?\)([[\w|/|<|>|;]+;?)$/;

    const inoutResult = name.match(inoutReg);
    if (inoutResult) {
        const [, instr, outstr] = inoutResult;
        const inArr = formatInOut(instr);
        const outArr = formatInOut(outstr);
        return [inArr, outArr];
    }

    // inner class TODO
    const classResult = name.match(classReg);
    if (classResult) {
        return replaceSlash(classResult[1]);
    }

    const packageResult = name.match(packageReg);
    if (packageResult) {
        return parseType(packageResult[1]);
    }

    const TReg = /^<([\w:;/.]+)>\(([[\w/<>;.]+;?)?\)([[\w|/|<|>|;.]+;?)$/;
    const TResult = name.match(TReg);
    if (TResult) {
        const [, T, inStr, outStr] = TResult;
        const inArr = formatInOut(inStr);
        const [key, value] = T.split(':');
        const outArr = formatInOut(outStr.replace(new RegExp(`${key}${key};`), value));
        return [inArr, outArr];
    }

    const baseReg = /^(\[*[BCDFIJSZ])$/;
    const baseResult = name.match(baseReg);
    if (baseResult) {
        return parseType(baseResult[1]);
    }

    return replaceSlash(name);
}

export function bytesToValue(bytes: Buffer) {
    if (bytes instanceof Array) {
        return Buffer.from(bytes).toString();
    }
    return bytes;
}

export function getAnnotations(constant_pool: any, annotations: any) {
    /**
     * 非流程方法，此方法在类的注解、方法的注解、属性的注解获取中有用到
     * java的class字节码中读取注解名称与值
     */

    const annotationsResult = {};
    annotations.forEach((annotation: any) => {
        const {
            type_index,
            element_value_pairs,
        } = annotation;

        const annotationAttr = {};
        const attributeName = getValueFromConstantPool(constant_pool, type_index);
        if (element_value_pairs !== undefined) {
            element_value_pairs.forEach(({
                element_name_index,
                element_value,
            }) => {
                const name = getValueFromConstantPool(constant_pool, element_name_index);
                const attributeValue = getValueFromConstantPool(constant_pool, element_value.value.const_value_index);
                if (attributeValue === undefined) return;
                annotationAttr[name.name] = attributeValue.name;
            });
        }
        annotationsResult[attributeName.name] = annotationAttr;
    });

    return annotationsResult;
}

/**
 * 格式化出入参
 * @param {*} str 参数
 * retrun [kType, vType];
 */
export function formatKV(str: string) {
    const strArr = str.split(',');
    let kType = null;
    let i = 0;
    while (i < strArr.length) {
        kType = strArr.slice(0, ++i).join('');
        if (kType.split('>').length === kType.split('<').length) {
            break;
        }
    }
    const vType = strArr.slice(i).join(',');

    return [formatType(kType), formatType(vType)];
}

/**
 * 格式化Type
 * @param str 格式
 * return { name, shortName, typeId, childType? }
 */
export const formatType = (str: string) => {
    const newStr: string = str.replace(/(^\s*)|(\s*$)/g, '');

    if (newStr.slice(-2) === '[]') {
        return {
            name: 'java.lang.reflect.Array',
            childType: [parseType(newStr.slice(0, -2))],
        };
    }

    const typeRegResult = str.match(typeReg);
    if (typeRegResult) {
        const [, pType, cType] = typeRegResult;
        if (pType === 'Map') {
            return {
                childType: formatKV(cType),
            };
        }

        return {
            name: pType,
            childType: [parseType(cType)],
        };
    }

    return {
        name: str,
    };
};
