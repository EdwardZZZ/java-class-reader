import { readInt16BE, readInt8BE } from './bytes';

export default class Operands {
    static SIPUSH(operands: number[], offset: number) {
        try {
            return readInt16BE(operands, offset);
        } catch (err) {
            console.log(err);
            return null;
        }
    }

    static BIPUSH(operands: number[], offset: number) {
        try {
            return readInt8BE(operands, offset);
        } catch (err) {
            console.log(err);
            return null;
        }
    }
}
