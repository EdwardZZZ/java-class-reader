import { Annotation, ConstantPoolInfo } from 'java-class-tools';

import { getValueFromConstantPool } from './getValueFromConstantPool';
import { BaseTypeKeys, BaseType } from './Const';

export const type = (obj: any): string => Object.prototype.toString.call(obj).slice(8, -1);

export const isEmpty = ((undef) => (obj: any) => (obj === undef || obj === null))();

export const isString = (obj: any): obj is string => type(obj) === 'String';

export const replaceSlash = (str: string) => str.replace(/\//g, '.');

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

/**
 * [Lcom..service.business.dto.ResultDto$ResultCode;
 * Ljava.lang.Enum<Lcom..service.business.dto.ResultDto$ResultCode;>;
 */
// baseType
const baseReg = /^(\[*[BCDFIJSZ])$/;
// package name
const packageReg = /^([*L[\w/$<>;]+;)$/;
// class name
const classReg = /^L([\w/$;]+);$/;
// generic
const genericReg = /^L([\w/;]+)<(L?[\w/<>$;]+;)+>;$/;
// input output
const inoutReg = /^\(([[\w/<>;]+;?)?\)([[\w|/|<|>|;]+;?)$/;
// generic  '<T:Ljava/lang/Object;>(Ljava/lang/Class<TT;>;)TT;'
const TReg = /^<([\w:;/.]+)>\(([[\w/<>;.]+;?)?\)([[\w|/|<|>|;.]+;?)$/;

/**
 * 处理类型 ，例如 'Ljava/util/Map<Ljava/util/Map<Ljava/lang/String;Lcom/bj58/fangchan/fangfe/entity/SimpleEntity;>;Lcom/bj58/fangchan/fangfe/entity/SimpleEntity;>;Ljava/util/Map<Ljava/lang/String;Lcom/bj58/fangchan/fangfe/entity/SimpleEntity;>;'
 * @param {*} name 类型值
 */
export function parseType(name: string) {
    if (isEmpty(name) || !isString(name)) return name;
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
export function parseName(name: string) {
    if (isEmpty(name)) return name;

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

    const TResult = name.match(TReg);
    if (TResult) {
        const [, T, inStr, outStr] = TResult;
        const inArr = formatInOut(inStr);
        const [key, value] = T.split(':');
        const outArr = formatInOut(outStr.replace(new RegExp(`${key}${key};`), value));
        return [inArr, outArr];
    }

    const baseResult = name.match(baseReg);
    if (baseResult) {
        return parseType(baseResult[1]);
    }

    return replaceSlash(name);
}

export function getAnnotations(constant_pool: ConstantPoolInfo[], annotations: Annotation[]) {
    const annotationsResult = {};
    annotations.forEach(({ type_index, element_value_pairs }: Annotation) => {
        const annotationAttr = {};
        const attributeName = getValueFromConstantPool(constant_pool, type_index);

        if (element_value_pairs !== undefined) {
            element_value_pairs.forEach(({ element_name_index, element_value }: any) => {
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
