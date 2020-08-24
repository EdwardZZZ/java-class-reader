import {
    JavaClassFileReader, JavaClassFile, Opcode, InstructionParser,
} from 'java-class-tools';

import { getValueFromConstantPool } from './getValueFromConstantPool';
import { isEmpty, getAnnotations } from './utils';
import { getACC, InstructionMap } from './Const';
import Operands from './Operands';

const reader = new JavaClassFileReader();

export default class ClassReader {
    constructor(data: Uint8Array | Buffer | number[] | string) {
        this.classFile = reader.read(data);

        // const { constant_pool_count, constant_pool } = this.classFile;
        // for (let i = 1; i < constant_pool_count; i++) {
        //     const result = getValueFromConstantPool(constant_pool, i);
        //     console.log(i, JSON.stringify(result));
        // }
    }

    classFile: JavaClassFile;

    enumInfos: any[] = [];

    getAllInfo({ showCode }: any = {}) {
        const superClass = this.getSuperClass();
        const { fieldsInfo, enumFieldsInfo } = this.getFieldsInfo();
        const isEnum = superClass === 'java.lang.Enum';
        const methodsInfo = this.getMethodsInfo({ showCode, isEnum });

        return {
            interfaceName: this.getInterfaceName(),
            fullyQualifiedName: this.getFullyQualifiedName(),
            superClass,
            dependClass: this.getDependClass(),
            classInfo: this.getClassInfo(),
            methodsInfo,
            fieldsInfo,
            enumFieldsInfo,
            // After getMethodsInfo can get
            enumInfos: this.enumInfos,
        };
    }

    getInterfaceName() {
        const {
            constant_pool,
            interfaces,
        } = this.classFile;

        return interfaces.map((itf) => (getValueFromConstantPool(constant_pool, itf).name));
    }

    getFullyQualifiedName() {
        const {
            constant_pool,
            this_class,
        } = this.classFile;
        return getValueFromConstantPool(constant_pool, this_class).name;
    }

    getSuperClass() {
        const {
            constant_pool,
            super_class,
        } = this.classFile;
        return getValueFromConstantPool(constant_pool, super_class).name;
    }

    getDependClass() {
        const {
            constant_pool,
        } = this.classFile;

        const dependClasses = [];
        constant_pool.forEach((classInfo: any) => {
            if (isEmpty(classInfo)) return;
            const {
                tag,
                name_index,
            } = classInfo;
            if (tag === 7) {
                dependClasses.push(getValueFromConstantPool(constant_pool, name_index).name);
            }
        });

        return dependClasses;
    }

    getClassInfo() {
        const info: any = {};

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
            const attrName = getValueFromConstantPool(constant_pool, attribute_name_index);

            if (!isEmpty(signature_index)) {
                const signature = getValueFromConstantPool(constant_pool, signature_index);
                info[attrName.name] = signature.name;
            }

            if (!isEmpty(sourcefile_index)) {
                const sourcefile = getValueFromConstantPool(constant_pool, sourcefile_index);
                info[attrName.name] = sourcefile.name;
            }

            if (!isEmpty(annotations)) {
                const annoResult = getAnnotations(constant_pool, annotations);
                info.annotations = annoResult;
            }
        });

        return info;
    }

    getMethodsInfo({
        showCode = false,
        isEnum = false,
    } = {}) {
        const {
            constant_pool,
            methods,
        } = this.classFile;

        const methodsInfo = [];
        const readMap = new Map();
        /* eslint-disable @typescript-eslint/no-unused-vars */
        methods.forEach((method) => {
            const methodName = getValueFromConstantPool(constant_pool, method.name_index).name;
            if (methodName === '<clinit>') {
                // staticConstructMethod = method;
            }
            if (methodName === '<init>') {
                // constructMethod = method;
                // 读取变量池 start this.getFieldsInfo();
                const attr: any = method.attributes[0];
                let readIndex = 0;
                readMap.set(readIndex, 'EnumName');
                readMap.set(++readIndex, 'EnumOrder');

                if (attr.attributes) {
                    attr.attributes[1].local_variable_table.forEach((a, idx) => {
                        if (idx === 0) return;
                        readMap.set(++readIndex, getValueFromConstantPool(constant_pool, a.name_index).name);
                    });
                }
                // 读取变量池 end
            }
        });

        methods.forEach((method) => {
            const {
                access_flags,
                name_index,
                descriptor_index,
                attributes,
            }: any = method;

            const methodName = getValueFromConstantPool(constant_pool, name_index).name;

            const methodInfo: any = {
                methodName,
            };
            const paramTypes = getValueFromConstantPool(constant_pool, descriptor_index).name;
            if (isEnum && methodName === '<init>') {
                const [inParam, outParam] = paramTypes;
                const [, , ...newInParam] = inParam;
                methodInfo.paramTypes = [newInParam, outParam];
            } else {
                methodInfo.paramTypes = paramTypes;
            }
            methodInfo.ACC = getACC(access_flags);

            if (!isEmpty(attributes)) {
                for (const attribute of attributes) {
                    const {
                        code,
                        signature_index,
                        annotations,
                        attribute_name_index,
                        exception_index_table,
                    } = attribute;

                    if (attribute_name_index) {
                        const attrName = getValueFromConstantPool(constant_pool, attribute_name_index).name;

                        // TODO 此处仅解析 Enum，其它方法及代码待解析
                        if (attrName === 'Code' && code) {
                            const instructions = InstructionParser.fromBytecode(code);

                            if (showCode) methodInfo.codes = instructions;
                            if (methodName === '<clinit>') {
                                let readIndex = 0;
                                let reading = false;
                                let tempVal: any = {};
                                const enumVal = [];

                                for (const instruction of instructions) {
                                    const { opcode, operands } = instruction;
                                    const opName: string = InstructionMap.get(opcode);

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
                                        const result = getValueFromConstantPool(constant_pool, operands[0]).name;
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

                                methodInfo.enum = enumVal.map(({ EnumOrder, ...val }) => Object.values(val));
                                this.enumInfos = enumVal;
                            }
                        }

                        if (attrName === 'Exceptions' && exception_index_table) {
                            methodInfo.exception = exception_index_table.map((expt: any) => getValueFromConstantPool(constant_pool, expt).name);
                        }

                        if (attrName === 'Signature' && signature_index) {
                            const paramDetailTypes = getValueFromConstantPool(constant_pool, signature_index);
                            methodInfo.paramDetailTypes = paramDetailTypes.name;
                        }
                    }

                    if (!isEmpty(annotations)) {
                        methodInfo.annotations = getAnnotations(constant_pool, annotations);
                    }

                    if (!isEmpty(attribute.attributes)) {
                        for (const attr of attribute.attributes) {
                            const {
                                // attribute_name_index,
                                local_variable_table,
                            } = attr;

                            // if (attribute_name_index) {
                            //     const attrName = getValueFromConstantPool(constant_pool, attribute_name_index).name;
                            //     console.log(methodName, attrName);
                            // }

                            if (local_variable_table) {
                                const variable = {};
                                const parameters = {};
                                local_variable_table.sort((l1: any, l2: any) => l1.index > l2.index);
                                for (const attrVar of local_variable_table) {
                                    const {
                                        index,
                                        name_index,
                                        descriptor_index,
                                    } = attrVar;

                                    const variName = getValueFromConstantPool(constant_pool, name_index).name;
                                    const typeName = getValueFromConstantPool(constant_pool, descriptor_index).name;
                                    variable[variName] = typeName;

                                    // 倒数几位是参数？
                                    const paramKeys = Object.keys(parameters);
                                    let psn = 1;
                                    if (methodInfo.ACC && methodInfo.ACC.indexOf('static') > -1) psn = 0;
                                    if (isEnum) psn = 3;
                                    if (paramTypes[0] && paramKeys.length < paramTypes[0].length && index === paramKeys.length + psn) {
                                        parameters[variName] = typeName;
                                    }
                                }
                                methodInfo.variable = variable;
                                methodInfo.parameters = parameters;
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
            }: any = field;

            const fieldName = getValueFromConstantPool(constant_pool, name_index).name;
            const type = getValueFromConstantPool(constant_pool, descriptor_index).name;

            if (this.getSuperClass() === 'java.lang.Enum' && fieldName === '$VALUES') continue;
            const fieldInfo: any = {
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
                } = attr;

                const attrName = getValueFromConstantPool(constant_pool, attribute_name_index);
                const attrValue = getValueFromConstantPool(constant_pool, constantvalue_index);
                if (attrValue.name) {
                    fieldInfo[attrName.name] = attrValue.name;
                }

                if (!isEmpty(signature_index)) {
                    const signature = getValueFromConstantPool(constant_pool, signature_index).name;
                    fieldInfo.type = signature;
                }

                if (!isEmpty(annotations)) {
                    fieldInfo.annotations = getAnnotations(constant_pool, annotations);
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
