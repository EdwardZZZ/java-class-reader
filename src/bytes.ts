export function int2UintBytes(n: number): number[] {
    const bytes = [];
    bytes[0] = n >> 24 & 0xff;
    bytes[1] = n >> 16 & 0xff;
    bytes[2] = n >> 8 & 0xff;
    bytes[3] = n & 0xff;
    return bytes;
}

export function readIntBE(bytes: number[], offset = 0) {
    if (bytes[offset] === undefined) throw new Error('OUT_OF_BOUNDS');

    const val = this[offset];

    return val | (val & 2 ** 7) * 0x1fffffe;
}

export function readInt16BE(bytes: number[], offset = 0) {
    if (bytes[offset] === undefined || bytes[offset + 1] === undefined) throw new Error('OUT_OF_BOUNDS');

    const val = bytes[offset] * 2 ** 8 + bytes[offset + 1];

    return val | (val & 2 ** 15) * 0x1fffe;
}

export function readInt32BE(bytes: number[], offset = 0, unsigned = false) {
    if (bytes[offset] === undefined || bytes[offset + 3] === undefined) throw new Error('OUT_OF_BOUNDS');

    return (unsigned ? (bytes[offset] * 2 ** 24) : (bytes[offset] << 24))
        + bytes[++offset] * 2 ** 16
        + bytes[++offset] * 2 ** 8
        + bytes[++offset];
}

export function readBigInt64BE(bytes: number[], offset = 0) {
    if (bytes[offset] === undefined || bytes[offset + 7] === undefined) throw new Error('OUT_OF_BOUNDS');

    /* global BigInt */
    return (BigInt(readInt32BE(bytes, offset)) << 32n)
        + BigInt(readInt32BE(bytes, offset + 4, true));
}

export function bytes2String(bytes: Buffer) {
    if (bytes instanceof Array) {
        const strArr = [];
        for (let i = 0; i < bytes.length; i++) {
            const binary = bytes[i].toString(2);
            const r = binary.match(/^(1+)0/);
            if (r && binary.length === 8) {
                let len = r[1].length;
                let code = bytes[i] & (len === 4 ? 0xf : 0x1f);
                while (--len) {
                    code = (code << 6) | (bytes[++i] & 0x3f);
                }
                strArr.push(String.fromCodePoint(code));
            } else {
                strArr.push(String.fromCharCode(bytes[i]));
            }
        }
        return strArr.join('');
    }
    return bytes.toString();
}
