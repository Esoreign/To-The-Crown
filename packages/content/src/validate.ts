import type { ContentDefs, WorldData } from '@ttc/shared';

/**
 * Validation stricte du monde et du contenu. Utilisée par le script
 * `world:validate`, par les tests et au démarrage du serveur (fail fast).
 */
export function validateWorld(world: WorldData): string[] {
  const errors: string[] = [];
  const provinceIds = new Set<string>();
  const titleIds = new Map(world.titles.map((t) => [t.id, t]));

  if (titleIds.size !== world.titles.length) errors.push('Identifiants de titres dupliqués');

  for (const p of world.provinces) {
    if (provinceIds.has(p.id)) errors.push(`Province dupliquée : ${p.id}`);
    provinceIds.add(p.id);
    const [lon, lat] = p.centroid;
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) errors.push(`${p.id} : coordonnées invalides`);
    if (!p.name) errors.push(`${p.id} : nom manquant`);
    if (!(p.area > 0)) errors.push(`${p.id} : superficie invalide`);
    for (const key of ['countyTitleId', 'duchyTitleId', 'kingdomTitleId', 'empireTitleId'] as const) {
      if (!titleIds.has(p[key])) errors.push(`${p.id} : titre inexistant ${p[key]}`);
    }
    const county = titleIds.get(p.countyTitleId);
    if (county && county.deJureParentId !== p.duchyTitleId) errors.push(`${p.id} : hiérarchie comté/duché incohérente`);
    const duchy = titleIds.get(p.duchyTitleId);
    if (duchy && duchy.deJureParentId !== p.kingdomTitleId) errors.push(`${p.id} : hiérarchie duché/royaume incohérente`);
    const kingdom = titleIds.get(p.kingdomTitleId);
    if (kingdom && kingdom.deJureParentId !== p.empireTitleId) errors.push(`${p.id} : hiérarchie royaume/empire incohérente`);
  }

  const byId = new Map(world.provinces.map((p) => [p.id, p]));
  const seaIds = new Set(world.seas.map((s) => s.id));
  for (const p of world.provinces) {
    for (const n of p.neighbors) {
      const other = byId.get(n);
      if (!other) errors.push(`${p.id} : voisin inconnu ${n}`);
      else if (!other.neighbors.includes(p.id)) errors.push(`${p.id} ↔ ${n} : voisinage non symétrique`);
      if (n === p.id) errors.push(`${p.id} : voisin de lui-même`);
    }
    for (const n of p.straits) {
      const other = byId.get(n);
      if (!other || !other.straits.includes(p.id)) errors.push(`${p.id} ↔ ${n} : détroit non symétrique`);
    }
    for (const s of p.seas) if (!seaIds.has(s)) errors.push(`${p.id} : zone maritime inconnue ${s}`);
    // Une province sans voisin terrestre doit au moins toucher la mer (île).
    if (p.neighbors.length + p.straits.length === 0 && p.seas.length === 0) errors.push(`${p.id} : isolée (ni voisin ni mer)`);
  }

  for (const t of world.titles) {
    if (t.deJureParentId && !titleIds.has(t.deJureParentId)) errors.push(`${t.id} : parent inconnu`);
    if (t.rank === 'county' && (!t.provinceId || !provinceIds.has(t.provinceId))) errors.push(`${t.id} : province manquante`);
    if (!provinceIds.has(t.capitalProvinceId)) errors.push(`${t.id} : capitale inconnue ${t.capitalProvinceId}`);
  }
  const counties = world.titles.filter((t) => t.rank === 'county');
  if (counties.length !== world.provinces.length) errors.push('Chaque province doit avoir exactement un comté');
  return errors;
}

export function validateContent(defs: ContentDefs): string[] {
  const errors: string[] = [];
  const traitIds = new Set(defs.traits.map((t) => t.id));
  if (traitIds.size !== defs.traits.length) errors.push('Traits dupliqués');
  for (const t of defs.traits) {
    for (const o of t.opposites ?? []) if (!traitIds.has(o)) errors.push(`Trait ${t.id} : opposé inconnu ${o}`);
  }
  const buildingIds = new Set(defs.buildings.map((b) => b.id));
  for (const b of defs.buildings) {
    if (b.cost.length !== b.maxLevel || b.days.length !== b.maxLevel) errors.push(`Bâtiment ${b.id} : coûts/durées incohérents`);
    if (b.requires?.building && !buildingIds.has(b.requires.building.id)) errors.push(`Bâtiment ${b.id} : prérequis inconnu`);
  }
  const eventIds = new Set<string>();
  for (const e of defs.events) {
    if (eventIds.has(e.id)) errors.push(`Événement dupliqué : ${e.id}`);
    eventIds.add(e.id);
    if (e.choices.length < 1 || e.choices.length > 4) errors.push(`Événement ${e.id} : 1 à 4 choix attendus`);
    const choiceIds = new Set<string>();
    for (const c of e.choices) {
      if (choiceIds.has(c.id)) errors.push(`Événement ${e.id} : choix dupliqué ${c.id}`);
      choiceIds.add(c.id);
    }
  }
  // Références d'événements chaînés et de traits dans les effets.
  const walk = (node: unknown, ctx: string): void => {
    if (Array.isArray(node)) {
      node.forEach((n) => walk(n, ctx));
      return;
    }
    if (!node || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if (typeof o.addTrait === 'string' && !traitIds.has(o.addTrait)) errors.push(`${ctx} : trait inconnu ${o.addTrait}`);
    if (typeof o.removeTrait === 'string' && !traitIds.has(o.removeTrait)) errors.push(`${ctx} : trait inconnu ${o.removeTrait}`);
    if (typeof o.hasTrait === 'string' && !traitIds.has(o.hasTrait)) errors.push(`${ctx} : trait inconnu ${o.hasTrait}`);
    const trig = o.triggerEvent as { id?: string } | undefined;
    if (trig && typeof trig === 'object' && trig.id && !eventIds.has(trig.id)) errors.push(`${ctx} : événement inconnu ${trig.id}`);
    for (const v of Object.values(o)) walk(v, ctx);
  };
  for (const e of defs.events) walk(e, `Événement ${e.id}`);
  return errors;
}
