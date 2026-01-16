export class BufferReader {
    private buffer: Uint8Array;

    private offset: number;

    constructor(buffer: Uint8Array | number[] | Buffer) {
        if (Array.isArray(buffer)) {
            this.buffer = new Uint8Array(buffer);
        } else if (Buffer.isBuffer(buffer)) {
            this.buffer = new Uint8Array(buffer);
        } else {
            this.buffer = buffer as Uint8Array;
        }
        this.offset = 0;
    }

    readU1(): number {
        const val = this.buffer[this.offset];
        this.offset += 1;
        return val;
    }

    readU2(): number {
        const val = (this.buffer[this.offset] << 8) | this.buffer[this.offset + 1];
        this.offset += 2;
        return val;
    }

    readU4(): number {
        const val = (this.buffer[this.offset] * 16777216) // 2^24
                    + (this.buffer[this.offset + 1] << 16)
                    + (this.buffer[this.offset + 2] << 8)
                    + this.buffer[this.offset + 3];
        this.offset += 4;
        return val;
    }

    readBytes(length: number): Uint8Array {
        const bytes = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        return bytes;
    }

    // Helpers for specific types
    readFloat(): number {
        const bytes = this.readBytes(4);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        return view.getFloat32(0, false); // Big Endian
    }

    readDouble(): number {
        const bytes = this.readBytes(8);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        return view.getFloat64(0, false); // Big Endian
    }

    readLong(): bigint {
        const bytes = this.readBytes(8);
        // @ts-ignore
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        return view.getBigInt64(0, false);
    }

    getOffset(): number {
        return this.offset;
    }
}
