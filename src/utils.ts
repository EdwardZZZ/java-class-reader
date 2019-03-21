import * as fs from 'fs';
import * as path from 'path';
import { getValueFromConstantPool } from './getValueFromConstantPool';

export const isEmpty = (undef => (obj: any) => (obj === undef || obj === null))();

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
    0x0001: 'ACC_PUBLIC',
    0x0002: 'ACC_PRIVATE',
    0x0004: 'ACC_PROTECTED',
    0x0008: 'ACC_STATIC',
    0x0010: 'ACC_FINAL',
    0x0020: 'ACC_SYNCHRONIZED',
    0x0040: 'ACC_BRIDGE',
    0x0080: 'ACC_VARARGS',
    0x0100: 'ACC_NATIVE',
    0x0400: 'ACC_ABSTRACT',
    0x0800: 'ACC_STRICT',
    0x1000: 'ACC_SYNTHETIC',
};
const ACCKeys = Object.keys(ACC).reverse();

export function getACC(flag) {
    if (ACC[flag]) return [ACC[flag]];

    for (let i = 0; i < ACCKeys.length; i++) {
        const temp: number = +ACCKeys[i];
        if (flag > temp) {
            return [...getACC(flag - temp), ACC[temp]];
        }
    }
}

/* eslint-disable no-use-before-define */
/**
 * 格式化出入参
 * @param {*} str 参数
 * retrun [in, out];
 */
export function formatInOut(str: string) {
    if (isEmpty(str) || str === 'V' || str === '') return null;
    if (str.indexOf(';') === -1) return [parseType(str)];

    let tempStr = str;
    let tempStrArr = tempStr.split('');

    let startIndex = 0;
    let endIndex = 0;

    const resultArr = [];
    let endTempIndex = 0;
    /* eslint-disable no-constant-condition */
    while (true) {
        if (/[BCDFIJSZ]/.test(tempStrArr[0])) {
            resultArr.push(parseType(tempStrArr[0]));
            tempStr = tempStr.substr(1);
            tempStrArr = tempStrArr.slice(1);
            startIndex = 0;
            endIndex = 0;
            endTempIndex = 0;
        } else {
            endIndex = 1 + tempStrArr.findIndex((s, i) => (s === ';' && i > endTempIndex));
            const sliceStr = tempStr.substr(startIndex, endIndex);
            if (sliceStr.split('>').length === sliceStr.split('<').length) {
                resultArr.push(parseType(sliceStr));
                tempStr = tempStr.substr(endIndex);
                tempStrArr = tempStrArr.slice(endIndex);
                startIndex = 0;
                endIndex = 0;
                endTempIndex = 0;
            } else {
                endTempIndex = endIndex;
            }
        }

        if (endIndex >= tempStrArr.length) break;
        // if (tempStrArr.indexOf(';') === -1) {
        //     resultArr.push(parseType(tempStr.substr(startIndex)));
        //     break;
        // }
    }

    return resultArr;
}

/**
 * 处理类型 ，例如 'Ljava/util/Map<Ljava/util/Map<Ljava/lang/String;Lcom/bj58/fangchan/fangfe/entity/SimpleEntity;>;Lcom/bj58/fangchan/fangfe/entity/SimpleEntity;>;Ljava/util/Map<Ljava/lang/String;Lcom/bj58/fangchan/fangfe/entity/SimpleEntity;>;'
 * @param {*} name 类型值
 */
export function parseType(name: string) {
    if (isEmpty(name)) return name;

    if (BaseTypeKeys.indexOf(name) > -1) {
        return BaseType[name];
    }

    const classReg = /^L([\w/;]+);$/;
    const classResult = name.match(classReg);
    if (classResult) {
        return replaceSlash(classResult[1]);
    }

    if (name.indexOf('[') === 0) {
        return `${parseType(name.slice(1))}[]`;
    }

    const genericReg = /^L([\w/;]+)<(L[\w/<>;]+;)+>;$/;
    const genericResult = name.match(genericReg);
    if (genericResult) {
        const [, type1, type2] = genericResult;
        if (type1 === 'java/util/Map') {
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

    const classReg = /^L([\w/;]+);$/;
    const classResult = name.match(classReg);
    if (classResult) {
        return replaceSlash(classResult[1]);
    }

    const packageReg = /^([*L[\w/<>;]+;)$/;
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

    const baseReg = /^([*[BCDFIJSZ])$/;
    const baseResult = name.match(baseReg);
    if (baseResult) {
        return parseType(baseResult[1]);
    }

    return replaceSlash(name);
}

export function bytesToValue(bytes) {
    if (bytes instanceof Array) {
        return String.fromCharCode(...bytes);
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
