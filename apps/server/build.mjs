// Bundle du serveur : les paquets du monorepo (@ttc/*) sont intégrés,
// les dépendances npm restent externes.
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((d) => !d.startsWith('@ttc/'));

await build({
  entryPoints: ['src/index.ts', 'src/db/migrate.ts', 'src/db/seed.ts'],
  outdir: 'dist',
  outbase: 'src',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  external,
  loader: { '.json': 'json' },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
});
