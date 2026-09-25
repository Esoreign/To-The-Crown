import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getScenario } from '@ttc/content';
import { PROTOCOL_VERSION, type AckMessage, type GameView, type PatchMessage, type SnapshotMessage, type ChatMessage, type LobbyState } from '@ttc/shared';
import { domainProvinceIds, buildOptions } from '@ttc/game-core';
import { eq } from 'drizzle-orm';
import { users, gameCommands } from '../src/db/schema';
import { Client, emitAck, once, startServer, waitFor } from './helpers';

const scenario = getScenario('monde_1400');
const byName = (n: string) => scenario.recommended.find((r) => scenario.characters[r.characterId]!.firstName === n)!.characterId;

let app: FastifyInstance;
let url: string;

beforeAll(async () => {
  ({ app, url } = await startServer());
});
afterAll(async () => {
  await app.close();
});

describe('Authentification', () => {
  it('inscription, session, déconnexion', async () => {
    const c = new Client(url);
    const user = await c.register('Aude');
    const me = await c.req<{ user: { id: string } }>('GET', '/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(user.id);
    expect(c.cookie).toMatch(/^ttc_session=/);
    const out = await c.req('POST', '/api/auth/logout');
    expect(out.status).toBe(200);
    // Le jeton révoqué ne fonctionne plus, même réutilisé.
    const stale = new Client(url);
    stale.cookie = c.cookie;
    expect((await stale.req('GET', '/api/auth/me')).status).toBe(401);
    const session = await stale.req<{ user: null }>('GET', '/api/auth/session');
    expect(session.status).toBe(200);
    expect(session.body.user).toBeNull();
  });

  it('ne stocke jamais le mot de passe en clair (Argon2id)', async () => {
    const c = new Client(url);
    const user = await c.register('Hash');
    const rows = await app.db.select().from(users).where(eq(users.id, user.id));
    expect(rows[0]!.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(rows[0]!.passwordHash).not.toContain('motdepasse42');
  });

  it('refuse identifiants invalides, doublons et mots de passe faibles', async () => {
    const c = new Client(url);
    const email = `dup-${Date.now()}@test.local`;
    expect((await c.req('POST', '/api/auth/register', { email, username: `Dup${Date.now()}`, password: 'motdepasse42' })).status).toBe(201);
    const dup = await new Client(url).req<{ error: { code: string } }>('POST', '/api/auth/register', { email, username: `Other${Date.now()}`, password: 'motdepasse42' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
    const weak = await new Client(url).req('POST', '/api/auth/register', { email: `w${Date.now()}@t.l`, username: `Weak${Date.now()}`, password: 'abc' });
    expect(weak.status).toBe(400);
    const bad = await new Client(url).req<{ error: { code: string } }>('POST', '/api/auth/login', { email, password: 'mauvais-mot-2' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');
    const ok = await new Client(url).req('POST', '/api/auth/login', { email, password: 'motdepasse42' });
    expect(ok.status).toBe(200);
  });

  it('limite les tentatives de connexion', async () => {
    const email = `brute-${Date.now()}@test.local`;
    let last = 0;
    for (let i = 0; i < 10; i++) last = (await new Client(url).req('POST', '/api/auth/login', { email, password: `x${i}yyyyyy` })).status;
    expect(last).toBe(429);
  });

  it('refuse les requêtes mutantes sans en-tête anti-CSRF ni origine valide', async () => {
    const res = await fetch(`${url}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(403);
    const evil = await fetch(`${url}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}' });
    expect(evil.status).toBe(403);
  });

  it('exige une session pour les parties et refuse les payloads malformés', async () => {
    expect((await new Client(url).req('GET', '/api/games')).status).toBe(401);
    const c = new Client(url);
    await c.register('Malformed');
    const bad = await c.req('POST', '/api/games', { name: 1, mode: 'x' });
    expect(bad.status).toBe(400);
  });

  it('expose santé et disponibilité', async () => {
    expect((await new Client(url).req('GET', '/api/health')).status).toBe(200);
    const ready = await new Client(url).req<{ checks: Record<string, string> }>('GET', '/api/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.checks.database).toBe('ok');
  });
});

describe('Partie solo', () => {
  it('crée, rejoint, joue une commande validée par le serveur et persiste', async () => {
    const c = new Client(url);
    await c.register('Solo');
    const thalos = byName('Thalos');
    const created = await c.req<{ id: string; status: string }>('POST', '/api/games', { name: 'Ma saga', mode: 'solo', characterId: thalos });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('running');
    const gameId = created.body.id;

    const socket = c.socket();
    const snapP = once<SnapshotMessage>(socket, 'game:snapshot');
    const joined = await emitAck<{ ok: boolean }>(socket, 'game:join', { gameId, protocolVersion: PROTOCOL_VERSION });
    expect(joined.ok).toBe(true);
    const snap = await snapP;
    expect(snap.you.characterId).toBe(thalos);
    expect('rng' in snap.view).toBe(false);
    let view: GameView = snap.view;

    // Commande réelle : construction.
    const me = view.characters[thalos]!;
    const pick = domainProvinceIds(me)
      .flatMap((p) => buildOptions({ ...view, rng: [1, 2, 3, 4] } as never, p, thalos).map((o) => ({ p, o })))
      .find((x) => x.o.available)!;
    const patchP = once<PatchMessage>(socket, 'game:patch');
    const ack = await emitAck<AckMessage>(socket, 'game:command', {
      commandId: `cmd-${Date.now()}-1`,
      command: { type: 'building.construct', payload: { provinceId: pick.p, buildingId: pick.o.def.id } },
    });
    expect(ack.ok).toBe(true);
    const patch = await patchP;
    expect(patch.ops.some((o) => o.path[0] === 'provinces' && o.path[1] === pick.p)).toBe(true);

    // Idempotence : même commandId ⇒ même accusé, aucune double dépense.
    const room = app.rooms.get(gameId)!;
    const goldAfter = room.state.characters[thalos]!.gold;
    const again = await emitAck<AckMessage>(socket, 'game:command', {
      commandId: ack.commandId,
      command: { type: 'building.construct', payload: { provinceId: pick.p, buildingId: pick.o.def.id } },
    });
    expect(again).toEqual(ack);
    expect(room.state.characters[thalos]!.gold).toBe(goldAfter);

    // Le client ne peut pas imposer un résultat : commande dev refusée ? (activée en test) → type inconnu refusé.
    const forged = await emitAck<AckMessage>(socket, 'game:command', { commandId: `cmd-${Date.now()}-2`, command: { type: 'gold.set', payload: { gold: 999999 } } });
    expect(forged.ok).toBe(false);
    expect(forged.error!.code).toBe('INVALID_COMMAND');

    // Refus métier : armée d'autrui.
    const foreign = await emitAck<AckMessage>(socket, 'game:command', { commandId: `cmd-${Date.now()}-3`, command: { type: 'army.move', payload: { armyId: 'ar_nope', to: 'p001' } } });
    expect(foreign.ok).toBe(false);
    expect(foreign.error!.code).toBe('ARMY_NOT_OWNED');

    // Le temps avance côté serveur uniquement.
    const startDate = room.state.date;
    socket.emit('time:set', { gameId, speed: 3 });
    await waitFor(() => room.state.date > startDate + 5);
    socket.emit('pause:request', { gameId, paused: true });
    await waitFor(() => room.paused);
    socket.on('game:patch', (p: PatchMessage) => {
      view = { ...view, date: p.date };
    });

    // Sauvegarde puis rechargement depuis la base.
    await room.save('test');
    const savedDate = room.state.date;
    await app.rooms.unload(gameId);
    const reloaded = await app.rooms.load(gameId);
    expect(reloaded!.state.date).toBe(savedDate);
    expect(reloaded!.state.provinces[pick.p]!.construction).not.toBeNull();
    const cmds = await app.db.select().from(gameCommands).where(eq(gameCommands.gameId, gameId));
    expect(cmds.filter((x) => x.status === 'ok')).toHaveLength(1);
    socket.close();
  });

  it('interdit à un autre utilisateur de rejoindre une partie privée', async () => {
    const owner = new Client(url);
    await owner.register('Owner');
    const g = await owner.req<{ id: string }>('POST', '/api/games', { name: 'Privée', mode: 'solo', characterId: byName('Morcant') });
    const intruder = new Client(url);
    await intruder.register('Intrus');
    const s = intruder.socket();
    const r = await emitAck<{ ok: boolean; error?: { code: string } }>(s, 'game:join', { gameId: g.body.id, protocolVersion: PROTOCOL_VERSION });
    expect(r.ok).toBe(false);
    expect(r.error!.code).toBe('NOT_GAME_MEMBER');
    expect((await intruder.req('GET', `/api/games/${g.body.id}`)).status).toBe(403);
    s.close();
  });

  it('refuse une socket non authentifiée et un protocole incompatible', async () => {
    const anon = new Client(url).socket();
    const err = await once<Error>(anon, 'connect_error');
    expect(err.message).toBe('AUTH_REQUIRED');
    anon.close();
    const c = new Client(url);
    await c.register('Proto');
    const s = c.socket();
    const r = await emitAck<{ ok: boolean; error?: { code: string } }>(s, 'game:join', { gameId: crypto.randomUUID(), protocolVersion: 999 });
    expect(r.error!.code).toBe('PROTOCOL_MISMATCH');
    s.close();
  });
});

describe('Multijoueur', () => {
  it('lobby, sélection, lancement, synchronisation, chat et reconnexion', async () => {
    const alice = new Client(url);
    const bob = new Client(url);
    const aliceUser = await alice.register('Alice');
    const bobUser = await bob.register('Bob');
    const created = await alice.req<{ id: string }>('POST', '/api/games', { name: 'Caldria à deux', mode: 'multiplayer', maxPlayers: 4 });
    const gameId = created.body.id;
    const info = await alice.req<{ game: { inviteCode: string } }>('GET', `/api/games/${gameId}`);
    const code = info.body.game.inviteCode;
    expect(code).toHaveLength(8);

    // Bob rejoint avec le code.
    expect((await bob.req('POST', '/api/games/join', { inviteCode: 'MAUVAIS1' })).status).toBe(404);
    const j = await bob.req<{ id: string }>('POST', '/api/games/join', { inviteCode: code });
    expect(j.body.id).toBe(gameId);

    const aSock = alice.socket();
    const bSock = bob.socket();
    const lobby = await emitAck<{ ok: boolean; data: LobbyState }>(aSock, 'lobby:join', { gameId });
    expect(lobby.data.players).toHaveLength(2);
    await emitAck(bSock, 'lobby:join', { gameId });

    // Même souverain interdit.
    const aelis = byName('Aélis');
    const aldren = byName('Aldren');
    expect((await alice.req('POST', `/api/games/${gameId}/select`, { characterId: aelis })).status).toBe(200);
    const clash = await bob.req<{ error: { code: string } }>('POST', `/api/games/${gameId}/select`, { characterId: aelis });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('CHARACTER_TAKEN');
    expect((await bob.req('POST', `/api/games/${gameId}/select`, { characterId: aldren })).status).toBe(200);

    // Lancement refusé tant que Bob n'est pas prêt ; Bob ne peut pas lancer.
    expect((await alice.req('POST', `/api/games/${gameId}/start`)).status).toBe(409);
    expect((await bob.req('POST', `/api/games/${gameId}/ready`, { ready: true })).status).toBe(200);
    expect((await bob.req('POST', `/api/games/${gameId}/start`)).status).toBe(403);
    const started = once<{ gameId: string }>(bSock, 'lobby:started');
    expect((await alice.req('POST', `/api/games/${gameId}/start`)).status).toBe(200);
    await started;

    const aSnap = once<SnapshotMessage>(aSock, 'game:snapshot');
    const bSnap = once<SnapshotMessage>(bSock, 'game:snapshot');
    await emitAck(aSock, 'game:join', { gameId, protocolVersion: PROTOCOL_VERSION });
    await emitAck(bSock, 'game:join', { gameId, protocolVersion: PROTOCOL_VERSION });
    const [sa, sb] = await Promise.all([aSnap, bSnap]);
    expect(sa.you.characterId).toBe(aelis);
    expect(sb.you.characterId).toBe(aldren);
    expect(sa.view.date).toBe(sb.view.date);

    // Bob ne contrôle pas l'horloge ; Alice (hôte) oui.
    const room = app.rooms.get(gameId)!;
    bSock.emit('time:set', { gameId, speed: 3 });
    await new Promise((r) => setTimeout(r, 200));
    expect(room.paused).toBe(true);
    aSock.emit('time:set', { gameId, speed: 3 });
    await waitFor(() => room.state.date >= sa.view.date + 50, 20_000);
    aSock.emit('pause:request', { gameId, paused: true });
    await waitFor(() => room.paused);

    // Action d'Alice visible chez Bob : cadeau à Aldren.
    let bobGold = 0;
    const bPatch = new Promise<void>((resolve) => {
      bSock.on('game:patch', (p: PatchMessage) => {
        for (const op of p.ops) if (op.path[0] === 'characters' && op.path[1] === aldren && op.path[2] === 'gold') bobGold = op.value as number;
        if (bobGold) resolve();
      });
    });
    const giftAck = await emitAck<AckMessage>(aSock, 'game:command', { commandId: `gift-${Date.now()}`, command: { type: 'diplomacy.gift', payload: { targetId: aldren, amount: 50 } } });
    expect(giftAck.ok).toBe(true);
    await bPatch;
    expect(bobGold).toBe(room.state.characters[aldren]!.gold);

    // Alice ne peut pas commander pour Bob : ses commandes s'appliquent à Aélis.
    expect(room.characterOf(aliceUser.id)).toBe(aelis);
    expect(room.characterOf(bobUser.id)).toBe(aldren);

    // Chat, échappé côté client (texte brut stocké tel quel sans HTML interprété).
    const msgP = once<ChatMessage>(bSock, 'chat:message');
    const sent = await emitAck<{ ok: boolean }>(aSock, 'chat:send', { gameId, text: '  Bonjour <b>Bob</b>\u0007 ' });
    expect(sent.ok).toBe(true);
    const msg = await msgP;
    expect(msg.text).toBe('Bonjour <b>Bob</b>');
    const tooLong = await emitAck<{ ok: boolean }>(aSock, 'chat:send', { gameId, text: 'x'.repeat(600) });
    expect(tooLong.ok).toBe(false);

    // Déconnexion de Bob, le temps avance, reconnexion.
    bSock.close();
    await waitFor(() => room.presence().find((p) => p.userId === bobUser.id)?.online === false);
    aSock.emit('time:set', { gameId, speed: 3 });
    const before = room.state.date;
    await waitFor(() => room.state.date >= before + 20, 20_000);
    aSock.emit('pause:request', { gameId, paused: true });
    await waitFor(() => room.paused);
    const b2 = bob.socket();
    const snap2P = once<SnapshotMessage>(b2, 'game:snapshot');
    await emitAck(b2, 'game:join', { gameId, protocolVersion: PROTOCOL_VERSION });
    const snap2 = await snap2P;
    expect(snap2.you.characterId).toBe(aldren);
    expect(snap2.view.date).toBe(room.state.date);
    expect(snap2.seq).toBe(room.seq);
    expect(snap2.view.characters[aldren]!.gold).toBe(room.state.characters[aldren]!.gold);
    // Pas de contrôle dupliqué.
    expect(Object.values(snap2.view.characters).filter((c) => c.isPlayer)).toHaveLength(2);

    // Resynchronisation à la demande.
    const resync = once<SnapshotMessage>(b2, 'game:snapshot');
    b2.emit('game:resync', { gameId });
    expect((await resync).seq).toBe(room.seq);
    aSock.close();
    b2.close();
  });

  it('ne diffuse pas l’état d’une partie aux joueurs d’une autre', async () => {
    const a = new Client(url);
    const b = new Client(url);
    await a.register('IsoA');
    await b.register('IsoB');
    const ga = await a.req<{ id: string }>('POST', '/api/games', { name: 'Partie A', mode: 'solo', characterId: byName('Torvald') });
    const gb = await b.req<{ id: string }>('POST', '/api/games', { name: 'Partie B', mode: 'solo', characterId: byName('Altani') });
    const sa = a.socket();
    const sb = b.socket();
    await emitAck(sa, 'game:join', { gameId: ga.body.id, protocolVersion: PROTOCOL_VERSION });
    await emitAck(sb, 'game:join', { gameId: gb.body.id, protocolVersion: PROTOCOL_VERSION });
    const seenByB: string[] = [];
    sb.on('game:patch', (p: PatchMessage) => seenByB.push(p.gameId));
    sa.emit('time:set', { gameId: ga.body.id, speed: 3 });
    const room = app.rooms.get(ga.body.id)!;
    const d0 = room.state.date;
    await waitFor(() => room.state.date > d0 + 5);
    sa.emit('pause:request', { gameId: ga.body.id, paused: true });
    expect(seenByB.filter((g) => g === ga.body.id)).toHaveLength(0);
    sa.close();
    sb.close();
  });
});
