import { useMemo, useState } from 'react';
import {
  SCHEME_DEFS,
  availableCasusBelli,
  canGrantTitle,
  councilCandidates,
  giftOpinionValue,
  militaryStrength,
  revokeCost,
  schemePower,
  schemeResistance,
  schemeValidity,
  skill,
} from '@ttc/game-core';
import type { CasusBelli, Character, GameView, Scheme, SchemeType, SkillKey } from '@ttc/shared';
import { useUi } from '../state/ui';
import { fmt, t, tOr } from '../lib/i18n';
import { charName, titleFullName, titleName } from '../lib/format';
import { ActionButton, Modal, Portrait } from '../ui/common';
import { SKILLS } from '../ui/char';
import { act } from './hooks';

const close = () => useUi.setState({ dialog: null });

function GiftDialog({ view, me, target }: { view: GameView; me: Character; target: Character }) {
  const max = Math.max(10, Math.min(5000, Math.floor(me.gold)));
  const [amount, setAmount] = useState(Math.min(max, 100));
  return (
    <Modal title={`Cadeau pour ${target.firstName}`} onClose={close}>
      <div className="col" style={{ gap: 12, minWidth: 340 }}>
        <div className="row" style={{ gap: 12 }}>
          <Portrait c={target} view={view} size={60} />
          <p className="narrative soft" style={{ margin: 0 }}>
            Un présent bien choisi ouvre bien des portes. L’effet s’estompe avec le temps.
          </p>
        </div>
        <div className="setting-row">
          <label htmlFor="gift-amount">Montant</label>
          <input id="gift-amount" type="range" min={10} max={max} step={10} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <span className="num gold">{fmt(amount)}</span>
        </div>
        <div className="info-line">
          <span>Opinion gagnée</span>
          <span className="pos num">+{giftOpinionValue(amount)}</span>
        </div>
        <ActionButton className="btn-primary" disabled={me.gold < amount} onClick={() => act({ type: 'diplomacy.gift', payload: { targetId: target.id, amount } }, `Cadeau envoyé à ${target.firstName}`, 'coin').then((ok) => ok && close())}>
          Offrir {fmt(amount)} or
        </ActionButton>
      </div>
    </Modal>
  );
}

function WarDialog({ view, me, target }: { view: GameView; me: Character; target: Character }) {
  const options = useMemo(() => availableCasusBelli(view, me.id, target.id), [view, me.id, target.id]);
  const [idx, setIdx] = useState(0);
  const mine = militaryStrength(view, me);
  const theirs = militaryStrength(view, target);
  const o = options[idx];
  return (
    <Modal title={`Déclarer la guerre à ${target.firstName}`} onClose={close} className="war-dialog">
      <div className="col" style={{ gap: 12, minWidth: 420 }}>
        <div className="war-compare">
          <div className="person-tile">
            <Portrait c={me} view={view} size={60} />
            <div className="num">{fmt(mine)} hommes</div>
          </div>
          <span className="display war-vs">contre</span>
          <div className="person-tile">
            <Portrait c={target} view={view} size={60} />
            <div className="num">{fmt(theirs)} hommes</div>
          </div>
        </div>
        {theirs > mine * 1.3 && <div className="neg">Leur armée est nettement supérieure à la vôtre. Pensez à vos alliés.</div>}
        <div className="field">
          <span className="section-title" style={{ margin: 0 }}>
            Casus belli
          </span>
          {options.map((opt, i) => (
            <label key={`${opt.cb}-${opt.titleId}-${opt.claimantId}`} className={`cb-option${i === idx ? ' active' : ''}`}>
              <input type="radio" name="cb" checked={i === idx} onChange={() => setIdx(i)} />
              <span className="grow">
                {t(`cb.${opt.cb}`)}
                {opt.titleId && <span className="soft"> — {titleFullName(opt.titleId)}</span>}
                {opt.claimantId && <span className="soft"> (pour {charName(view, view.characters[opt.claimantId])})</span>}
              </span>
              {opt.cost && (
                <span className="muted">
                  {opt.cost.prestige ? `${opt.cost.prestige} prestige` : ''} {opt.cost.fervor ? `${opt.cost.fervor} ferveur` : ''}
                </span>
              )}
            </label>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
          Déclarer la guerre attire l’attention de tout Caldria. Une trêve de plusieurs années suivra la paix.
        </p>
        <ActionButton
          className="btn-danger btn-lg"
          disabled={!o}
          onClick={() =>
            act({ type: 'war.declare', payload: { targetId: target.id, cb: o!.cb as Exclude<CasusBelli, 'faction'>, titleId: o!.titleId, claimantId: o!.claimantId } }, `La guerre est déclarée à ${target.firstName} !`, 'war').then((ok) => ok && close())
          }
        >
          ⚔ Déclarer la guerre
        </ActionButton>
      </div>
    </Modal>
  );
}

function SchemeDialog({ view, me, target }: { view: GameView; me: Character; target: Character }) {
  const types = Object.keys(SCHEME_DEFS) as SchemeType[];
  return (
    <Modal title={`Comploter contre ${target.firstName}`} onClose={close}>
      <div className="col" style={{ gap: 6, minWidth: 420 }}>
        {types.map((ty) => {
          const why = schemeValidity(view, me, target, ty);
          const fake: Scheme = { id: 'preview', type: ty, ownerId: me.id, targetId: target.id, agents: [], progress: 0, power: 0, resistance: 0, secrecy: 80, status: 'active', startedAt: view.date, discoveredBy: [] };
          const pw = schemePower(view, fake);
          const rs = schemeResistance(view, fake);
          const def = SCHEME_DEFS[ty];
          return (
            <div key={ty} className={`scheme-option${def.hostile ? ' hostile' : ''}`}>
              <div className="grow">
                <div className="display">{t(`scheme.${ty}`)}</div>
                <div className="soft" style={{ fontSize: 12.5 }}>
                  {t(`scheme.desc.${ty}`)}
                </div>
                <div className="muted num" style={{ fontSize: 12 }}>
                  Puissance {fmt(pw, 1)} · Résistance {fmt(rs, 1)} · {t(`skill.${def.skill}`)}
                  {def.maxAgents ? ` · jusqu’à ${def.maxAgents} agents recrutés en chemin` : ''}
                </div>
                {why && <div className="neg" style={{ fontSize: 12 }}>{tOr(`reason.${why}`, why)}</div>}
              </div>
              <ActionButton
                className={def.hostile ? 'btn-danger btn-sm' : 'btn-sm'}
                disabled={!!why}
                onClick={() => act({ type: 'scheme.start', payload: { schemeType: ty, targetId: target.id } }, `Complot lancé : ${t(`scheme.${ty}`)}`).then((ok) => ok && close())}
              >
                Lancer
              </ActionButton>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function GrantDialog({ view, me, target }: { view: GameView; me: Character; target: Character }) {
  return (
    <Modal title={`Accorder un titre à ${target.firstName}`} onClose={close}>
      <div className="col" style={{ gap: 6, minWidth: 360 }}>
        {me.titleIds.map((tid) => {
          const why = canGrantTitle(view, me.id, tid, target.id);
          return (
            <div key={tid} className="scheme-option">
              <div className="grow">
                <div>{titleFullName(tid)}</div>
                {why && <div className="neg" style={{ fontSize: 12 }}>{tOr(`reason.${why}`, why)}</div>}
              </div>
              <ActionButton className="btn-sm" disabled={!!why} onClick={() => act({ type: 'title.grant', payload: { titleId: tid, toCharacterId: target.id } }, `${titleName(tid)} accordé à ${target.firstName}`).then((ok) => ok && close())}>
                Accorder
              </ActionButton>
            </div>
          );
        })}
        <p className="muted" style={{ fontSize: 12.5 }}>
          Un vassal reconnaissant vous sera loyal, mais chaque comté donné réduit votre domaine et vos revenus directs.
        </p>
      </div>
    </Modal>
  );
}

function RevokeDialog({ view, me, target }: { view: GameView; me: Character; target: Character }) {
  const cost = revokeCost(view, me.id, target.id);
  return (
    <Modal title={`Révoquer un titre de ${target.firstName}`} onClose={close}>
      <div className="col" style={{ gap: 6, minWidth: 360 }}>
        <p className={cost ? 'neg' : 'pos'} style={{ margin: 0 }}>
          {cost ? `Révocation injustifiée : ${cost} autorité, et vos vassaux crieront à la tyrannie.` : 'Ce vassal a commis un crime : la révocation est justifiée.'}
        </p>
        {target.titleIds.map((tid) => (
          <div key={tid} className="scheme-option">
            <span className="grow">{titleFullName(tid)}</span>
            <ActionButton className="btn-danger btn-sm" disabled={me.authority < cost} onClick={() => act({ type: 'title.revoke', payload: { titleId: tid } }, `${titleName(tid)} révoqué`).then((ok) => ok && close())}>
              Révoquer
            </ActionButton>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function GuardianDialog({ view, me, target }: { view: GameView; me: Character; target: Character }) {
  const [focus, setFocus] = useState<SkillKey>(target.education?.focus ?? 'diplomacy');
  const tutors = useMemo(() => [me, ...councilCandidates(view, me.id)].filter((c) => c.id !== target.id), [view, me, target.id]);
  const [tutorId, setTutor] = useState<string>(target.education?.tutorId ?? '');
  return (
    <Modal title={`Éducation de ${target.firstName}`} onClose={close}>
      <div className="col" style={{ gap: 10, minWidth: 380 }}>
        <div className="field">
          <label>Orientation</label>
          <div className="row wrap" style={{ gap: 4 }}>
            {SKILLS.map((k) => (
              <button key={k} className={`tab${focus === k ? ' active' : ''}`} onClick={() => setFocus(k)}>
                {t(`skill.${k}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="tutor">Précepteur</label>
          <select id="tutor" className="input" value={tutorId} onChange={(e) => setTutor(e.target.value)}>
            <option value="">— Aucun —</option>
            {tutors
              .sort((a, b) => skill(view, b, focus) - skill(view, a, focus))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} ({t(`skill.${focus}`)} {skill(view, c, focus)})
                </option>
              ))}
          </select>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
          À seize ans, l’enfant reçoit un trait d’éducation dont le niveau dépend de la compétence de son précepteur.
        </p>
        <ActionButton className="btn-primary" onClick={() => act({ type: 'character.guardian', payload: { childId: target.id, tutorId: tutorId || null, focus } }, 'Éducation confiée').then((ok) => ok && close())}>
          Confirmer
        </ActionButton>
      </div>
    </Modal>
  );
}

/** Hôte des boîtes de dialogue d'interaction. */
export function DialogHost({ view, me }: { view: GameView; me: Character }) {
  const dialog = useUi((s) => s.dialog);
  if (!dialog) return null;
  if (dialog.kind === 'confirm' && dialog.confirm) {
    const c = dialog.confirm;
    return (
      <Modal title={c.title} onClose={close}>
        <div className="col" style={{ gap: 14, minWidth: 340, maxWidth: 460 }}>
          <p className="narrative" style={{ margin: 0 }}>
            {c.text}
          </p>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" onClick={close}>
              Annuler
            </button>
            <ActionButton
              className={c.danger ? 'btn-danger' : 'btn-primary'}
              onClick={async () => {
                await c.run();
                close();
              }}
            >
              Confirmer
            </ActionButton>
          </div>
        </div>
      </Modal>
    );
  }
  const target = view.characters[dialog.targetId];
  if (!target) return null;
  switch (dialog.kind) {
    case 'gift':
      return <GiftDialog view={view} me={me} target={target} />;
    case 'war':
      return <WarDialog view={view} me={me} target={target} />;
    case 'scheme':
      return <SchemeDialog view={view} me={me} target={target} />;
    case 'grant':
      return <GrantDialog view={view} me={me} target={target} />;
    case 'revoke':
      return <RevokeDialog view={view} me={me} target={target} />;
    case 'guardian':
      return <GuardianDialog view={view} me={me} target={target} />;
    default:
      return null;
  }
}

