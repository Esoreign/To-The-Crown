import { useMemo } from 'react';
import { PROVINCE_GEO, PROVINCE_TASKS, ROLE_SKILL, ROLE_TASKS, councilCandidates, domainProvinceIds, opinion, seatSkill, skill } from '@ttc/game-core';
import { COUNCIL_ROLES, type Character, type CouncilRole, type CouncilTask, type GameView } from '@ttc/shared';
import { t } from '../../lib/i18n';
import { charName, councilTitle } from '../../lib/format';
import { Portrait, Tip } from '../../ui/common';
import { act, openCharacter } from '../hooks';
import { ScreenFrame } from './ScreenHost';

const ROLE_ICON: Record<CouncilRole, string> = { chancellor: '✉', marshal: '⚔', steward: '⛁', spymaster: '☾', scholar: '✎' };

export function CouncilScreen({ view, me }: { view: GameView; me: Character }) {
  const candidates = useMemo(() => councilCandidates(view, me.id), [view, me.id]);
  const domain = domainProvinceIds(me);
  if (!me.council) {
    return (
      <ScreenFrame title="Conseil" icon="⚜">
        <p className="muted">Seul un seigneur titré dispose d’un conseil.</p>
      </ScreenFrame>
    );
  }
  const council = me.council;
  return (
    <ScreenFrame title="Conseil" icon="⚜" wide>
      <p className="soft narrative" style={{ marginTop: 0 }}>
        Vos conseillers agissent chaque mois selon la tâche que vous leur confiez. Leur compétence fait toute la différence.
      </p>
      <div className="council-grid">
        {COUNCIL_ROLES.map((role) => {
          const seat = council[role];
          const c = seat.characterId ? view.characters[seat.characterId] : undefined;
          const key = ROLE_SKILL[role];
          const sorted = [...candidates].sort((a, b) => skill(view, b, key) - skill(view, a, key));
          return (
            <div key={role} className="council-card" data-testid={`council-${role}`}>
              <div className="council-role display">
                <span aria-hidden="true">{ROLE_ICON[role]}</span> {councilTitle(me, role)}
              </div>
              <div className="council-person">
                <Portrait c={c} view={view} size={64} onClick={c ? () => openCharacter(c.id) : undefined} title={c ? charName(view, c) : undefined} />
                <div>
                  <div>{c ? charName(view, c) : <span className="neg">Siège vacant</span>}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t(`skill.${key}`)} : <span className="gold num">{seatSkill(view, me, role)}</span>
                  </div>
                  {c && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      Opinion : <span className={opinion(view, c.id, me.id) >= 0 ? 'pos' : 'neg'}>{Math.round(opinion(view, c.id, me.id))}</span>
                    </div>
                  )}
                </div>
              </div>
              <select
                className="input"
                aria-label={`Nommer ${councilTitle(me, role)}`}
                value={seat.characterId ?? ''}
                onChange={(e) => void act({ type: 'council.assign', payload: { role, characterId: e.target.value || null } }, 'Conseiller nommé')}
              >
                <option value="">— Vacant —</option>
                {sorted.map((cand) => (
                  <option key={cand.id} value={cand.id}>
                    {cand.firstName} ({skill(view, cand, key)})
                  </option>
                ))}
              </select>
              <div className="council-tasks" role="radiogroup" aria-label="Tâche">
                {ROLE_TASKS[role].map((task: CouncilTask) => (
                  <Tip key={task} content={() => <div className="soft">{t(`council.task.desc.${task}`)}</div>}>
                    <button
                      role="radio"
                      aria-checked={seat.task === task}
                      className={`task-btn${seat.task === task ? ' active' : ''}`}
                      onClick={() =>
                        void act({
                          type: 'council.task',
                          payload: { role, task, provinceId: PROVINCE_TASKS.has(task) ? (seat.provinceId ?? domain[0] ?? null) : null },
                        })
                      }
                    >
                      {t(`council.task.${task}`)}
                    </button>
                  </Tip>
                ))}
              </div>
              {PROVINCE_TASKS.has(seat.task) && (
                <select
                  className="input"
                  aria-label="Province ciblée"
                  value={seat.provinceId ?? ''}
                  onChange={(e) => void act({ type: 'council.task', payload: { role, task: seat.task, provinceId: e.target.value } })}
                >
                  {domain.map((p) => (
                    <option key={p} value={p}>
                      {PROVINCE_GEO[p]?.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="progress" title="Progression de la tâche">
                <span style={{ width: `${Math.min(100, seat.progress)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </ScreenFrame>
  );
}
