/**
 * Nodejs Buffer 预览是 Uint
 */

/**
 * int to bytes
 * @param n int val
 * return number[]
 */
export function int2UintBytes(n: number): number[] {
    const bytes = [];
    bytes[0] = n >> 24 & 0xff;
    bytes[1] = n >> 16 & 0xff;
    bytes[2] = n >> 8 & 0xff;
    bytes[3] = n & 0xff;
    return bytes;
}

/**
 * uint to byte
 * @param n uint val
 * return number
 */
export function uint2Byte(n: number) {
    if (n > 0xff || n < -0x80) throw new Error('OUT_OF_BOUNDS');

    if (n < 128) return n;

    return n - 256;
}

/**
 * read byte[1]
 * @param bytes byte[1]
 * @param offset offset default 0
 * @param unsigned unsigned default false
 */
export function readInt8BE(bytes: number[], offset = 0, unsigned = false) {
    const first = bytes[offset];

    if (first === undefined) throw new Error('OUT_OF_BOUNDS');

    return unsigned ? first : uint2Byte(first);
}

/**
 * read byte[2]
 * @param bytes byte[2]
 * @param offset offset default 0
 * @param unsigned unsigned default false
 */
export function readInt16BE(bytes: number[], offset = 0, unsigned = false) {
    const first = bytes[offset];

    if (first === undefined || bytes[offset + 1] === undefined) throw new Error('OUT_OF_BOUNDS');

    return (unsigned ? (first << 8) : (uint2Byte(first) << 8)) + bytes[offset + 1];
}

/**
 * read byte[4]
 * @param bytes byte[4]
 * @param offset offset default 0
 * @param unsigned unsigned default false
 */
export function readInt32BE(bytes: number[], offset = 0, unsigned = false) {
    const first = bytes[offset];

    if (first === undefined || bytes[offset + 3] === undefined) throw new Error('OUT_OF_BOUNDS');

    return (unsigned ? (first * 2 ** 24) : (first << 24))
        + bytes[++offset] * 2 ** 16
        + bytes[++offset] * 2 ** 8
        + bytes[++offset];
}

/**
 * read byte[8]
 * @param bytes byte[8]
 * @param offset offset default 0
 */
export function readBigInt64BE(bytes: number[], offset = 0) {
    if (bytes[offset] === undefined || bytes[offset + 7] === undefined) throw new Error('OUT_OF_BOUNDS');

    /* global BigInt */
    return (BigInt(readInt32BE(bytes, offset)) << 32n)
        + BigInt(readInt32BE(bytes, offset + 4, true));
}

/**
 * bytes to string
 * @param bytes Buffer
 */
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
