import { filesize, type FileSizeOptions } from 'filesize';

const fileSizeOptions: FileSizeOptions = {
    base: 10,
    round: 0,
    standard: "si",
};

const diskSizeOptions: FileSizeOptions = {
    base: 10,
    round: 2,
    standard: "si",
};

export function getFormattedMemorySize(exp: number) {
    return filesize(
        Math.pow(2, exp) * Math.pow(1000, 3),
        fileSizeOptions
    );
}

export function getFormattedDiskSize(base: number) {
    return filesize(
        base * Math.pow(1000, 3),
        diskSizeOptions
    );
}

export function getInverseMemoryExp(size: number): number {
    if (size <= 0) {
        throw new Error('Size must be a positive number.');
    }
    const baseSize = Math.pow(1000, 3);
    return Math.log2(size / baseSize);
}

export function getInverseDiskBase(size: number): number {
    if (size < 0) {
        throw new Error('Size cannot be negative.');
    }
    const baseSize = Math.pow(1000, 3);
    return size / baseSize;
}

export function getFormattedDiskStepSize(base: number, step: number = 250) {
    return filesize(
        base * step * Math.pow(1000, 3),
        diskSizeOptions
    );
}
