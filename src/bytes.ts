export function int2UintBytes(n: number): number[] {
    const bytes = [];
    bytes[0] = n >> 24 & 0xff;
    bytes[1] = n >> 16 & 0xff;
    bytes[2] = n >> 8 & 0xff;
    bytes[3] = n & 0xff;
    return bytes;
}

export function uint2Int(n: number) {
    if (n > 0xff || n < -0x80) throw new Error('OUT_OF_BOUNDS');

    if (n < 128) return n;

    return n - 256;
}

export function readInt8BE(bytes: number[], offset = 0, unsigned = false) {
    const first = bytes[offset];

    if (first === undefined) throw new Error('OUT_OF_BOUNDS');

    return unsigned ? (first & 0xff) : uint2Int(first);
}

export function readInt16BE(bytes: number[], offset = 0, unsigned = false) {
    const first = bytes[offset];

    if (first === undefined || bytes[offset + 1] === undefined) throw new Error('OUT_OF_BOUNDS');

    return (unsigned ? (first << 8) : (uint2Int(first) << 8)) + bytes[offset + 1];
}

export function readInt32BE(bytes: number[], offset = 0, unsigned = false) {
    const first = bytes[offset];

    if (first === undefined || bytes[offset + 3] === undefined) throw new Error('OUT_OF_BOUNDS');

    return (unsigned ? (first * 2 ** 24) : (first << 24))
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
