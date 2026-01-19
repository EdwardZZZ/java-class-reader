export interface ClassFile {
    magic: number;
    minor_version: number;
    major_version: number;
    constant_pool_count: number;
    constant_pool: ConstantPoolInfo[];
    access_flags: number;
    flags: string[]; // Resolved
    this_class: number;
    this_class_name?: string; // Resolved
    super_class: number;
    super_class_name?: string; // Resolved
    interfaces_count: number;
    interfaces: number[];
    interface_names?: string[]; // Resolved
    fields_count: number;
    fields: FieldInfo[];
    methods_count: number;
    methods: MethodInfo[];
    attributes_count: number;
    attributes: AttributeInfo[];
    enum_values?: EnumValue[];
}

export interface EnumValue {
    name: string;
    ordinal?: number;
    params: { [key: string]: any };
}

export interface ConstantPoolInfo {
    tag: number;
    [key: string]: any;
    // Resolved values
    name?: string;
    class_name?: string;
    descriptor?: string;
    string_value?: string;
    bootstrap_method_attr_index?: number;
    reference_kind?: number;
    reference_index?: number;
}

export interface FieldInfo {
    access_flags: number;
    flags: string[]; // Resolved
    name_index: number;
    name?: string; // Resolved
    descriptor_index: number;
    descriptor?: string; // Resolved
    attributes_count: number;
    attributes: AttributeInfo[];
}

export interface MethodInfo {
    access_flags: number;
    flags: string[]; // Resolved
    name_index: number;
    name?: string; // Resolved
    descriptor_index: number;
    descriptor?: string; // Resolved
    attributes_count: number;
    attributes: AttributeInfo[];
    parameters?: Array<{ name?: string; type: string }>; // Parsed method parameters with name and type
}

export interface AttributeInfo {
    attribute_name_index: number;
    name?: string; // Resolved
    attribute_length: number;
    info?: Uint8Array;
    // Parsed attribute data will be added here
    parsed?: any;
    // Allow dynamic properties for flattened attributes
    [key: string]: any;
}

export interface InnerClassInfo {
    inner_class_info_index: number;
    inner_class?: string;
    outer_class_info_index: number;
    outer_class?: string;
    inner_name_index: number;
    inner_name?: string;
    inner_class_access_flags: number;
    inner_class_flags?: string[]; // Resolved
}

export enum ConstantType {
    UTF8 = 1,
    INTEGER = 3,
    FLOAT = 4,
    LONG = 5,
    DOUBLE = 6,
    CLASS = 7,
    STRING = 8,
    FIELDREF = 9,
    METHODREF = 10,
    INTERFACE_METHODREF = 11,
    NAME_AND_TYPE = 12,
    METHOD_HANDLE = 15,
    METHOD_TYPE = 16,
    DYNAMIC = 17,
    INVOKE_DYNAMIC = 18,
    MODULE = 19,
    PACKAGE = 20
}

export enum AccessFlags {
    ACC_PUBLIC = 0x0001,
    ACC_PRIVATE = 0x0002,
    ACC_PROTECTED = 0x0004,
    ACC_STATIC = 0x0008,
    ACC_FINAL = 0x0010,
    ACC_SUPER = 0x0020,
    ACC_SYNCHRONIZED = 0x0020,
    ACC_VOLATILE = 0x0040,
    ACC_BRIDGE = 0x0040,
    ACC_TRANSIENT = 0x0080,
    ACC_VARARGS = 0x0080,
    ACC_NATIVE = 0x0100,
    ACC_INTERFACE = 0x0200,
    ACC_ABSTRACT = 0x0400,
    ACC_STRICT = 0x0800,
    ACC_SYNTHETIC = 0x1000,
    ACC_ANNOTATION = 0x2000,
    ACC_ENUM = 0x4000,
    ACC_MODULE = 0x8000
}

export const BaseType: { [key: string]: string } = {
    Z: 'boolean',
    B: 'byte',
    C: 'char',
    D: 'double',
    F: 'float',
    I: 'int',
    J: 'long',
    S: 'short',
};

export const BaseTypeKeys = Object.keys(BaseType);
