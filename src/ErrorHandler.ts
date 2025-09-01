export enum ErrorType {
    PARSE_ERROR = 'PARSE_ERROR',
    INVALID_DATA = 'INVALID_DATA',
    OUT_OF_BOUNDS = 'OUT_OF_BOUNDS',
    UNKNOWN_TYPE = 'UNKNOWN_TYPE'
}

export class ClassReaderError extends Error {
    type: ErrorType;
    details: Record<string, any>;
    
    constructor(message: string, type: ErrorType, details?: Record<string, any>) {
        super(message);
        this.name = 'ClassReaderError';
        this.type = type;
        this.details = details || {};
    }
}

export const handleError = (error: Error, context?: string): never => {
    // 可以在这里添加日志记录逻辑
    console.error(`[ClassReader] ${context ? `${context}: ` : ''}${error.message}`);
    throw error;
};