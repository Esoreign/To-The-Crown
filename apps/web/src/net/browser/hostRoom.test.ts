import { afterEach, describe, expect, it } from 'vitest';
import { getScenario } from '@ttc/content';
import { createGameState } from '@ttc/game-core';
import type { ClockState } from '@ttc/shared';
import { HostRoom, type HostOutput, type HostSave, type HostStep } from './hostRoom';

const scenario = getScenario('couronne_brisee');
const HOST = 'host-user';
const GUEST = 'guest-user';

function setup() {
  const [a, b] = scenario.recommended;
  const state = createGameState(scenario, {
    gameId: '00000000-0000-4000-8000-000000000001',
    seed: 7,
    settings: { maxSpeed: 3, autosave: true, aiDifficulty: 'normal', eventFrequency: 'normal' },
    players: [
      { userId: HOST, displayName: 'Hôte', characterId: a!.characterId },
      { userId: GUEST, displayName: 'Invité', characterId: b!.characterId },
    ],
  });
  const steps: HostStep[] = [];
  const saves: HostSave[] = [];
  const clocks: ClockState[] = [];
  const out: HostOutput = {
    step: (s) => steps.push(s),
    save: (s) => saves.push(s),
    clock: (c) => clocks.push(c),
    log: () => undefined,
  };
  const room = new HostRoom(
    { gameId: state.gameId, state, mode: 'multiplayer', hostId: HOST, devTools: false },
    out,
  );
  return { room, steps, saves, clocks, guestChar: b!.characterId };
}

let current: HostRoom | null = null;
afterEach(() => current?.stop());

describe('HostRoom (hôte navigateur)', () => {
  it('exécute la commande d’un invité, numérote les patches et reste idempotent', () => {
    const { room, steps } = setup();
    current = room;
    const env = {
      commandId: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
      command: { type: 'army.raise', payload: {} },
    };
    const ack = room.handleCommand(GUEST, env);
    expect(ack.ok).toBe(true);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.seq).toBe(1);
    expect(Object.values(room.state.armies).some((a) => a.ownerId === room.characterOf(GUEST))).toBe(true);
    // Même identifiant : même réponse, aucune nouvelle mutation.
    expect(room.handleCommand(GUEST, env)).toEqual(ack);
    expect(steps).toHaveLength(1);
  });

  it('refuse une commande mal formée et les outils de développement', () => {
    const { room } = setup();
    current = room;
    expect(room.handleCommand(GUEST, { commandId: 'x', command: { type: 'nope' } }).error?.code).toBe(
      'INVALID_COMMAND',
    );
    expect(
      room.handleCommand(HOST, {
        commandId: '7a1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
        command: { type: 'dev.addResources', payload: { gold: 1000 } },
      }).error?.code,
    ).toBe('FORBIDDEN');
  });

  it('seul l’hôte relance le temps ; tout joueur peut mettre en pause', () => {
    const { room, clocks } = setup();
    current = room;
    room.setPaused(GUEST, false);
    expect(room.paused).toBe(true);
    room.setSpeed(GUEST, 2);
    expect(room.paused).toBe(true);
    room.setSpeed(HOST, 2);
    expect(room.paused).toBe(false);
    expect(clocks.at(-1)?.speed).toBe(2);
    room.setPaused(GUEST, true);
    expect(room.paused).toBe(true);
  });

  it('avance d’un jour et produit une sauvegarde relisible avec les souverains', () => {
    const { room, steps, saves } = setup();
    current = room;
    const date = room.state.date;
    room.tick();
    expect(room.state.date).toBe(date + 1);
    expect(steps.at(-1)?.date).toBe(date + 1);
    room.save('manual');
    const save = saves.at(-1)!;
    expect(save.seq).toBe(room.seq);
    expect(JSON.parse(save.json).date).toBe(date + 1);
    expect(save.meta.players.map((p) => p.userId).sort()).toEqual([GUEST, HOST]);
    expect(save.meta.players.every((p) => p.rulerName)).toBe(true);
  });
});
