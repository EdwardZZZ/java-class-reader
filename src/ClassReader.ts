import {
    JavaClassFileReader, JavaClassFile,
} from 'java-class-tools';
import { getValueFromConstantPool } from './getValueFromConstantPool';
import { isEmpty, getAnnotations, getACC, InstructionMap } from './utils';

const reader = new JavaClassFileReader();

export default class ClassReader {
    constructor(data: Uint8Array | Buffer | number[] | string) {
        this.classFile = reader.read(data);
    }

    classFile: JavaClassFile;

    getAllInfo(options: any = {}) {
        return {
            interfaceName: this.getInterfaceName(),
            fullyQualifiedName: this.getFullyQualifiedName(),
            superClass: this.getSuperClass(),
            dependClass: this.getDependClass(),
            classInfo: this.getClassInfo(),
            methodsInfo: this.getMethodsInfo(options.showCode),
            fieldsInfo: this.getFieldsInfo(),
        };
    }

    getInterfaceName() {
        const {
            constant_pool,
            interfaces,
        } = this.classFile;

        return interfaces.map(itf => (getValueFromConstantPool(constant_pool, itf).name));
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
                sourcefile_index,
                attribute_name_index,
                annotations,
            } = attribute;
            if (!isEmpty(sourcefile_index)) {
                const attrName = getValueFromConstantPool(constant_pool, attribute_name_index);
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

    getMethodsInfo(showCode: boolean = false) {
        const {
            constant_pool,
            methods,
        } = this.classFile;

        const methodsInfo = [];

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
            methodInfo.paramTypes = paramTypes;
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

                        if (showCode && attrName === 'Code' && code) {
                            methodInfo.codes = code.map(c => (InstructionMap.get(c)));
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
                                local_variable_table.forEach((attrVar) => {
                                    const {
                                        index,
                                        name_index,
                                        descriptor_index,
                                    } = attrVar;

                                    // const result = getValueFromConstantPool(constant_pool, index);
                                    // console.log(methodName, JSON.stringify(result));
                                    const variName = getValueFromConstantPool(constant_pool, name_index).name;
                                    const typeName = getValueFromConstantPool(constant_pool, descriptor_index).name;
                                    variable[variName] = typeName;

                                    if (paramTypes[0] && index > 0 && index <= paramTypes[0].length) {
                                        parameters[variName] = typeName;
                                    }
                                });
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

        fields.forEach((field) => {
            const {
                access_flags,
                descriptor_index,
                name_index,
                attributes,
            }: any = field;

            const fieldName = getValueFromConstantPool(constant_pool, name_index).name;
            const type = getValueFromConstantPool(constant_pool, descriptor_index).name;

            const fieldInfo: any = {
                fieldName,
                type,
            };

            fieldInfo.ACC = getACC(access_flags);

            attributes.forEach((attr) => {
                const {
                    attribute_name_index,
                    constantvalue_index,
                    annotations,
                    signature_index,
                } = attr;

                const attrName = getValueFromConstantPool(constant_pool, attribute_name_index);
                const attrValue = getValueFromConstantPool(constant_pool, constantvalue_index);
                if (attrValue) {
                    fieldInfo[attrName.name] = attrValue.name;
                }

                if (!isEmpty(signature_index)) {
                    const signature = getValueFromConstantPool(constant_pool, signature_index).name;
                    fieldInfo.type = signature;
                }

                if (!isEmpty(annotations)) {
                    fieldInfo.annotations = getAnnotations(constant_pool, annotations);
                }
            });

            fieldsInfo.push(fieldInfo);
        });

        return fieldsInfo;
    }
}
