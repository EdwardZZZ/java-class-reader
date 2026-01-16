import { BufferReader } from './BufferReader';
import { ClassFile, ConstantPoolInfo, FieldInfo, MethodInfo, AttributeInfo } from './types';
import { parseConstantPool, readData } from './ConstantPoolParser';
import { InstructionParser } from './InstructionParser';
import { parseAccessFlags } from './utils';

export class ClassParser {
    private reader: BufferReader;

    private constantPool: ConstantPoolInfo[];

    constructor(buffer: Uint8Array | number[] | Buffer) {
        this.reader = new BufferReader(buffer);
    }

    parse(): ClassFile {
        const magic = this.reader.readU4();
        if (magic !== 0xCAFEBABE) {
            throw new Error('Invalid magic number');
        }

        const minor_version = this.reader.readU2();
        const major_version = this.reader.readU2();

        const constant_pool_count = this.reader.readU2();
        this.constantPool = parseConstantPool(this.reader, constant_pool_count);

        const access_flags = this.reader.readU2();
        const this_class = this.reader.readU2();
        const super_class = this.reader.readU2();

        const interfaces_count = this.reader.readU2();
        const interfaces: number[] = [];
        for (let i = 0; i < interfaces_count; i++) {
            interfaces.push(this.reader.readU2());
        }

        const fields_count = this.reader.readU2();
        const fields = this.parseFields(fields_count);

        const methods_count = this.reader.readU2();
        const methods = this.parseMethods(methods_count);

        const attributes_count = this.reader.readU2();
        const attributes = this.parseAttributes(attributes_count, this.reader);

        return {
            magic,
            minor_version,
            major_version,
            constant_pool_count,
            constant_pool: this.constantPool,
            access_flags,
            flags: parseAccessFlags(access_flags),
            this_class,
            this_class_name: readData(this.constantPool, this_class).name,
            super_class,
            super_class_name: readData(this.constantPool, super_class).name,
            interfaces_count,
            interfaces,
            interface_names: interfaces.map((i) => readData(this.constantPool, i).name),
            fields_count,
            fields,
            methods_count,
            methods,
            attributes_count,
            attributes,
        };
    }

    private parseFields(count: number): FieldInfo[] {
        const fields: FieldInfo[] = [];
        for (let i = 0; i < count; i++) {
            const access_flags = this.reader.readU2();
            const name_index = this.reader.readU2();
            const descriptor_index = this.reader.readU2();
            const attributes_count = this.reader.readU2();
            const attributes = this.parseAttributes(attributes_count, this.reader);

            const field: FieldInfo = {
                access_flags,
                flags: parseAccessFlags(access_flags),
                name_index,
                name: readData(this.constantPool, name_index).name,
                descriptor_index,
                descriptor: readData(this.constantPool, descriptor_index).name,
                attributes_count,
                attributes,
            };

            // Cleanup indices
            delete field.name_index;
            delete field.descriptor_index;

            fields.push(field);
        }
        return fields;
    }

    private parseMethods(count: number): MethodInfo[] {
        const methods: MethodInfo[] = [];
        for (let i = 0; i < count; i++) {
            const access_flags = this.reader.readU2();
            const name_index = this.reader.readU2();
            const descriptor_index = this.reader.readU2();
            const attributes_count = this.reader.readU2();
            const attributes = this.parseAttributes(attributes_count, this.reader);

            const method: MethodInfo = {
                access_flags,
                flags: parseAccessFlags(access_flags),
                name_index,
                name: readData(this.constantPool, name_index).name,
                descriptor_index,
                descriptor: readData(this.constantPool, descriptor_index).name,
                attributes_count,
                attributes,
            };

            // Cleanup indices
            delete method.name_index;
            delete method.descriptor_index;

            methods.push(method);
        }
        return methods;
    }

    private parseAttributes(count: number, reader: BufferReader): AttributeInfo[] {
        const attributes: AttributeInfo[] = [];
        for (let i = 0; i < count; i++) {
            const attribute_name_index = reader.readU2();
            const attribute_length = reader.readU4();
            const info = reader.readBytes(attribute_length);

            const attribute: AttributeInfo = {
                attribute_name_index,
                name: readData(this.constantPool, attribute_name_index).name,
                attribute_length,
                info,
            };

            // Parse specific attributes if possible
            this.parseAttributeContent(attribute);

            // Cleanup raw info and index if parsed
            if (attribute.parsed) {
                delete attribute.info;
                // Merge parsed properties directly into attribute object
                Object.assign(attribute, attribute.parsed);
                delete attribute.parsed;
            }
            delete attribute.attribute_name_index;

            attributes.push(attribute);
        }
        return attributes;
    }

    private parseAttributeContent(attribute: AttributeInfo) {
        const nameEntry = this.constantPool[attribute.attribute_name_index];
        if (!nameEntry || nameEntry.tag !== 1) return; // Should be UTF8

        const name = nameEntry.value;
        const reader = new BufferReader(attribute.info);

        if (name === 'Code') {
            const max_stack = reader.readU2();
            const max_locals = reader.readU2();
            const code_length = reader.readU4();
            const code = reader.readBytes(code_length);
            const exception_table_length = reader.readU2();
            const exception_table = [];
            for (let i = 0; i < exception_table_length; i++) {
                const start_pc = reader.readU2();
                const end_pc = reader.readU2();
                const handler_pc = reader.readU2();
                const catch_type = reader.readU2();
                exception_table.push({
                    start_pc,
                    end_pc,
                    handler_pc,
                    catch_type,
                    catch_type_name: catch_type === 0 ? 'any' : readData(this.constantPool, catch_type).name,
                });
            }
            const attributes_count = reader.readU2();
            const attributes = this.parseAttributes(attributes_count, reader);

            attribute.parsed = {
                max_stack,
                max_locals,
                code_length,
                exception_table_length,
                exception_table,
                attributes_count,
                attributes,
                instructions: InstructionParser.fromBytecode(code),
            };
        } else if (name === 'LineNumberTable') {
            const line_number_table_length = reader.readU2();
            const line_number_table = [];
            for (let i = 0; i < line_number_table_length; i++) {
                line_number_table.push({
                    start_pc: reader.readU2(),
                    line_number: reader.readU2(),
                });
            }
            attribute.parsed = {
                line_number_table_length,
                line_number_table,
            };
        } else if (name === 'SourceFile') {
            const sourcefile_index = reader.readU2();
            attribute.parsed = {
                sourcefile_index,
                sourcefile: readData(this.constantPool, sourcefile_index).name,
            };
        } else if (name === 'LocalVariableTable') {
            const local_variable_table_length = reader.readU2();
            const local_variable_table = [];
            for (let i = 0; i < local_variable_table_length; i++) {
                const start_pc = reader.readU2();
                const length = reader.readU2();
                const name_index = reader.readU2();
                const descriptor_index = reader.readU2();
                const index = reader.readU2();
                local_variable_table.push({
                    start_pc,
                    length,
                    name_index,
                    name: readData(this.constantPool, name_index).name,
                    descriptor_index,
                    descriptor: readData(this.constantPool, descriptor_index).name,
                    index,
                });
            }
            attribute.parsed = {
                local_variable_table_length,
                local_variable_table,
            };
        } else if (name === 'Exceptions') {
            const number_of_exceptions = reader.readU2();
            const exception_index_table = [];
            const exception_names = [];
            for (let i = 0; i < number_of_exceptions; i++) {
                const idx = reader.readU2();
                exception_index_table.push(idx);
                exception_names.push(readData(this.constantPool, idx).name);
            }
            attribute.parsed = {
                number_of_exceptions,
                exception_index_table,
                exception_names,
            };
        } else if (name === 'Signature') {
            const signature_index = reader.readU2();
            attribute.parsed = {
                signature_index,
                signature: readData(this.constantPool, signature_index).name,
            };
        } else if (name === 'ConstantValue') {
            const constantvalue_index = reader.readU2();
            const constantValue = this.constantPool[constantvalue_index].value;
            attribute.parsed = {
                constantvalue_index,
                constantValue,
            };
        } else if (name === 'EnclosingMethod') {
            const class_index = reader.readU2();
            const method_index = reader.readU2();
            attribute.parsed = {
                class_index,
                class_name: readData(this.constantPool, class_index).name,
                method_index,
                method_descriptor: method_index > 0 ? readData(this.constantPool, method_index) : null,
            };
        } else if (name === 'InnerClasses') {
            const number_of_classes = reader.readU2();
            const classes = [];
            for (let i = 0; i < number_of_classes; i++) {
                const inner_class_info_index = reader.readU2();
                const outer_class_info_index = reader.readU2();
                const inner_name_index = reader.readU2();
                const inner_class_access_flags = reader.readU2();

                classes.push({
                    inner_class_info_index,
                    inner_class: readData(this.constantPool, inner_class_info_index).name,
                    outer_class_info_index,
                    outer_class: outer_class_info_index > 0 ? readData(this.constantPool, outer_class_info_index).name : null,
                    inner_name_index,
                    inner_name: inner_name_index > 0 ? readData(this.constantPool, inner_name_index).name : null,
                    inner_class_access_flags,
                    inner_class_flags: parseAccessFlags(inner_class_access_flags),
                });
            }
            attribute.parsed = {
                number_of_classes,
                classes,
            };
        } else if (name === 'RuntimeVisibleAnnotations' || name === 'RuntimeInvisibleAnnotations') {
            const num_annotations = reader.readU2();
            const annotations = [];
            for (let i = 0; i < num_annotations; i++) {
                annotations.push(this.parseAnnotation(reader));
            }
            attribute.parsed = {
                num_annotations,
                annotations,
            };
        } else if (name === 'RuntimeVisibleParameterAnnotations' || name === 'RuntimeInvisibleParameterAnnotations') {
            const num_parameters = reader.readU1();
            const parameter_annotations = [];
            for (let i = 0; i < num_parameters; i++) {
                const num_annotations = reader.readU2();
                const annotations = [];
                for (let j = 0; j < num_annotations; j++) {
                    annotations.push(this.parseAnnotation(reader));
                }
                parameter_annotations.push({
                    num_annotations,
                    annotations,
                });
            }
            attribute.parsed = {
                num_parameters,
                parameter_annotations,
            };
        } else if (name === 'AnnotationDefault') {
            attribute.parsed = {
                default_value: this.parseElementValue(reader),
            };
        } else if (name === 'StackMapTable') {
            const number_of_entries = reader.readU2();
            const entries = [];
            for (let i = 0; i < number_of_entries; i++) {
                const frame_type = reader.readU1();
                let frame = {};
                if (frame_type >= 0 && frame_type <= 63) {
                    frame = { type: 'SAME', offset_delta: frame_type };
                } else if (frame_type >= 64 && frame_type <= 127) {
                    frame = { type: 'SAME_LOCALS_1_STACK_ITEM', offset_delta: frame_type - 64, stack: [this.parseVerificationTypeInfo(reader)] };
                } else if (frame_type === 247) {
                    const offset_delta = reader.readU2();
                    frame = { type: 'SAME_LOCALS_1_STACK_ITEM_EXTENDED', offset_delta, stack: [this.parseVerificationTypeInfo(reader)] };
                } else if (frame_type >= 248 && frame_type <= 250) {
                    const offset_delta = reader.readU2();
                    frame = { type: 'CHOP', offset_delta, k: 251 - frame_type };
                } else if (frame_type === 251) {
                    const offset_delta = reader.readU2();
                    frame = { type: 'SAME_FRAME_EXTENDED', offset_delta };
                } else if (frame_type >= 252 && frame_type <= 254) {
                    const offset_delta = reader.readU2();
                    const locals = [];
                    for (let k = 0; k < frame_type - 251; k++) {
                        locals.push(this.parseVerificationTypeInfo(reader));
                    }
                    frame = { type: 'APPEND', offset_delta, locals };
                } else if (frame_type === 255) {
                    const offset_delta = reader.readU2();
                    const number_of_locals = reader.readU2();
                    const locals = [];
                    for (let k = 0; k < number_of_locals; k++) {
                        locals.push(this.parseVerificationTypeInfo(reader));
                    }
                    const number_of_stack_items = reader.readU2();
                    const stack = [];
                    for (let k = 0; k < number_of_stack_items; k++) {
                        stack.push(this.parseVerificationTypeInfo(reader));
                    }
                    frame = { type: 'FULL_FRAME', offset_delta, locals, stack };
                }
                entries.push(frame);
            }
            attribute.parsed = {
                number_of_entries,
                entries,
            };
        } else if (name === 'BootstrapMethods') {
            const num_bootstrap_methods = reader.readU2();
            const bootstrap_methods = [];
            for (let i = 0; i < num_bootstrap_methods; i++) {
                const bootstrap_method_ref = reader.readU2();
                const num_bootstrap_arguments = reader.readU2();
                const bootstrap_arguments = [];
                for (let j = 0; j < num_bootstrap_arguments; j++) {
                    const arg_index = reader.readU2();
                    bootstrap_arguments.push({
                        index: arg_index,
                        value: readData(this.constantPool, arg_index), // Attempt to resolve argument value
                    });
                }
                bootstrap_methods.push({
                    bootstrap_method_ref,
                    bootstrap_method: readData(this.constantPool, bootstrap_method_ref), // Resolve method handle
                    num_bootstrap_arguments,
                    bootstrap_arguments,
                });
            }
            attribute.parsed = {
                num_bootstrap_methods,
                bootstrap_methods,
            };
        } else if (name === 'MethodParameters') {
            const parameters_count = reader.readU1();
            const parameters = [];
            for (let i = 0; i < parameters_count; i++) {
                const name_index = reader.readU2();
                const access_flags = reader.readU2();
                parameters.push({
                    name_index,
                    name: name_index === 0 ? '<no_name>' : readData(this.constantPool, name_index).name,
                    access_flags,
                    flags: parseAccessFlags(access_flags),
                });
            }
            attribute.parsed = {
                parameters_count,
                parameters,
            };
        } else if (name === 'NestHost') {
            const host_class_index = reader.readU2();
            attribute.parsed = {
                host_class_index,
                host_class: readData(this.constantPool, host_class_index).name,
            };
        } else if (name === 'NestMembers') {
            const number_of_classes = reader.readU2();
            const classes = [];
            for (let i = 0; i < number_of_classes; i++) {
                const class_index = reader.readU2();
                classes.push({
                    class_index,
                    class_name: readData(this.constantPool, class_index).name,
                });
            }
            attribute.parsed = {
                number_of_classes,
                classes,
            };
        } else if (name === 'Deprecated') {
            attribute.parsed = {
                is_deprecated: true,
            };
        } else if (name === 'Synthetic') {
            attribute.parsed = {
                is_synthetic: true,
            };
        }
    }

    private parseVerificationTypeInfo(reader: BufferReader): any {
        const tag = reader.readU1();
        switch (tag) {
            case 0: return 'Top';
            case 1: return 'Integer';
            case 2: return 'Float';
            case 3: return 'Double';
            case 4: return 'Long';
            case 5: return 'Null';
            case 6: return 'UninitializedThis';
            case 7: {
                const cpool_index = reader.readU2();
                return { tag: 'Object', class: readData(this.constantPool, cpool_index).name };
            }
            case 8: {
                const offset = reader.readU2();
                return { tag: 'Uninitialized', offset };
            }
            default: return `Unknown(${tag})`;
        }
    }

    private parseAnnotation(reader: BufferReader): any {
        const type_index = reader.readU2();
        const num_element_value_pairs = reader.readU2();
        const pairs: any = {};
        for (let i = 0; i < num_element_value_pairs; i++) {
            const element_name_index = reader.readU2();
            const value = this.parseElementValue(reader);
            const { name } = readData(this.constantPool, element_name_index);
            pairs[name] = value;
        }
        return {
            type: readData(this.constantPool, type_index).name,
            values: pairs,
        };
    }

    private parseElementValue(reader: BufferReader): any {
        const tag = reader.readU1();
        const tagChar = String.fromCharCode(tag);

        switch (tagChar) {
            case 'B':
            case 'C':
            case 'D':
            case 'F':
            case 'I':
            case 'J':
            case 'S':
            case 'Z':
            case 's': {
                const const_value_index = reader.readU2();
                return this.constantPool[const_value_index].value;
            }
            case 'e': {
                const type_name_index = reader.readU2();
                const const_name_index = reader.readU2();
                return {
                    enum_type: readData(this.constantPool, type_name_index).name,
                    enum_const: readData(this.constantPool, const_name_index).name,
                };
            }
            case 'c': {
                const class_info_index = reader.readU2();
                return {
                    class: readData(this.constantPool, class_info_index).name,
                };
            }
            case '@': {
                return this.parseAnnotation(reader);
            }
            case '[': {
                const num_values = reader.readU2();
                const values = [];
                for (let i = 0; i < num_values; i++) {
                    values.push(this.parseElementValue(reader));
                }
                return values;
            }
            default:
                throw new Error(`Unknown element_value tag: ${tag} (${tagChar})`);
        }
    }
}
