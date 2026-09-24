/// <reference lib="webworker" />
/**
 * Fil de simulation de l'hôte (Web Worker) : la simulation ne bloque jamais
 * l'interface et continue quand l'onglet passe en arrière-plan.
 */
import { getScenario } from '@ttc/content';
import { createGameState, isPlayableCharacter, migrateSnapshot, publicView } from '@ttc/game-core';
import { isGameError, type GameState } from '@ttc/shared';
import { HostRoom } from './hostRoom';
import type { WorkerIn, WorkerOut } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

let room: HostRoom | null = null;

function post(msg: WorkerOut): void {
  self.postMessage(msg);
}

function init(msg: Extract<WorkerIn, { t: 'init' }>): void {
  let state: GameState;
  let fresh = false;
  try {
    if (msg.state) state = migrateSnapshot(msg.state);
    else if (msg.create) {
      const scenario = getScenario(msg.create.scenarioId);
      for (const p of msg.create.players) {
        if (!isPlayableCharacter(scenario, p.characterId)) {
          post({
            t: 'fatal',
            code: 'CHARACTER_NOT_PLAYABLE',
            message: 'Un souverain choisi ne peut pas être joué',
          });
          return;
        }
      }
      state = createGameState(scenario, {
        gameId: msg.gameId,
        seed: msg.create.seed,
        settings: msg.create.settings,
        players: msg.create.players,
      });
      fresh = true;
    } else {
      post({ t: 'fatal', code: 'GAME_NOT_STARTED', message: 'Aucune sauvegarde à charger' });
      return;
    }
  } catch (err) {
    post({
      t: 'fatal',
      code: isGameError(err) ? err.code : 'INTERNAL',
      message: isGameError(err) ? err.message : 'Sauvegarde illisible',
    });
    return;
  }
  room = new HostRoom(
    {
      gameId: msg.gameId,
      state,
      mode: msg.mode,
      hostId: msg.hostId,
      speed: msg.speed,
      playedSeconds: msg.playedSeconds,
      devTools: msg.devTools,
    },
    {
      step: (step) => post({ t: 'step', step }),
      clock: (clock) => post({ t: 'clock', clock }),
      save: (save) => post({ t: 'save', save }),
      log: (message, details) => post({ t: 'log', message, details }),
    },
  );
  post({
    t: 'ready',
    seq: room.seq,
    version: room.state.version,
    view: publicView(room.state),
    priv: room.privateFor(msg.hostId),
    clock: room.clock(),
  });
  if (fresh) room.save('start');
}

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  if (msg.t === 'init') return init(msg);
  if (!room) return;
  switch (msg.t) {
    case 'cmd':
      post({ t: 'ack', id: msg.id, userId: msg.userId, ack: room.handleCommand(msg.userId, msg.env) });
      break;
    case 'speed':
      room.setSpeed(msg.userId, msg.speed);
      break;
    case 'pause':
      room.setPaused(msg.userId, msg.paused, msg.reason ?? 'player');
      break;
    case 'advance':
      room.advanceDays(msg.days);
      break;
    case 'save':
      if (msg.ifDirty) room.saveIfDirty(msg.reason);
      else room.save(msg.reason);
      break;
    case 'stop':
      room.save(msg.reason);
      room.stop();
      break;
  }
};
