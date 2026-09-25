/**
 * Archétypes de gouvernement (données). Chaque archétype change la façon de
 * jouer : qui hérite, ce que doivent les sujets, ce que coûte l'autorité,
 * comment se gagne la légitimité, quelles élites comptent. Les effets sont
 * appliqués par game-core (realm.ts, politics.ts) ; aucun code ne teste un
 * pays par son nom.
 */
import type { SuccessionLaw } from '@ttc/shared';

export type GovernmentId =
  | 'feudal_monarchy'
  | 'centralized_monarchy'
  | 'imperial_bureaucracy'
  | 'mamluk_sultanate'
  | 'iqta_realm'
  | 'steppe_confederation'
  | 'tribal_confederation'
  | 'warrior_shogunate'
  | 'clan_realm'
  | 'city_republic'
  | 'merchant_republic'
  | 'theocracy'
  | 'holy_order'
  | 'elective_monarchy'
  | 'tributary_empire'
  | 'mandala_kingdom'
  | 'city_state'
  | 'chiefdom';

export type EstateId = 'nobility' | 'clergy' | 'burghers' | 'military' | 'tribes' | 'bureaucrats' | 'merchants' | 'regional_elites';

export interface GovernmentDef {
  id: GovernmentId;
  name: string;
  /** Intitulé du dirigeant par rang de titre (county, duchy, kingdom, empire), masculin / féminin. */
  rulerTitles: Record<'county' | 'duchy' | 'kingdom' | 'empire', [string, string]>;
  /** Nom du « pouvoir central » dans l'interface. */
  authorityLabel: string;
  /** Loi de succession par défaut. */
  succession: SuccessionLaw;
  /** Élites qui comptent (ordre = poids initial décroissant). */
  estates: EstateId[];
  /** Intitulés des conseillers (chancelier, maréchal, intendant, maître-espion, conseiller religieux). */
  councilTitles: [string, string, string, string, string];
  /** Capacité administrative de base (provinces gouvernables sans pénalité). */
  adminCapacity: number;
  /** Multiplicateurs de prélèvement sur les sujets (impôts, levées). */
  subjectTax: number;
  subjectLevy: number;
  /** Coût en autorité/prestige pour relever l'autorité centrale (multiplicateur). */
  authorityCost: number;
  /** Plafond d'autorité (0..4 : fragmentée..absolue). */
  maxAuthority: number;
  /** Les sujets peuvent se faire la guerre entre eux ? */
  vassalWars: boolean;
  /** Légitimité : gain mensuel de base et sources privilégiées. */
  legitimacyDrift: number;
  legitimacyFrom: ('dynasty' | 'religion' | 'victory' | 'election' | 'wealth' | 'age' | 'mandate')[];
  /** Type de sujet par défaut des grands vassaux. */
  defaultSubject: 'direct_vassal' | 'autonomous_vassal' | 'tributary' | 'confederate_member';
  description: string;
}

const T = (a: [string, string], b: [string, string], c: [string, string], d: [string, string]) => ({ county: a, duchy: b, kingdom: c, empire: d });

export const GOVERNMENTS: GovernmentDef[] = [
  {
    id: 'feudal_monarchy', name: 'Monarchie féodale', rulerTitles: T(['Comte', 'Comtesse'], ['Duc', 'Duchesse'], ['Roi', 'Reine'], ['Empereur', 'Impératrice']),
    authorityLabel: 'Autorité de la Couronne', succession: 'primogeniture', estates: ['nobility', 'clergy', 'burghers'],
    councilTitles: ['Chancelier', 'Connétable', 'Grand trésorier', 'Maître des secrets', 'Chapelain'], adminCapacity: 24, subjectTax: 0.25, subjectLevy: 0.4,
    authorityCost: 1, maxAuthority: 4, vassalWars: true, legitimacyDrift: 0.1, legitimacyFrom: ['dynasty', 'religion', 'victory'], defaultSubject: 'direct_vassal',
    description: 'Les grands seigneurs tiennent leurs terres contre service armé. Le roi gouverne avec eux, rarement contre eux.',
  },
  {
    id: 'centralized_monarchy', name: 'Monarchie centralisée', rulerTitles: T(['Comte', 'Comtesse'], ['Duc', 'Duchesse'], ['Roi', 'Reine'], ['Empereur', 'Impératrice']),
    authorityLabel: 'Autorité royale', succession: 'primogeniture', estates: ['nobility', 'burghers', 'clergy'],
    councilTitles: ['Chancelier', 'Maréchal', 'Contrôleur des finances', 'Maître des secrets', 'Confesseur'], adminCapacity: 32, subjectTax: 0.35, subjectLevy: 0.45,
    authorityCost: 1.2, maxAuthority: 4, vassalWars: false, legitimacyDrift: 0.12, legitimacyFrom: ['dynasty', 'religion', 'wealth'], defaultSubject: 'direct_vassal',
    description: 'Officiers royaux, impôt régulier et justice du roi : plus de revenus, mais une noblesse qui supporte mal la bride.',
  },
  {
    id: 'imperial_bureaucracy', name: 'Bureaucratie impériale', rulerTitles: T(['Préfet', 'Préfète'], ['Prince', 'Princesse'], ['Roi', 'Reine'], ['Empereur', 'Impératrice']),
    authorityLabel: 'Mandat impérial', succession: 'primogeniture', estates: ['bureaucrats', 'military', 'regional_elites'],
    councilTitles: ['Grand secrétaire', 'Commandant en chef', 'Ministre des Revenus', 'Censeur', 'Ministre des Rites'], adminCapacity: 90, subjectTax: 0.4, subjectLevy: 0.3,
    authorityCost: 0.8, maxAuthority: 4, vassalWars: false, legitimacyDrift: 0.08, legitimacyFrom: ['mandate', 'dynasty', 'wealth'], defaultSubject: 'direct_vassal',
    description: 'Des fonctionnaires lettrés administrent au nom du trône. Immense capacité administrative, mais la légitimité se perd avec les désastres.',
  },
  {
    id: 'mamluk_sultanate', name: 'Sultanat mamelouk', rulerTitles: T(['Émir', 'Émira'], ['Émir', 'Émira'], ['Sultan', 'Sultane'], ['Sultan', 'Sultane']),
    authorityLabel: 'Autorité du sultan', succession: 'elective', estates: ['military', 'clergy', 'merchants'],
    councilTitles: ['Grand émir', 'Atabeg des armées', 'Vizir', 'Maître des mamelouks', 'Grand cadi'], adminCapacity: 40, subjectTax: 0.35, subjectLevy: 0.35,
    authorityCost: 1, maxAuthority: 3, vassalWars: false, legitimacyDrift: 0.05, legitimacyFrom: ['victory', 'religion', 'wealth'], defaultSubject: 'direct_vassal',
    description: 'Le trône revient au plus fort des émirs mamelouks. Richesse du commerce, mais chaque succession est un coup de force.',
  },
  {
    id: 'iqta_realm', name: 'Sultanat à iqta', rulerTitles: T(['Mouqti', 'Mouqti'], ['Malik', 'Malika'], ['Sultan', 'Sultane'], ['Padichah', 'Padichah']),
    authorityLabel: 'Autorité du sultan', succession: 'seniority', estates: ['military', 'clergy', 'regional_elites'],
    councilTitles: ['Vizir', 'Amir al-umara', 'Mustawfi', 'Barid', 'Cheikh al-islam'], adminCapacity: 36, subjectTax: 0.3, subjectLevy: 0.5,
    authorityCost: 1, maxAuthority: 4, vassalWars: false, legitimacyDrift: 0.08, legitimacyFrom: ['victory', 'religion', 'dynasty'], defaultSubject: 'direct_vassal',
    description: 'Les revenus des terres sont confiés aux cavaliers contre service. Armée nombreuse, loyauté à entretenir.',
  },
  {
    id: 'steppe_confederation', name: 'Confédération des steppes', rulerTitles: T(['Bey', 'Begüm'], ['Noyan', 'Khatun'], ['Khan', 'Khatun'], ['Grand Khan', 'Grande Khatun']),
    authorityLabel: 'Prestige du khan', succession: 'seniority', estates: ['tribes', 'military', 'merchants'],
    councilTitles: ['Beylerbey', 'Noyan des tumen', 'Darughachi', 'Maître des relais', 'Chamane'], adminCapacity: 30, subjectTax: 0.2, subjectLevy: 0.6,
    authorityCost: 0.9, maxAuthority: 3, vassalWars: true, legitimacyDrift: 0.04, legitimacyFrom: ['victory', 'dynasty'], defaultSubject: 'tributary',
    description: 'Des clans fédérés autour d’un khan victorieux. Des cavaliers innombrables — tant que les victoires durent.',
  },
  {
    id: 'tribal_confederation', name: 'Confédération tribale', rulerTitles: T(['Chef', 'Cheffe'], ['Chef', 'Cheffe'], ['Grand chef', 'Grande cheffe'], ['Grand chef', 'Grande cheffe']),
    authorityLabel: 'Cohésion de la confédération', succession: 'elective', estates: ['tribes', 'military'],
    councilTitles: ['Porte-parole', 'Chef de guerre', 'Gardien des réserves', 'Éclaireur', 'Gardien des rites'], adminCapacity: 18, subjectTax: 0.1, subjectLevy: 0.5,
    authorityCost: 1.3, maxAuthority: 2, vassalWars: true, legitimacyDrift: 0.06, legitimacyFrom: ['election', 'victory'], defaultSubject: 'confederate_member',
    description: 'Des peuples alliés décident ensemble. Le chef propose, le conseil des clans dispose.',
  },
  {
    id: 'warrior_shogunate', name: 'Shogunat guerrier', rulerTitles: T(['Jitō', 'Jitō'], ['Shugo', 'Shugo'], ['Shōgun', 'Shōgun'], ['Shōgun', 'Shōgun']),
    authorityLabel: 'Autorité du bakufu', succession: 'primogeniture', estates: ['military', 'clergy', 'regional_elites'],
    councilTitles: ['Kanrei', 'Samurai-dokoro', 'Mandokoro', 'Monchūjo', 'Abbé conseiller'], adminCapacity: 20, subjectTax: 0.2, subjectLevy: 0.45,
    authorityCost: 1.1, maxAuthority: 3, vassalWars: true, legitimacyDrift: 0.06, legitimacyFrom: ['dynasty', 'victory'], defaultSubject: 'autonomous_vassal',
    description: 'Le shōgun gouverne au nom de l’empereur par l’entremise de puissants gouverneurs militaires, toujours tentés par l’autonomie.',
  },
  {
    id: 'clan_realm', name: 'Royaume de clans', rulerTitles: T(['Chef de clan', 'Cheffe de clan'], ['Seigneur', 'Dame'], ['Roi', 'Reine'], ['Haut-roi', 'Haute-reine']),
    authorityLabel: 'Autorité du roi', succession: 'elective', estates: ['nobility', 'regional_elites', 'clergy'],
    councilTitles: ['Brehon', 'Chef de guerre', 'Intendant', 'Barde', 'Abbé'], adminCapacity: 14, subjectTax: 0.15, subjectLevy: 0.5,
    authorityCost: 1.2, maxAuthority: 2, vassalWars: true, legitimacyDrift: 0.06, legitimacyFrom: ['dynasty', 'election', 'victory'], defaultSubject: 'autonomous_vassal',
    description: 'Parenté, clientèle et prestige : l’héritier est choisi dans la parentèle, les alliances comptent plus que les lois.',
  },
  {
    id: 'city_republic', name: 'République urbaine', rulerTitles: T(['Podestat', 'Podestat'], ['Gonfalonier', 'Gonfalonière'], ['Seigneurie', 'Seigneurie'], ['Seigneurie', 'Seigneurie']),
    authorityLabel: 'Cohésion de la Seigneurie', succession: 'elective', estates: ['burghers', 'merchants', 'clergy'],
    councilTitles: ['Chancelier', 'Capitaine du peuple', 'Camerlingue', 'Otto di guardia', 'Évêque'], adminCapacity: 12, subjectTax: 0.3, subjectLevy: 0.2,
    authorityCost: 1, maxAuthority: 3, vassalWars: false, legitimacyDrift: 0.1, legitimacyFrom: ['election', 'wealth'], defaultSubject: 'direct_vassal',
    description: 'Les conseils de la cité élisent leurs magistrats. Riches et diplomates, faibles en levées : on engage des condottieres.',
  },
  {
    id: 'merchant_republic', name: 'République marchande', rulerTitles: T(['Podestat', 'Podestat'], ['Doge', 'Dogaresse'], ['Doge', 'Dogaresse'], ['Doge', 'Dogaresse']),
    authorityLabel: 'Poids du Grand Conseil', succession: 'elective', estates: ['merchants', 'burghers', 'clergy'],
    councilTitles: ['Grand chancelier', 'Capitaine général de la mer', 'Procurateur', 'Conseil des Dix', 'Primicier'], adminCapacity: 18, subjectTax: 0.35, subjectLevy: 0.2,
    authorityCost: 1, maxAuthority: 3, vassalWars: false, legitimacyDrift: 0.1, legitimacyFrom: ['election', 'wealth'], defaultSubject: 'direct_vassal',
    description: 'Les grandes familles marchandes élisent le doge. Comptoirs, flottes et or : la guerre se paie plus qu’elle ne se lève.',
  },
  {
    id: 'theocracy', name: 'Théocratie', rulerTitles: T(['Abbé', 'Abbesse'], ['Prince-évêque', 'Princesse-abbesse'], ['Pontife', 'Pontife'], ['Pontife', 'Pontife']),
    authorityLabel: 'Autorité spirituelle', succession: 'elective', estates: ['clergy', 'nobility', 'burghers'],
    councilTitles: ['Cardinal camerlingue', 'Gonfalonier', 'Trésorier', 'Pénitencier', 'Doyen'], adminCapacity: 14, subjectTax: 0.3, subjectLevy: 0.25,
    authorityCost: 0.9, maxAuthority: 3, vassalWars: false, legitimacyDrift: 0.1, legitimacyFrom: ['religion', 'election'], defaultSubject: 'direct_vassal',
    description: 'Le pouvoir procède du sacré. Pas de dynastie héréditaire : la succession passe par une élection du clergé.',
  },
  {
    id: 'holy_order', name: 'Ordre militaire', rulerTitles: T(['Commandeur', 'Commandeur'], ['Maître provincial', 'Maître provincial'], ['Grand maître', 'Grand maître'], ['Grand maître', 'Grand maître']),
    authorityLabel: 'Discipline de l’Ordre', succession: 'elective', estates: ['military', 'clergy', 'burghers'],
    councilTitles: ['Grand commandeur', 'Maréchal de l’Ordre', 'Trésorier', 'Grand hospitalier', 'Chapelain'], adminCapacity: 20, subjectTax: 0.3, subjectLevy: 0.5,
    authorityCost: 0.8, maxAuthority: 4, vassalWars: false, legitimacyDrift: 0.1, legitimacyFrom: ['religion', 'victory'], defaultSubject: 'direct_vassal',
    description: 'Des chevaliers-moines élisent leur maître. Forteresses, discipline et guerre sainte ; aucun héritier de sang.',
  },
  {
    id: 'elective_monarchy', name: 'Monarchie élective', rulerTitles: T(['Comte', 'Comtesse'], ['Prince', 'Princesse'], ['Roi', 'Reine'], ['Empereur', 'Impératrice']),
    authorityLabel: 'Autorité du souverain élu', succession: 'elective', estates: ['nobility', 'clergy', 'burghers'],
    councilTitles: ['Chancelier', 'Maréchal', 'Trésorier', 'Chambellan', 'Primat'], adminCapacity: 26, subjectTax: 0.2, subjectLevy: 0.35,
    authorityCost: 1.4, maxAuthority: 3, vassalWars: true, legitimacyDrift: 0.08, legitimacyFrom: ['election', 'religion', 'victory'], defaultSubject: 'autonomous_vassal',
    description: 'Les grands électeurs font le souverain et entendent être payés de retour. Chaque privilège accordé se compte en voix.',
  },
  {
    id: 'tributary_empire', name: 'Empire tributaire', rulerTitles: T(['Seigneur', 'Dame'], ['Tlatoani', 'Cihuatlatoani'], ['Huey tlatoani', 'Huey cihuatlatoani'], ['Seigneur des seigneurs', 'Dame des dames']),
    authorityLabel: 'Crainte et tribut', succession: 'elective', estates: ['military', 'clergy', 'regional_elites'],
    councilTitles: ['Cihuacoatl', 'Tlacochcalcatl', 'Calpixqui en chef', 'Pochteca', 'Grand prêtre'], adminCapacity: 22, subjectTax: 0.4, subjectLevy: 0.2,
    authorityCost: 1, maxAuthority: 3, vassalWars: true, legitimacyDrift: 0.06, legitimacyFrom: ['victory', 'religion'], defaultSubject: 'tributary',
    description: 'Les cités vaincues gardent leurs seigneurs et paient tribut. Riche, mais chaque défaite réveille les tributaires.',
  },
  {
    id: 'mandala_kingdom', name: 'Royaume mandala', rulerTitles: T(['Datu', 'Dayang'], ['Raja', 'Rani'], ['Maharaja', 'Maharani'], ['Chakravartin', 'Chakravartin']),
    authorityLabel: 'Rayonnement du trône', succession: 'elective', estates: ['clergy', 'merchants', 'regional_elites'],
    councilTitles: ['Mahapatih', 'Senapati', 'Bendahara', 'Laksamana', 'Rajaguru'], adminCapacity: 20, subjectTax: 0.25, subjectLevy: 0.3,
    authorityCost: 1, maxAuthority: 3, vassalWars: true, legitimacyDrift: 0.08, legitimacyFrom: ['religion', 'wealth', 'dynasty'], defaultSubject: 'tributary',
    description: 'Un centre sacré rayonne sur des cercles de princes tributaires dont la loyauté décroît avec la distance.',
  },
  {
    id: 'city_state', name: 'Cité-État', rulerTitles: T(['Seigneur', 'Dame'], ['Seigneur', 'Dame'], ['Roi de la cité', 'Reine de la cité'], ['Roi de la cité', 'Reine de la cité']),
    authorityLabel: 'Autorité du palais', succession: 'elective', estates: ['merchants', 'nobility', 'clergy'],
    councilTitles: ['Premier conseiller', 'Chef de guerre', 'Maître du marché', 'Gardien des portes', 'Gardien des rites'], adminCapacity: 10, subjectTax: 0.3, subjectLevy: 0.3,
    authorityCost: 1, maxAuthority: 3, vassalWars: true, legitimacyDrift: 0.08, legitimacyFrom: ['wealth', 'dynasty'], defaultSubject: 'tributary',
    description: 'Une cité et son arrière-pays, vivant du commerce et des alliances avec ses voisines.',
  },
  {
    id: 'chiefdom', name: 'Chefferie', rulerTitles: T(['Chef', 'Cheffe'], ['Chef', 'Cheffe'], ['Chef suprême', 'Cheffe suprême'], ['Chef suprême', 'Cheffe suprême']),
    authorityLabel: 'Prestige du chef', succession: 'seniority', estates: ['tribes', 'clergy'],
    councilTitles: ['Porte-parole', 'Chef de guerre', 'Gardien des greniers', 'Messager', 'Gardien des ancêtres'], adminCapacity: 10, subjectTax: 0.15, subjectLevy: 0.4,
    authorityCost: 1.2, maxAuthority: 2, vassalWars: true, legitimacyDrift: 0.06, legitimacyFrom: ['dynasty', 'religion'], defaultSubject: 'tributary',
    description: 'Un lignage prestigieux coordonne villages et clans. Peu d’administration, beaucoup de parenté et de dons.',
  },
];

export const GOVERNMENT_BY_ID = Object.fromEntries(GOVERNMENTS.map((g) => [g.id, g])) as Record<GovernmentId, GovernmentDef>;
