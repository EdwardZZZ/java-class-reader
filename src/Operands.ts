export default class Operands {
    static SIPUSH(operands: number[]) {
        try {
            return Buffer.from(operands).readInt16BE(0);
        } catch (err) {
            console.log(err);
            return null;
        }
    }

    static BIPUSH(operands: number[]) {
        try {
            return Buffer.from(operands).readIntBE(0, 1);
        } catch (err) {
            console.log(err);
            return null;
        }
    }
}
