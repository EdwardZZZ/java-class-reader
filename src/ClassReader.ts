import {
    JavaClassFileReader, JavaClassFile, Opcode, InstructionParser, ClassInfo, FieldInfo, StackMapFrame, Instruction,
} from 'java-class-tools';

import { readData, getAnnotations } from './ConstantPool';
import { isEmpty, mixinArr } from './utils';
import { getACC, InstructionMap } from './Const';
import Operands from './Operands';

const reader = new JavaClassFileReader();

type TStringKey = { [key: string]: any };

type TMethodInfo = {
    methodName: string,
    paramTypes: any[],
    ACC: string[],
    codes?: Instruction[],
    annotations?: any,
    enum?: any[],
    exception?: any[],
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
    }

    private classFile: JavaClassFile;

    private superClass: string;

    private dependClass: string[];

    private interfaceName: string[];

    private fullyQualifiedName: string;

    private classInfo: TStringKey;

    private enumInfos: TStringKey[] = null;

    getAllInfo({ showCode }: any = {}) {
        const { superClass, dependClass, interfaceName, fullyQualifiedName, classInfo } = this;

        const { fieldsInfo, enumFieldsInfo } = this.getFieldsInfo();
        const methodsInfo = this.getMethodsInfo({ showCode });
        const { enumInfos } = this; // after getMethodsInfo

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
            enumInfos,
        };
    }

    getInterfaceName(): string[] {
        const {
            constant_pool,
            interfaces,
        } = this.classFile;

        return interfaces.map((itf) => (readData(constant_pool, itf).name));
    }

    getFullyQualifiedName(): string {
        const {
            constant_pool,
            this_class,
        } = this.classFile;

        return readData(constant_pool, this_class).name;
    }

    getSuperClass(): string {
        const {
            constant_pool,
            super_class,
        } = this.classFile;

        return readData(constant_pool, super_class).name;
    }

    private getDependClass(): string[] {
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
                mixinArr(this.dependClass, Object.keys(annos));
                info.annotations = annos;
            }
        });

        return info;
    }

    getMethodsInfo({
        showCode = false,
    } = {}) {
        const {
            constant_pool,
            methods,
        } = this.classFile;
        const isEnum = this.superClass === 'java.lang.Enum';

        const methodsInfo: TMethodInfo[] = [];
        const readMap = new Map();

        methods.forEach((method) => {
            const {
                access_flags,
                name_index,
                descriptor_index,
                attributes,
            }: any = method;

            const methodName: string = readData(constant_pool, name_index).name;
            const paramTypes = readData(constant_pool, descriptor_index).name;

            if (isEnum && ~['values', 'valueOf'].indexOf(methodName)) return;

            const methodInfo: TMethodInfo = {
                methodName,
                paramTypes,
                ACC: getACC(access_flags),
            };

            if (methodName === '<clinit>') {
                // staticConstructMethod = method;
            }

            if (!isEmpty(attributes)) {
                for (const attribute of attributes) {
                    const {
                        code,
                        annotations,
                        signature_index,
                        attribute_name_index,
                        exception_index_table,
                    } = attribute;

                    if (!isEmpty(annotations)) {
                        const annos = getAnnotations(constant_pool, annotations);
                        mixinArr(this.dependClass, Object.keys(annos));
                        methodInfo.annotations = annos;
                    }

                    if (attribute_name_index) {
                        const attrName = readData(constant_pool, attribute_name_index).name;

                        if (attrName === 'Code' && code) {
                            const instructions = InstructionParser.fromBytecode(code);

                            if (showCode) methodInfo.codes = instructions;

                            // TODO 此处仅解析 Enum，其它方法及代码待解析
                            if (methodName === '<clinit>' && isEnum) {
                                let readIndex = 0;
                                let reading = false;
                                let tempVal: TStringKey = {};
                                const enumVal = [];

                                for (const instruction of instructions) {
                                    const { opcode, operands } = instruction;
                                    const opName: string = InstructionMap.get(opcode).toLowerCase();

                                    if (opcode === Opcode.NEW) {
                                        readIndex = 0;
                                        reading = true;
                                        tempVal = {};
                                    } else if (reading && opcode === Opcode.DUP) {
                                        // TODO
                                    } else if (reading && opName.startsWith('iconst')) {
                                        const name = readMap.get(readIndex++);
                                        const result = opName.replace('iconst_', '').replace('m', '-');
                                        // enum order
                                        tempVal[name] = +result;
                                    } else if (reading && opcode === Opcode.LDC) {
                                        const name = readMap.get(readIndex++);
                                        const result = readData(constant_pool, operands[0]).name;
                                        tempVal[name] = result;
                                    } else if (reading && opcode === Opcode.SIPUSH) {
                                        const name = readMap.get(readIndex++);
                                        const result = Operands.SIPUSH(instruction.operands);
                                        tempVal[name] = result;
                                    } else if (reading && opcode === Opcode.BIPUSH) {
                                        const name = readMap.get(readIndex++);
                                        const result = Operands.BIPUSH(instruction.operands);
                                        tempVal[name] = result;
                                    } else if (reading && opcode === Opcode.INVOKESPECIAL) {
                                        enumVal.push(tempVal);
                                        reading = false;
                                    }
                                }

                                /* eslint-disable @typescript-eslint/no-unused-vars */
                                methodInfo.enum = enumVal.map(({ EnumOrder, ...val }) => Object.values(val));
                                this.enumInfos = enumVal;
                            }
                        }

                        if (attrName === 'Exceptions' && exception_index_table) {
                            methodInfo.exception = exception_index_table.map((expt: any) => readData(constant_pool, expt).name);
                        }

                        if (attrName === 'Signature' && signature_index) {
                            const paramDetailTypes = readData(constant_pool, signature_index);
                            methodInfo.paramDetailTypes = paramDetailTypes.name;
                        }
                    }

                    if (!isEmpty(attribute.attributes)) {
                        for (const attr of attribute.attributes) {
                            const {
                                attribute_name_index,
                                local_variable_table,
                                line_number_table,
                                entries,
                            } = attr;

                            const attrName = readData(constant_pool, attribute_name_index).name;

                            if (attrName === 'StackMapTable' && entries) {
                                /* eslint-disable arrow-body-style */
                                methodInfo.entries = entries.map((entry: StackMapFrame) => {
                                    /**
                                     * frame_type
                                     * 0-63 SameFrame
                                     * 64-127 SameLocalsOneStackItemFrame
                                     * 247 SameLocalsOneStackItemFrameExtended
                                     * 248-250 ChopFrame
                                     * 251 SameFrameExtended
                                     * 252-254 AppendFrame
                                     * 255 FullFrame
                                     */
                                    return entry;
                                });
                            }

                            if (attrName === 'LineNumberTable' && line_number_table) {
                                methodInfo.LineNumberTable = line_number_table;
                            }

                            if (attrName === 'LocalVariableTable' && local_variable_table) {
                                const variable = {};
                                const parameters = {};

                                local_variable_table.sort((l1: any, l2: any) => (l1.index - l2.index));
                                const paramLen = (methodInfo.paramTypes[0] || []).length;

                                for (const attrVar of local_variable_table) {
                                    const {
                                        index,
                                        name_index,
                                        descriptor_index,
                                    } = attrVar;

                                    const variName = readData(constant_pool, name_index).name;
                                    const typeName = readData(constant_pool, descriptor_index).name;
                                    variable[variName] = typeName;

                                    if (Object.keys(parameters).length < paramLen) {
                                        if (methodInfo.ACC.indexOf('static') > -1) {
                                            parameters[variName] = typeName;
                                        } else if (index > 0) {
                                            // index === 0  ==> this
                                            parameters[variName] = typeName;
                                        }
                                    }
                                }

                                if (isEnum && methodName === '<init>') {
                                    const [inParam, outParam] = paramTypes;
                                    const [, , ...newInParam] = inParam;
                                    methodInfo.paramTypes = [newInParam, outParam];

                                    let readIndex = 0;
                                    readMap.set(readIndex, 'EnumName');
                                    readMap.set(++readIndex, 'EnumOrder');

                                    for (const { index, name_index } of local_variable_table) {
                                        if (index > 0 && readIndex - 2 <= paramLen) {
                                            readMap.set(++readIndex, readData(constant_pool, name_index).name);
                                        }
                                    }
                                }

                                methodInfo.LocalVariableTable = {
                                    variable,
                                    parameters,
                                };
                            }
                        }
                    }
                }
            }

            methodsInfo.push(methodInfo);
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

            if (this.superClass === 'java.lang.Enum' && fieldName === '$VALUES') continue;
            const fieldInfo: {
                fieldName: string,
                type: string,
                ACC?: string[],
                annotations?: TStringKey,
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
                const attrValue = readData(constant_pool, constantvalue_index);
                if (attrValue.name) {
                    fieldInfo[attrName.name] = attrValue.name;
                }

                if (!isEmpty(signature_index)) {
                    const signature = readData(constant_pool, signature_index);
                    fieldInfo.type = signature.name;
                }

                if (!isEmpty(annotations)) {
                    const annos = getAnnotations(constant_pool, annotations);
                    mixinArr(this.dependClass, Object.keys(annos));
                    fieldInfo.annotations = annos;
                }
            }

            if (fieldInfo.type === this.getFullyQualifiedName()) {
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
