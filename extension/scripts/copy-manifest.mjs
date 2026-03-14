import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(currentDir, '..');
const source = resolve(extensionRoot, 'manifest.json');
const destination = resolve(extensionRoot, 'dist', 'manifest.json');

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);