// Compile contracts with solc-js and emit ABIs + bytecode for the client.
// Usage: node contracts/compile.mjs
import solc from 'solc';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const sources = ['SectorDeed.sol', 'ShipRegistry.sol'];

const input = {
  language: 'Solidity',
  sources: Object.fromEntries(
    sources.map((f) => [f, { content: readFileSync(join(root, f), 'utf8') }])
  ),
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

function findImports(path) {
  try {
    return { contents: readFileSync(join(root, '..', 'node_modules', path), 'utf8') };
  } catch {
    return { error: `not found: ${path}` };
  }
}

const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (out.errors ?? []).filter((e) => e.severity === 'error');
if (errors.length) {
  for (const e of errors) console.error(e.formattedMessage);
  process.exit(1);
}
for (const e of out.errors ?? []) console.warn(e.formattedMessage);

mkdirSync(join(root, 'out'), { recursive: true });
for (const file of sources) {
  for (const [name, c] of Object.entries(out.contracts[file])) {
    writeFileSync(
      join(root, 'out', `${name}.json`),
      JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object }, null, 2)
    );
    console.log(`compiled ${name} (${c.evm.bytecode.object.length / 2} bytes)`);
  }
}
