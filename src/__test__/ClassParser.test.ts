
import * as fs from 'fs';
import * as path from 'path';
import { ClassReader } from '../index';

describe('ClassParser', () => {
    const testDir = path.resolve(__dirname, 'data');
    
    // Helper to read class file
    const readClassFile = (filename: string) => {
        const filePath = path.resolve(testDir, filename);
        const buffer = fs.readFileSync(filePath);
        const reader = new ClassReader(buffer);
        return reader.getClassFile();
    };

    test('should parse ResultDto$ResultCode.class correctly', () => {
        const result = readClassFile('ResultDto$ResultCode.class');
        
        // Basic Checks
        expect(result.magic).toBe(0xCAFEBABE);
        expect(result.major_version).toBeGreaterThan(0);
        
        // Class Name Resolution
        expect(result.this_class_name).toBe('com.anjuke.netstore.scf.service.business.dto.ResultDto$ResultCode');
        expect(result.super_class_name).toBe('java.lang.Enum');
        
        // Access Flags
        expect(result.flags).toContain('PUBLIC');
        // expect(result.flags).toContain('STATIC'); // Class file header flags usually don't have STATIC for inner classes
        expect(result.flags).toContain('FINAL');
        expect(result.flags).toContain('ENUM');

        // Fields
        expect(result.fields.length).toBeGreaterThan(0);
        const successField = result.fields.find(f => f.name === 'SUCCESS');
        expect(successField).toBeDefined();
        // Descriptor parsing converts slashes to dots and $ to dots for L...; types
        expect(successField?.descriptor).toBe('com.anjuke.netstore.scf.service.business.dto.ResultDto.ResultCode');
        expect(successField?.flags).toContain('PUBLIC');
        expect(successField?.flags).toContain('STATIC');
        expect(successField?.flags).toContain('FINAL');
        expect(successField?.flags).toContain('ENUM');

        // Methods
        const valuesMethod = result.methods.find(m => m.name === 'values');
        expect(valuesMethod).toBeDefined();
        expect(valuesMethod?.flags).toContain('PUBLIC');
        expect(valuesMethod?.flags).toContain('STATIC');
        
        // Code Attribute & Instructions
        const codeAttr = valuesMethod?.attributes.find(a => a.name === 'Code');
        expect(codeAttr).toBeDefined();
        // Check if instructions are parsed and flattened
        expect(codeAttr?.instructions).toBeDefined();
        expect(Array.isArray(codeAttr?.instructions)).toBe(true);
        expect(codeAttr?.instructions.length).toBeGreaterThan(0);
        // Check mnemonics
        expect(codeAttr?.instructions[0].mnemonic).toBeDefined();
        
        // Attributes (InnerClasses)
        const innerClassesAttr = result.attributes.find(a => a.name === 'InnerClasses');
        expect(innerClassesAttr).toBeDefined();
        expect(innerClassesAttr?.classes).toBeDefined();
        expect(innerClassesAttr?.classes.length).toBeGreaterThan(0);
        expect(innerClassesAttr?.classes[0].inner_name).toBe('ResultCode');
    });

    test('should parse CarTypeEnum.class correctly', () => {
        const result = readClassFile('CarTypeEnum.class');
        
        expect(result.magic).toBe(0xCAFEBABE);
        expect(result.this_class_name).toBe('com.bj58.car.meizhou.scf.clue.emuns.CarTypeEnum');
        expect(result.super_class_name).toBe('java.lang.Enum');
        
        // Check Enum constants
        const truckField = result.fields.find(f => f.name === 'truck');
        expect(truckField).toBeDefined();
        expect(truckField?.flags).toContain('ENUM');
    });
});
