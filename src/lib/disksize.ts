import { filesize, type FileSizeOptions } from 'filesize';

const fileSizeOptions: FileSizeOptions = {
	base: 10,
	round: 0,
	standard: 'si'
};

const diskSizeOptions: FileSizeOptions = {
	base: 10,
	round: 2,
	standard: 'si'
};

export function getFormattedMemorySize(exp: number) {
	return filesize(Math.pow(2, exp) * Math.pow(1000, 3), fileSizeOptions);
}

export function getFormattedDiskSize(base: number, multiplier: number = 1) {
	// Expects base size in GB, converts to Bytes for filesize
	// Log inputs for debugging
	console.log(`getFormattedDiskSize called with base: ${base}, multiplier: ${multiplier}`);

	// Apply multiplier to base (if provided)
	const adjustedBase = base * multiplier;

	// Convert to bytes and format
	const result = filesize(adjustedBase * Math.pow(1000, 3), diskSizeOptions);
	console.log(`getFormattedDiskSize result: ${result} (adjusted base: ${adjustedBase}GB)`);
	return result;
}

export function getInverseMemoryExp(size: number): number {
	if (size <= 0) {
		throw new Error('Size must be a positive number.');
	}
	return Math.log2(size);
}

export function computeFilterRange(drives: number[], multiplier: number): [number, number] {
	if (drives.length === 0) {
		return [0, 0];
	}

	const minDrive = Math.min(...drives);
	const maxDrive = Math.max(...drives);

	// Compute filter values by dividing by the multiplier
	const minFilter = Math.floor(minDrive / multiplier);
	const maxFilter = Math.ceil(maxDrive / multiplier);

	return [minFilter, maxFilter];
}
