import { readInt16BE, readInt8BE } from './bytes';

export default class Operands {
    static SIPUSH(operands: number[]) {
        try {
            return readInt16BE(operands, 0);
        } catch (err) {
            console.log(err);
            return null;
        }
    }

    static BIPUSH(operands: number[]) {
        try {
            return readInt8BE(operands, 0);
        } catch (err) {
            console.log(err);
            return null;
        }
    }
}
