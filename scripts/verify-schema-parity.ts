import * as ts from 'typescript';
import { readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const SCHEMA_DIR = 'shared/schema';
const LEGACY_SCHEMA = 'shared/schema.ts';

function getExportsFromFile(filePath: string): string[] {
  const absolutePath = resolve(filePath);
  const program = ts.createProgram([absolutePath], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    esModuleInterop: true,
    skipLibCheck: true,
  });
  
  const sourceFile = program.getSourceFile(absolutePath);
  if (!sourceFile) {
    console.error(`Could not load: ${filePath}`);
    return [];
  }
  
  const exports: string[] = [];
  const checker = program.getTypeChecker();
  const symbol = checker.getSymbolAtLocation(sourceFile);
  
  if (symbol) {
    const exportedSymbols = checker.getExportsOfModule(symbol);
    for (const exp of exportedSymbols) {
      exports.push(exp.getName());
    }
  }
  return exports;
}

// Get legacy exports
console.log('Analyzing legacy schema...');
const legacyExports = getExportsFromFile(LEGACY_SCHEMA);
console.log(`Legacy exports: ${legacyExports.length}`);

// Get all modular exports
console.log('\nAnalyzing modular schema...');
const modularExports: string[] = [];

// Root files
const rootFiles = readdirSync(SCHEMA_DIR).filter(f => f.endsWith('.ts') && f !== 'index.ts');
for (const file of rootFiles) {
  const exports = getExportsFromFile(join(SCHEMA_DIR, file));
  modularExports.push(...exports);
  console.log(`  ${file}: ${exports.length} exports`);
}

// Common directory
const commonDir = join(SCHEMA_DIR, 'common');
if (existsSync(commonDir)) {
  const commonFiles = readdirSync(commonDir).filter(f => f.endsWith('.ts'));
  for (const file of commonFiles) {
    const exports = getExportsFromFile(join(commonDir, file));
    modularExports.push(...exports);
    console.log(`  common/${file}: ${exports.length} exports`);
  }
}

// Domain directories
const domainDirs = readdirSync(SCHEMA_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name !== 'common')
  .map(d => d.name);

for (const domain of domainDirs) {
  const domainPath = join(SCHEMA_DIR, domain);
  const files = readdirSync(domainPath).filter(f => f.endsWith('.ts') && f !== 'index.ts');
  let domainTotal = 0;
  for (const file of files) {
    const exports = getExportsFromFile(join(domainPath, file));
    modularExports.push(...exports);
    domainTotal += exports.length;
  }
  console.log(`  ${domain}/: ${domainTotal} exports`);
}

// Dedupe
const modularSet = new Set(modularExports);
const legacySet = new Set(legacyExports);

console.log(`\nModular exports (unique): ${modularSet.size}`);

// Find discrepancies
const missing = legacyExports.filter(e => !modularSet.has(e));
const extra = [...modularSet].filter(e => !legacySet.has(e));

console.log('\n=== PARITY REPORT ===');
if (missing.length > 0) {
  console.log(`\nMISSING from modular (${missing.length}):`);
  missing.slice(0, 20).forEach(e => console.log(`  - ${e}`));
  if (missing.length > 20) console.log(`  ... and ${missing.length - 20} more`);
}

if (extra.length > 0) {
  console.log(`\nEXTRA in modular (${extra.length}):`);
  extra.slice(0, 10).forEach(e => console.log(`  + ${e}`));
  if (extra.length > 10) console.log(`  ... and ${extra.length - 10} more`);
}

if (missing.length === 0) {
  console.log('\n✓ All legacy exports present in modular schema');
  process.exit(0);
} else {
  console.log(`\n❌ ${missing.length} exports missing - parity check FAILED`);
  process.exit(1);
}
