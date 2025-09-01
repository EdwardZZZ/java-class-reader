import { Instruction, FieldInfo, JavaClassFile } from 'java-class-tools';
import { readData, getAnnotations } from './ConstantPool';
import { getACC, getInstructionName } from './Const';
import Operands from './Operands';
import { MethodInfo } from './ClassReader';
import { isEmpty } from './utils';

export class MethodParser {
    private constantPool: any[];
    private isEnum: boolean;
    private enumValues: any[] = [];
    
    constructor(classFile: JavaClassFile, isEnum: boolean) {
        this.constantPool = classFile.constant_pool;
        this.isEnum = isEnum;
    }
    
    parseMethod(method: any): MethodInfo {
        const methodName: string = readData(this.constantPool, method.name_index).name;
        const paramTypes = readData(this.constantPool, method.descriptor_index).name;
        
        // 保存静态初始化方法引用
        if (methodName === 'clinit') {
            // 移除提前返回，改为构建完整methodInfo
            const methodInfo: MethodInfo = {
                methodName,
                paramTypes,
                ACC: getACC(method.access_flags),
                isClinit: true
            };
            this.parseAttributes(method, methodInfo);
            return methodInfo;
        }
        
        // 不再跳过枚举的 values 和 valueOf 方法，而是正常解析
        // if (this.isEnum && ['values', 'valueOf'].includes(methodName)) {
        //     return null;
        // }
        
        const methodInfo: MethodInfo = {
            methodName,
            paramTypes,
            ACC: getACC(method.access_flags),
        };
        
        this.parseAttributes(method, methodInfo);
        
        // 如果是枚举的 values 方法，添加标记
        if (this.isEnum && methodName === 'values') {
            methodInfo.enum = this.enumValues;
        }
        
        return methodInfo;
    }
    
    private parseAttributes(method: any, methodInfo: MethodInfo): void {
        if (!method.attributes || method.attributes.length === 0) return;

        for (const attr of method.attributes) {
            const attrName = readData(this.constantPool, attr.attribute_name_index)?.name;
            if (!attrName) continue;

            switch (attrName) {
                case 'RuntimeVisibleAnnotations':
                    methodInfo.annotations = getAnnotations(this.constantPool, attr.annotations);
                    break;
                case 'RuntimeVisibleParameterAnnotations':
                    methodInfo.parameterAnnotations = this.parseParameterAnnotations(attr);
                    break;
                case 'Code':
                    this.parseCodeAttribute(attr, methodInfo);
                    break;
                case 'Signature':
                    if (attr.signature_index) {
                        methodInfo.paramDetailTypes = readData(this.constantPool, attr.signature_index)?.name;
                    }
                    break;
                case 'Exceptions':
                    methodInfo.exception = this.parseExceptions(attr);
                    break;
            }
        }
    }

    private parseParameterAnnotations(attr: any): any[] {
        if (isEmpty(attr.parameter_annotations)) return [];
        return attr.parameter_annotations.map((paramAnnos: any) => 
            getAnnotations(this.constantPool, paramAnnos)
        );
    }

    private parseExceptions(attr: any): string[] {
        if (isEmpty(attr.exception_index_table)) return [];
        return attr.exception_index_table.map((index: number) => 
            readData(this.constantPool, index)?.name || ''
        );
    }

    private parseCodeAttribute(attr: any, methodInfo: MethodInfo): void {
        // 解析指令
        const code = attr.code || [];
        const instructions: (Instruction & { name: string, offset: number})[] = [];
        let offset = 0;
    
        while (offset < code.length) {
            const opcode = code[offset];
            const instructionName = getInstructionName(opcode); // 使用新函数
            const operand = this.parseOperand(opcode, code, offset);
            const length = operand ? operand.length + 1 : 1;
    
            instructions.push({
                opcode,
                name: instructionName,
                offset,
                operands: operand
            });
    
            offset += length;
        }
    
        methodInfo.codes = instructions;

        // 解析异常处理器
        if (attr.exception_table) {
            methodInfo.exceptionHandlers = attr.exception_table.map((handler: any) => ({
                startPc: handler.start_pc,
                endPc: handler.end_pc,
                handlerPc: handler.handler_pc,
                catchType: handler.catch_type ? readData(this.constantPool, handler.catch_type)?.name : 'any',
                isValid: true
            }));
        }

        // 解析行号表和局部变量表
        if (attr.attributes) {
            attr.attributes.forEach((subAttr: any) => {
                const subAttrName = readData(this.constantPool, subAttr.attribute_name_index)?.name;
                if (subAttrName === 'LineNumberTable') {
                    methodInfo.LineNumberTable = subAttr.line_number_table;
                } else if (subAttrName === 'LocalVariableTable') {
                    methodInfo.LocalVariableTable = this.parseLocalVariableTable(subAttr);
                }
            });
        }
    }

    private parseOperand(opcode: number, code: number[], offset: number): any {
        switch (opcode) {
            case 16: // bipush
                return Operands.BIPUSH(code, offset + 1);
            case 17: // sipush
                return Operands.SIPUSH(code, offset + 1);
            // 可根据需要添加更多操作数解析逻辑
            default:
                return null;
        }
    }

    private parseLocalVariableTable(attr: any): { variable: Record<string, string>, parameters: Record<string, string> } {
        const variable: Record<string, string> = {};
        const parameters: Record<string, string> = {};

        if (attr.local_variable_table) {
            attr.local_variable_table.forEach((entry: any) => {
                const name = readData(this.constantPool, entry.name_index)?.name || '';
                const type = readData(this.constantPool, entry.descriptor_index)?.name || '';
                variable[name] = type;
                if (entry.index < 5) { // 简单参数索引判断
                    parameters[name] = type;
                }
            });
        }

        return { variable, parameters };
    }
}