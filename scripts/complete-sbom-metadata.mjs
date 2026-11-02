import { readFile, writeFile } from 'node:fs/promises';

const sbomPath = new URL('../doc/SBOM.json', import.meta.url);
const sbom = JSON.parse(await readFile(sbomPath, 'utf8'));

sbom.metadata.supplier = { name: 'FieldDay' };
sbom.metadata.timestamp = new Date().toISOString();
await writeFile(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`);