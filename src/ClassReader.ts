import {
    JavaClassFileReader, JavaClassFile, Opcode, InstructionParser, ClassInfo, FieldInfo, Instruction,
} from 'java-class-tools';

import { readData, getAnnotations } from './ConstantPool';
import { getParameterAnnotations, isEmpty, isValidType, mixinArray, parseStackMapTypes } from './utils';
import { getACC, InstructionMap } from './Const';
import Operands from './Operands';
import { MethodParser } from './MethodParser';

const reader = new JavaClassFileReader();

type TStringKey = Record<string, any>;

type TMethodInfo = {
    methodName: string,
    paramTypes: any[],
    ACC: string[],
    codes?: Instruction[],
    annotations?: any,
    enum?: any[],
    exception?: any[],
    parameterAnnotations?: any[],
    paramDetailTypes?: any[],
    LineNumberTable?: any,
    entries?: any,
    LocalVariableTable?: {
        variable: { [key: string]: any },
        parameters: { [key: string]: string },
    }
};

export default class ClassReader {
    constructor(data: Uint8Array | Buffer | number[] | string) {
        this.classFile = reader.read(data);
        this.fullyQualifiedName = this.getFullyQualifiedName();
        this.superClass = this.getSuperClass();
        this.dependClass = this.getDependClass();
        this.interfaceName = this.getInterfaceName();
        this.classInfo = this.getClassInfo();
        this.enumInfos = []; // 初始化为空数组而不是null
    }

    private classFile: JavaClassFile;

    private superClass: string;

    private dependClass: string[];

    private interfaceName: string[];

    private fullyQualifiedName: string;

    private classInfo: TStringKey;

    // 修改枚举信息存储类型声明
    private enumInfos: TStringKey[] = []; // 从数组改为对象
    private staticConstructMethod: any = null;

    getAllInfo({ showCode }: any = {}) {
        const { superClass, dependClass, interfaceName, fullyQualifiedName, classInfo } = this;

        const { fieldsInfo, enumFieldsInfo } = this.getFieldsInfo();
        const methodsInfo = this.getMethodsInfo({ showCode });
        
        // 如果是枚举类，解析枚举信息
        if (superClass === 'java.lang.Enum') {
            this.parseEnumInfos(enumFieldsInfo);
        }

        return {
            package: fullyQualifiedName.slice(0, fullyQualifiedName.lastIndexOf('.')),
            dependClass: dependClass.sort(),
            fullyQualifiedName,
            superClass,
            interfaceName,
            classInfo,
            methodsInfo,
            fieldsInfo,
            enumFieldsInfo,
            enumInfos: this.enumInfos, // 现在返回的是对象而非数组
        };
    }

    // 添加解析枚举信息的方法
    private parseEnumInfos(enumFieldsInfo: TStringKey[]): void {
        this.enumInfos = [];

        if (this.staticConstructMethod?.codes) {
            const enumValues = this.extractEnumValuesFromClinit();
    
            // 创建字段名到索引的映射
            const fieldNameToIndex = new Map<string, number>();
            enumFieldsInfo.forEach((fieldInfo, index) => {
                fieldNameToIndex.set(fieldInfo.fieldName, index);
            });

            // 匹配枚举值到对应的字段并添加到数组
            enumValues.forEach(enumValue => {
                if (fieldNameToIndex.has(enumValue.name)) {
                    const index = fieldNameToIndex.get(enumValue.name);
                    const fieldInfo = enumFieldsInfo[index];
    
                    // 基础枚举信息
                    const baseInfo = {
                        EnumName: enumValue.name,
                        EnumOrder: enumValue.ordinal
                    };
    
                    // 动态字段映射（参数按顺序匹配自定义字段）
                    const customFields = {};
                    const customFieldNames = Object.keys(fieldInfo)
                        .filter(key => !['fieldName', 'type'].includes(key));
    
                    // 将提取的参数按顺序分配给自定义字段
                    customFieldNames.forEach((fieldName, paramIndex) => {
                        customFields[fieldName] = enumValue.params[paramIndex] ?? fieldInfo[fieldName] ?? null;
                    });
    
                    this.enumInfos.push({
                        ...baseInfo,
                        ...customFields
                    });
                }
            });
        }
        
        // 确保所有枚举字段都被处理
        enumFieldsInfo.forEach((fieldInfo, index) => {
            const enumName = fieldInfo.fieldName;
            // 检查是否已添加
            const exists = this.enumInfos.some(item => item.EnumName === enumName);
            if (!exists) {
                // 基础枚举信息
                const baseInfo = {
                    EnumName: enumName,
                    EnumOrder: index
                };
    
                // 从fieldInfo动态提取自定义字段
                const customFields = {};
                Object.keys(fieldInfo).forEach(key => {
                    if (!['fieldName', 'type'].includes(key)) {
                        customFields[key] = fieldInfo[key];
                    }
                });
    
                this.enumInfos.push({
                    ...baseInfo,
                    ...customFields
                });
            }
        });
    }

    // 添加从静态初始化方法提取枚举值的方法
    private extractEnumValuesFromClinit(): any[] {
        const values: any[] = [];
        const codes = this.staticConstructMethod.codes;
        let currentEnumName: string | null = null;
        let currentEnumParams: any[] = []; // 存储多个参数值
        let expectingParams = false;
        let paramCount = 0; // 跟踪参数数量
    
        for (let i = 0; i < codes.length; i++) {
            const code = codes[i];
    
            // 查找字符串常量加载 (枚举名称)
            if (code.name === 'ldc' && typeof code.operands?.value === 'string') {
                currentEnumName = code.operands.value;
                expectingParams = true;
                currentEnumParams = []; // 重置参数数组
                paramCount = 0;
            }
    
            // 查找参数加载指令 (支持多种类型)
            else if (expectingParams && [
                'bipush', 'sipush', 'iconst_', 
                'ldc', 'ldc_w', // 字符串参数
                'fconst_', 'dconst_', // 浮点参数
            ].some(cmd => code.name.startsWith(cmd))) {
                // 收集参数值
                currentEnumParams.push(code.operands?.value !== undefined ? code.operands.value : null);
                paramCount++;
            }
    
            // 查找构造函数调用 (结束参数收集)
            else if (expectingParams && code.name === 'invokespecial') {
                values.push({
                    name: currentEnumName,
                    params: currentEnumParams, // 存储所有参数
                    ordinal: values.length
                });
                currentEnumName = null;
                expectingParams = false;
            }
    
            // 遇到其他指令重置状态
            else if (expectingParams && !code.name.startsWith('iconst_') && !code.name.startsWith('ldc')) {
                expectingParams = false;
            }
        }
    
        return values;
    }

    getInterfaceName(): string[] {
        if (this.dependClass) return this.dependClass;

        const {
            constant_pool,
            interfaces,
        } = this.classFile;

        return interfaces.map((itf) => (readData(constant_pool, itf).name));
    }

    getFullyQualifiedName(): string {
        if (this.fullyQualifiedName) return this.fullyQualifiedName;

        const {
            constant_pool,
            this_class,
        } = this.classFile;

        return readData(constant_pool, this_class).name;
    }

    getSuperClass(): string {
        if (this.superClass) return this.superClass;

        const {
            constant_pool,
            super_class,
        } = this.classFile;

        return readData(constant_pool, super_class).name;
    }

    private getDependClass(): string[] {
        if (this.dependClass) return this.dependClass;

        const { constant_pool } = this.classFile;
        const { superClass, fullyQualifiedName } = this;

        const dependClasses = [];
        constant_pool.forEach((classInfo: ClassInfo) => {
            if (isEmpty(classInfo)) return;

            if (classInfo.tag === 7) {
                const { name } = readData(constant_pool, classInfo.name_index);

                if (name !== fullyQualifiedName && !dependClasses.includes(name)
                    && !(/^java\.lang\.[a-zA-z]+$/.test(name)) && !(/^java\.util\.[a-zA-z]+$/.test(name))) {
                    if (superClass === 'java.lang.Enum' && name === `${fullyQualifiedName}[]`) return;

                    dependClasses.push(name);
                }
            }
        });

        return dependClasses;
    }

    getClassInfo() {
        if (this.classInfo) return this.classInfo;

        const info: TStringKey = {};

        const {
            constant_pool,
            attributes,
        } = this.classFile;
        attributes.forEach((attribute: any) => {
            const {
                signature_index,
                sourcefile_index,
                attribute_name_index,
                annotations,
            } = attribute;
            const attrName = readData(constant_pool, attribute_name_index);

            if (!isEmpty(signature_index)) {
                const signature = readData(constant_pool, signature_index);
                info[attrName.name] = signature.name;
            }

            if (!isEmpty(sourcefile_index)) {
                const sourcefile = readData(constant_pool, sourcefile_index);
                info[attrName.name] = sourcefile.name;
            }

            if (!isEmpty(annotations)) {
                const annos = getAnnotations(constant_pool, annotations);
                mixinArray(this.dependClass, Object.keys(annos));
                info.annotations = annos;
            }
        });

        return info;
    }

    getMethodsInfo({ showCode }: any = {}) {
        const { methods } = this.classFile;
        const isEnum = this.superClass === 'java.lang.Enum';
        const methodParser = new MethodParser(this.classFile, isEnum);
        const methodsInfo: MethodInfo[] = [];
    
        methods.forEach((method) => {
            const methodInfo = methodParser.parseMethod(method);
            if (methodInfo) {
                methodsInfo.push(methodInfo);
                // 保存静态初始化方法
                if (methodInfo.methodName === 'clinit') {
                    this.staticConstructMethod = methodInfo;
                }
            }
        });
    
        return methodsInfo;
    }

    getFieldsInfo() {
        const {
            constant_pool,
            fields,
        } = this.classFile;

        const fieldsInfo = [];
        const enumFieldsInfo = [];

        for (const field of fields) {
            const {
                access_flags,
                descriptor_index,
                name_index,
                attributes,
            }: FieldInfo = field;

            const fieldName = readData(constant_pool, name_index).name;
            const type = readData(constant_pool, descriptor_index).name;

            // 跳过枚举的$VALUES字段
            if (this.superClass === 'java.lang.Enum' && fieldName === '$VALUES') continue;
            
            const fieldInfo: {
                fieldName: string,
                type: string,
                ACC?: string[],
                annotations?: TStringKey,
                ConstantValue?: any
            } = {
                fieldName,
                type,
            };

            fieldInfo.ACC = getACC(access_flags);

            for (const attr of attributes) {
                const {
                    attribute_name_index,
                    constantvalue_index,
                    annotations,
                    signature_index,
                }: any = attr;

                const attrName = readData(constant_pool, attribute_name_index);
                
                // 处理常量值
                if (attrName.name === 'ConstantValue' && constantvalue_index) {
                    const constantValue = readData(constant_pool, constantvalue_index);
                    fieldInfo.ConstantValue = constantValue.value !== undefined ? constantValue.value : constantValue.name;
                }

                if (!isEmpty(signature_index)) {
                    const signature = readData(constant_pool, signature_index);
                    fieldInfo.type = signature.name;
                }

                if (!isEmpty(annotations)) {
                    const annos = getAnnotations(constant_pool, annotations);
                    mixinArray(this.dependClass, Object.keys(annos));
                    fieldInfo.annotations = annos;
                }
            }

            // 判断是否为枚举字段
            if (this.superClass === 'java.lang.Enum' && fieldName !== 'serialVersionUID') {
                enumFieldsInfo.push(fieldInfo);
            } else {
                fieldsInfo.push(fieldInfo);
            }
        }

        return {
            fieldsInfo,
            enumFieldsInfo,
        };
    }
}

// 替换为具体接口定义
interface ExceptionHandler {
    startPc: number;
    endPc: number;
    handlerPc: number;
    catchType: string;
    isValid: boolean;
}

interface LocalVariableInfo {
    variable: Record<string, string>;
    parameters: Record<string, string>;
}

export interface MethodInfo {
    methodName: string;
    paramTypes: [string[], string];
    ACC: string[];
    isClinit?: boolean;
    codes?: Instruction[];
    annotations?: Record<string, Record<string, any>>;
    enum?: any[];
    exception?: string[];
    parameterAnnotations?: any[];
    paramDetailTypes?: string;
    LineNumberTable?: any;
    entries?: any;
    LocalVariableTable?: LocalVariableInfo;
    exceptionHandlers?: ExceptionHandler[];
}
