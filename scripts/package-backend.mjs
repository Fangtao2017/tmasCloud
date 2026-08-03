import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendDist = path.join(repoRoot, 'frontend', 'dist');
const backendPublic = path.join(repoRoot, 'backend', 'public');

await rm(backendPublic, { recursive: true, force: true });
await mkdir(backendPublic, { recursive: true });
await cp(frontendDist, backendPublic, { recursive: true });
console.log(`Copied ${frontendDist} to ${backendPublic}`);
