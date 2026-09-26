import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Worker MapLibre', () => {
  it('est empaqueté par Vite (le fichier brut importe un module absent du site publié)', () => {
    const src = readFileSync(new URL('./WorldMap.ts', import.meta.url), 'utf8');
    expect(src).toContain("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'");
    expect(src).not.toMatch(/maplibre-gl-worker\.mjs\?url'/);
  });
});
