// ─────────────────────────────────────────────────────────────
//  STRATOS — L'usine à météo
//  Toutes les définitions statiques du jeu (biens, bâtiments,
//  saisons, événements, améliorations, succès, éther…)
// ─────────────────────────────────────────────────────────────

export const GOOD_IDS = ['vapeur', 'soleil', 'nuage', 'pluie', 'neige', 'eclair', 'arc', 'aurore'] as const;
export type GoodId = (typeof GOOD_IDS)[number];

export interface GoodDef {
  id: GoodId;
  name: string;
  emoji: string;
  basePrice: number;
  /** Profondeur de marché de base (unités) : plus elle est grande, moins le prix chute quand on vend. */
  depth: number;
  color: string;
  client: string;
}

export const GOODS: Record<GoodId, GoodDef> = {
  vapeur: { id: 'vapeur', name: 'Vapeur', emoji: '💨', basePrice: 1, depth: 300, color: '#b8c7d9', client: 'Hammams & pressings' },
  soleil: { id: 'soleil', name: 'Rayon de soleil', emoji: '☀️', basePrice: 7, depth: 150, color: '#ffd34d', client: 'Plages & centrales solaires' },
  nuage: { id: 'nuage', name: 'Nuage', emoji: '☁️', basePrice: 12, depth: 100, color: '#e8f0ff', client: 'Studios de cinéma' },
  pluie: { id: 'pluie', name: 'Averse', emoji: '🌧️', basePrice: 105, depth: 50, color: '#5aa9ff', client: 'Coopératives agricoles' },
  neige: { id: 'neige', name: 'Neige', emoji: '❄️', basePrice: 300, depth: 35, color: '#c9f1ff', client: 'Stations de ski' },
  eclair: { id: 'eclair', name: 'Éclair', emoji: '⚡', basePrice: 1800, depth: 20, color: '#ffe066', client: 'Centrales électriques' },
  arc: { id: 'arc', name: 'Arc-en-ciel', emoji: '🌈', basePrice: 10250, depth: 12, color: '#ff7ad9', client: 'Mariages & festivals' },
  aurore: { id: 'aurore', name: 'Aurore boréale', emoji: '🌌', basePrice: 100000, depth: 6, color: '#6dffb0', client: 'Croisières polaires de luxe' },
};

export const BUILDING_IDS = ['evap', 'cond', 'capteur', 'semeur', 'cryo', 'forge', 'prisme', 'tisseur'] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];

export interface BuildingDef {
  id: BuildingId;
  name: string;
  emoji: string;
  good: GoodId;
  /** Intrants consommés par cycle (un cycle produit 1 unité avant bonus de rendement). */
  inputs: Partial<Record<GoodId, number>>;
  /** Cycles / seconde pour un bâtiment, avant bonus de vitesse. */
  rate: number;
  baseCost: number;
  growth: number;
  tier: number;
  desc: string;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  evap: { id: 'evap', name: 'Évaporateur', emoji: '♨️', good: 'vapeur', inputs: {}, rate: 1, baseCost: 12, growth: 1.08, tier: 0, desc: "Fait bouillir l'océan, une casserole à la fois." },
  cond: { id: 'cond', name: 'Condenseur', emoji: '🧊', good: 'nuage', inputs: { vapeur: 4 }, rate: 0.5, baseCost: 150, growth: 1.09, tier: 1, desc: 'Compresse la vapeur en jolis cumulus.' },
  capteur: { id: 'capteur', name: 'Capteur solaire', emoji: '🔆', good: 'soleil', inputs: {}, rate: 1.5, baseCost: 1500, growth: 1.1, tier: 0, desc: 'Récolte les rayons avant qu’ils ne touchent le sol.' },
  semeur: { id: 'semeur', name: 'Ensemenceur', emoji: '🌱', good: 'pluie', inputs: { nuage: 2 }, rate: 0.3, baseCost: 12000, growth: 1.11, tier: 2, desc: 'Ensemence les nuages pour déclencher des averses.' },
  cryo: { id: 'cryo', name: 'Cryo-tour', emoji: '🏔️', good: 'neige', inputs: { nuage: 3 }, rate: 0.25, baseCost: 120000, growth: 1.12, tier: 2, desc: 'Gèle les nuages à −40 °C. Ne pas lécher.' },
  forge: { id: 'forge', name: 'Forge à éclairs', emoji: '🌩️', good: 'eclair', inputs: { nuage: 2, pluie: 1 }, rate: 0.15, baseCost: 1.5e6, growth: 1.13, tier: 3, desc: "Frotte des nuages humides jusqu'à l'étincelle." },
  prisme: { id: 'prisme', name: 'Prisme géant', emoji: '🔮', good: 'arc', inputs: { pluie: 2, soleil: 4 }, rate: 0.1, baseCost: 2e7, growth: 1.14, tier: 3, desc: 'Une goutte, un rayon, et la magie opère.' },
  tisseur: { id: 'tisseur', name: "Tisseur d'aurores", emoji: '🧵', good: 'aurore', inputs: { eclair: 2, neige: 3, arc: 1 }, rate: 0.05, baseCost: 3e8, growth: 1.15, tier: 4, desc: 'Tisse le ciel polaire en rubans de lumière.' },
};

/** Paliers de bâtiments : chaque palier double la vitesse. */
export const MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000, 2500, 3000];

export function milestoneCount(n: number): number {
  let c = 0;
  for (const m of MILESTONES) if (n >= m) c++;
  return c;
}
export function nextMilestone(n: number): number | null {
  for (const m of MILESTONES) if (n < m) return m;
  return null;
}

// ─── Saisons ────────────────────────────────────────────────
export const SEASON_LENGTH = 180; // secondes
export interface SeasonDef {
  id: string;
  name: string;
  emoji: string;
  demand: Partial<Record<GoodId, number>>;
  sky: [string, string];
}
export const SEASONS: SeasonDef[] = [
  { id: 'printemps', name: 'Printemps', emoji: '🌸', demand: { pluie: 1.5, arc: 1.6, nuage: 1.15, neige: 0.5, aurore: 0.8 }, sky: ['#3a7bd5', '#9fd8ff'] },
  { id: 'ete', name: 'Été', emoji: '🌞', demand: { soleil: 1.6, pluie: 1.35, eclair: 1.45, neige: 0.3, vapeur: 0.85, aurore: 0.7 }, sky: ['#ff9a44', '#ffd56b'] },
  { id: 'automne', name: 'Automne', emoji: '🍂', demand: { nuage: 1.35, pluie: 1.2, eclair: 1.15, vapeur: 1.2, soleil: 0.8, aurore: 1.15 }, sky: ['#8e5a3c', '#f0a868'] },
  { id: 'hiver', name: 'Hiver', emoji: '⛄', demand: { neige: 2.1, aurore: 1.7, vapeur: 1.3, soleil: 0.65, pluie: 0.7, eclair: 0.6, arc: 0.8 }, sky: ['#1e2a4a', '#6f86b8'] },
];

// ─── Événements de marché ───────────────────────────────────
export interface EventDef {
  id: string;
  title: string;
  text: string;
  emoji: string;
  demand: Partial<Record<GoodId | 'all', number>>;
  duration: number;
  weight: number;
}
export const EVENTS: EventDef[] = [
  { id: 'secheresse', title: 'Sécheresse historique', text: 'Les agriculteurs supplient pour une goutte de pluie.', emoji: '🏜️', demand: { pluie: 2.6 }, duration: 75, weight: 10 },
  { id: 'jo', title: "Jeux olympiques d'hiver", text: 'Les pistes manquent de poudreuse !', emoji: '⛷️', demand: { neige: 3 }, duration: 70, weight: 8 },
  { id: 'festival', title: 'Festival des lumières', text: 'Toute la ville veut des arcs-en-ciel.', emoji: '🎆', demand: { arc: 3, soleil: 1.4 }, duration: 60, weight: 7 },
  { id: 'panne', title: 'Panne géante du réseau', text: 'Les centrales achètent des éclairs à prix d’or.', emoji: '🔌', demand: { eclair: 3 }, duration: 60, weight: 7 },
  { id: 'croisiere', title: 'Croisière de milliardaires', text: 'Ils veulent voir des aurores. Tout de suite.', emoji: '🛳️', demand: { aurore: 2.7 }, duration: 60, weight: 5 },
  { id: 'mariage', title: 'Mariage princier', text: 'Soleil ET arc-en-ciel exigés par contrat.', emoji: '👑', demand: { soleil: 2, arc: 2 }, duration: 55, weight: 6 },
  { id: 'cinema', title: 'Tournage hollywoodien', text: 'Le réalisateur veut des nuages « plus dramatiques ».', emoji: '🎬', demand: { nuage: 2.4 }, duration: 60, weight: 8 },
  { id: 'hammam', title: 'Mode du bien-être', text: 'Les hammams sont pris d’assaut.', emoji: '🧖', demand: { vapeur: 2.5 }, duration: 70, weight: 8 },
  { id: 'boom', title: 'Boom touristique', text: 'Les touristes achètent n’importe quelle météo.', emoji: '🧳', demand: { all: 1.4 }, duration: 80, weight: 6 },
  { id: 'krach', title: 'Krach du nuage', text: 'Un concurrent inonde le marché de cumulus bas de gamme.', emoji: '📉', demand: { nuage: 0.45 }, duration: 60, weight: 5 },
  { id: 'parapluies', title: 'Grève des parapluies', text: 'Plus personne ne veut de pluie sans parapluie.', emoji: '☂️', demand: { pluie: 0.5 }, duration: 55, weight: 4 },
  { id: 'eclipse', title: 'Éclipse totale', text: 'Le soleil se fait rare… et cher.', emoji: '🌑', demand: { soleil: 3 }, duration: 45, weight: 5 },
  { id: 'redoux', title: 'Redoux inattendu', text: 'La neige fond, personne n’en veut.', emoji: '🫠', demand: { neige: 0.45 }, duration: 55, weight: 4 },
];

// ─── Améliorations (argent) ─────────────────────────────────
export type UpgradeEffect =
  | { kind: 'yield'; building: BuildingId; mult: number }
  | { kind: 'price'; good: GoodId; mult: number }
  | { kind: 'global'; mult: number }
  | { kind: 'tap'; mult: number; pct: number }
  | { kind: 'storage'; mult: number }
  | { kind: 'contract'; mult: number }
  | { kind: 'bird'; mult: number }
  | { kind: 'reach'; mult: number };

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  cost: number;
  effect: UpgradeEffect;
  req: { building?: BuildingId; count?: number; earned?: number };
}

const TECH = [
  'Joints étanches', 'Turbines', 'Bobinages cuivre', 'Capteurs connectés', 'Alliage nimbus', 'Calibrage laser',
  'IA prédictive', 'Supraconducteurs', 'Nano-membranes', 'Fusion froide', 'Champs quantiques', 'Singularité douce',
  'Chrono-flux', 'Matière noire', 'Tissage stellaire',
];
const TIER_REQ = [10, 25, 50, 100, 150, 200, 300, 400, 500, 600, 750, 900, 1050, 1200, 1400];
const TIER_COST = [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15];

function buildUpgrades(): UpgradeDef[] {
  const list: UpgradeDef[] = [];
  for (const bid of BUILDING_IDS) {
    const b = BUILDINGS[bid];
    const g = GOODS[b.good];
    TIER_REQ.forEach((req, k) => {
      const isYield = k % 3 !== 1;
      list.push({
        id: `${bid}_${k}`,
        name: `${TECH[k]}`,
        emoji: b.emoji,
        desc: isYield ? `${b.name} : rendement ×2` : `${g.emoji} ${g.name} : prix de vente ×2`,
        cost: b.baseCost * Math.pow(b.growth, req) * TIER_COST[k],
        effect: isYield ? { kind: 'yield', building: bid, mult: 2 } : { kind: 'price', good: b.good, mult: 2 },
        req: { building: bid, count: req },
      });
    });
  }
  const globals = ['Lobbying climatique', 'Agence de pub', 'Franchise mondiale', 'Cotation en bourse', 'Monopole céleste', 'Contrat avec l’ONU', 'Base lunaire', 'Bourse interplanétaire', 'Météo galactique', 'Siège sur Mars', 'Empire des vents', 'Ciel privatisé', 'Hégémonie atmosphérique', 'Dieu du climat'];
  globals.forEach((name, i) => {
    const cost = 1e5 * Math.pow(1000, i);
    list.push({ id: `global_${i}`, name, emoji: '🏛️', desc: 'Tous les prix de vente ×2', cost, effect: { kind: 'global', mult: 2 }, req: { earned: cost / 5 } });
  });
  const taps = ['Doigts agiles', 'Gants en soie', 'Pouce bionique', 'Main de Zeus', 'Toucher divin', 'Paume cosmique'];
  taps.forEach((name, i) => {
    const cost = 250 * Math.pow(150, i);
    list.push({ id: `tap_${i}`, name, emoji: '👆', desc: 'Tap : gain de base ×3 et +1 % du revenu/s', cost, effect: { kind: 'tap', mult: 3, pct: 0.01 }, req: { earned: cost / 4 } });
  });
  ['Hangar', 'Silo géant', 'Entrepôt orbital', 'Poche dimensionnelle'].forEach((name, i) => {
    const cost = 3e3 * Math.pow(2000, i);
    list.push({ id: `storage_${i}`, name, emoji: '🏚️', desc: 'Capacité des stocks ×2', cost, effect: { kind: 'storage', mult: 2 }, req: { earned: cost / 4 } });
  });
  ['Service client', 'Juristes affûtés', 'Réseau d’influence'].forEach((name, i) => {
    const cost = 5e4 * Math.pow(5000, i);
    list.push({ id: `contract_${i}`, name, emoji: '📜', desc: 'Récompenses de contrats ×1,5', cost, effect: { kind: 'contract', mult: 1.5 }, req: { earned: cost / 4 } });
  });
  ['Nichoirs', 'Graines électriques', 'Sanctuaire'].forEach((name, i) => {
    const cost = 2e5 * Math.pow(8000, i);
    list.push({ id: `bird_${i}`, name, emoji: '🐦', desc: 'Oiseaux-tonnerre 25 % plus fréquents', cost, effect: { kind: 'bird', mult: 1.25 }, req: { earned: cost / 4 } });
  });
  ['Réseau de distributeurs', 'Export international', 'Marché mondial', 'Ventes interstellaires'].forEach((name, i) => {
    const cost = 8e4 * Math.pow(3000, i);
    list.push({ id: `reach_${i}`, name, emoji: '🌍', desc: 'Profondeur de tous les marchés ×2', cost, effect: { kind: 'reach', mult: 2 }, req: { earned: cost / 4 } });
  });
  return list.sort((a, b) => a.cost - b.cost);
}
export const UPGRADES: UpgradeDef[] = buildUpgrades();
export const UPGRADE_MAP: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// ─── Portée de marché (par bien) ────────────────────────────
export const REACH_MULT = 1.6;
export const REACH_COST_GROWTH = 3.2;
export function reachCost(good: GoodId, level: number): number {
  const g = GOODS[good];
  return g.basePrice * g.depth * 4 * Math.pow(REACH_COST_GROWTH, level);
}

// ─── Éther (prestige) ───────────────────────────────────────
export const ETHER_SCALE = 1e9;
export function etherFor(totalEarned: number): number {
  return Math.floor(20 * Math.cbrt(Math.max(0, totalEarned) / ETHER_SCALE));
}

export interface EtherUpgradeDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  max: number;
  cost: (lvl: number) => number;
}
export const ETHER_UPGRADES: EtherUpgradeDef[] = [
  { id: 'kit', name: 'Kit de démarrage', emoji: '🎒', desc: 'Chaque partie démarre avec 10 Évaporateurs et 5 Condenseurs par niveau.', max: 5, cost: (l) => 5 * Math.pow(3, l) },
  { id: 'seed', name: 'Capital de départ', emoji: '💰', desc: 'Démarre avec 1 000 $ (×30 par niveau suivant).', max: 5, cost: (l) => 8 * Math.pow(4, l) },
  { id: 'tap', name: 'Cumulus doré', emoji: '☁️', desc: 'Tap : gain de base ×5 et +1 % du revenu/s par niveau.', max: 5, cost: (l) => 6 * Math.pow(3, l) },
  { id: 'diplo', name: 'Diplomatie céleste', emoji: '🤝', desc: 'Profondeur de tous les marchés ×2 par niveau.', max: 8, cost: (l) => 12 * Math.pow(3.2, l) },
  { id: 'offline', name: 'Gardien de nuit', emoji: '🌙', desc: '+4 h de gains hors-ligne et +10 % d’efficacité par niveau.', max: 5, cost: (l) => 10 * Math.pow(2.5, l) },
  { id: 'contract', name: 'Contrats prestigieux', emoji: '📜', desc: 'Récompenses de contrats ×2 par niveau.', max: 5, cost: (l) => 20 * Math.pow(3, l) },
  { id: 'bird', name: 'Oiseau fidèle', emoji: '🐦', desc: 'Oiseaux-tonnerre 30 % plus fréquents et effets +25 % par niveau.', max: 4, cost: (l) => 25 * Math.pow(3, l) },
  { id: 'storage', name: 'Entrepôts éthérés', emoji: '📦', desc: 'Capacité de stockage ×3 par niveau.', max: 4, cost: (l) => 15 * Math.pow(3, l) },
  { id: 'storm', name: 'Tempête perpétuelle', emoji: '🌪️', desc: 'Jauge de pression −20 % de taps nécessaires, tempête +5 s par niveau.', max: 3, cost: (l) => 18 * Math.pow(3, l) },
  { id: 'reachstart', name: 'Réseau hérité', emoji: '🕸️', desc: 'Chaque marché démarre avec +2 niveaux de portée par niveau.', max: 5, cost: (l) => 30 * Math.pow(3, l) },
  { id: 'yield', name: 'Rendement éthéré', emoji: '🏔️', desc: 'Le rendement de toutes les machines ×2 par niveau.', max: 5, cost: (l) => 120 * Math.pow(4, l) },
  { id: 'crystal', name: 'Éther cristallisé', emoji: '💎', desc: 'Chaque Éther non dépensé donne +1 % supplémentaire.', max: 3, cost: (l) => 250 * Math.pow(10, l) },
  { id: 'auto', name: 'Contremaître', emoji: '🤖', desc: 'Achète automatiquement les améliorations abordables (≤ 10 % de votre trésorerie).', max: 1, cost: () => 150 },
  { id: 'forecast', name: 'Oracle météo', emoji: '🔭', desc: 'Révèle le prochain événement de marché et sa date.', max: 1, cost: () => 40 },
  { id: 'fast', name: 'Temps compressé', emoji: '⏩', desc: 'Toutes les machines tournent 50 % plus vite par niveau.', max: 6, cost: (l) => 60 * Math.pow(5, l) },
];
export const ETHER_UPGRADE_MAP: Record<string, EtherUpgradeDef> = Object.fromEntries(ETHER_UPGRADES.map((u) => [u.id, u]));

// ─── Boutique grêlons ───────────────────────────────────────
export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  cost: number;
}
export const SHOP: ShopItem[] = [
  { id: 'boost30', name: 'Turbo ×2', emoji: '🚀', desc: 'Double tous vos revenus pendant 30 minutes (cumulable).', cost: 10 },
  { id: 'warp1', name: 'Distorsion 1 h', emoji: '⏳', desc: 'Encaissez instantanément 1 heure de revenus.', cost: 20 },
  { id: 'warp8', name: 'Distorsion 8 h', emoji: '🌀', desc: 'Encaissez instantanément 8 heures de revenus.', cost: 120 },
  { id: 'bird', name: 'Appeau à oiseau', emoji: '🪶', desc: 'Fait apparaître un Oiseau-tonnerre immédiatement.', cost: 4 },
  { id: 'reroll', name: 'Nouveaux contrats', emoji: '🔄', desc: 'Remplace toutes les offres de contrats.', cost: 2 },
];

// ─── Bonus quotidien ────────────────────────────────────────
export const DAILY_REWARDS: { grelons: number; boostMin?: number; label: string }[] = [
  { grelons: 5, label: '5 🧊' },
  { grelons: 0, boostMin: 15, label: 'Turbo 15 min' },
  { grelons: 10, label: '10 🧊' },
  { grelons: 5, boostMin: 30, label: '5 🧊 + Turbo 30 min' },
  { grelons: 15, label: '15 🧊' },
  { grelons: 10, boostMin: 60, label: '10 🧊 + Turbo 1 h' },
  { grelons: 40, label: '40 🧊 Coffre !' },
];

// ─── Contrats ───────────────────────────────────────────────
export const CLIENT_NAMES: Record<GoodId, string[]> = {
  vapeur: ['Hammam du Sultan', 'Pressing Éclatant', 'Spa des Alpes', 'Locomotives Rétro'],
  soleil: ['Plage de Biarritz', 'Solaire & Fils', 'Club de bronzage', 'Serres de Hollande'],
  nuage: ['Studio Pixelune', 'Météo-France (en secret)', 'Peintres impressionnistes', 'Fabrique de barbe à papa'],
  pluie: ['Coopérative de Beauce', 'Golf de Saint-Andrews', 'Rizières du Mékong', 'Club des escargots'],
  neige: ['Station de Courchevel', 'Père Noël SARL', 'Bataille de boules de neige', 'Igloo Hôtel'],
  eclair: ['Centrale de Tesla', 'Dr Frankenstein', 'Fête foraine', 'Ligue de foudre-ball'],
  arc: ['Mariage de Lucie & Hugo', 'Licorne Corp.', 'Festival de Glastonbury', 'Pot d’or des Leprechauns'],
  aurore: ['Croisière Arctique Prestige', 'Lune de miel royale', 'Observatoire boréal', 'Gala de milliardaires'],
};

// ─── Succès ─────────────────────────────────────────────────
export type AchCond =
  | { kind: 'building'; building: BuildingId; n: number }
  | { kind: 'earned'; n: number }
  | { kind: 'taps'; n: number }
  | { kind: 'birds'; n: number }
  | { kind: 'contracts'; n: number }
  | { kind: 'prestiges'; n: number }
  | { kind: 'ether'; n: number }
  | { kind: 'income'; n: number }
  | { kind: 'storms'; n: number }
  | { kind: 'allBuildings'; n: number }
  | { kind: 'reach'; n: number };

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  cond: AchCond;
  reward: number; // grêlons
}

function buildAchievements(): AchievementDef[] {
  const list: AchievementDef[] = [];
  const counts = [1, 25, 100, 250, 500, 1000];
  const titles = ['Premier pas', 'Petite série', 'Production de masse', 'Industriel', 'Titan', 'Légende'];
  for (const bid of BUILDING_IDS) {
    const b = BUILDINGS[bid];
    counts.forEach((n, i) => {
      list.push({ id: `b_${bid}_${n}`, name: `${titles[i]} : ${b.name}`, desc: `Posséder ${n} ${b.name}${n > 1 ? 's' : ''}`, emoji: b.emoji, cond: { kind: 'building', building: bid, n }, reward: 1 + i });
    });
  }
  const earnNames = ['Argent de poche', 'Petite entreprise', 'Millionnaire', 'Milliardaire', 'Billionnaire', 'Magnat', 'Ploutocrate', 'Puissance mondiale', 'Ressource planétaire', 'Fortune stellaire', 'Trésor galactique', 'Richesse infinie'];
  earnNames.forEach((name, i) => {
    const n = Math.pow(1000, i + 1);
    list.push({ id: `earn_${i}`, name, desc: `Gagner ${n.toExponential(0).replace('e+', 'e')} $ au total`, emoji: '💰', cond: { kind: 'earned', n }, reward: 2 + i });
  });
  [[100, 'Tapoteur'], [1000, 'Pianiste'], [10000, 'Marteau-piqueur'], [50000, 'Doigt d’acier']].forEach(([n, name], i) =>
    list.push({ id: `tap_${n}`, name: name as string, desc: `Taper ${n} fois sur le nuage`, emoji: '👆', cond: { kind: 'taps', n: n as number }, reward: 2 + i * 2 }));
  [[1, 'Ornithologue'], [10, 'Charmeur d’oiseaux'], [50, 'Volière céleste'], [200, 'Seigneur des tempêtes']].forEach(([n, name], i) =>
    list.push({ id: `bird_${n}`, name: name as string, desc: `Attraper ${n} Oiseau${(n as number) > 1 ? 'x' : ''}-tonnerre`, emoji: '🐦', cond: { kind: 'birds', n: n as number }, reward: 2 + i * 2 }));
  [[1, 'Premier client'], [10, 'Fournisseur fiable'], [50, 'Partenaire privilégié'], [200, 'Incontournable']].forEach(([n, name], i) =>
    list.push({ id: `contract_${n}`, name: name as string, desc: `Honorer ${n} contrat${(n as number) > 1 ? 's' : ''}`, emoji: '📜', cond: { kind: 'contracts', n: n as number }, reward: 2 + i * 3 }));
  [[1, 'Renaissance'], [5, 'Cycle éternel'], [25, 'Maître du temps']].forEach(([n, name], i) =>
    list.push({ id: `prestige_${n}`, name: name as string, desc: `Effectuer ${n} prestige${(n as number) > 1 ? 's' : ''}`, emoji: '✨', cond: { kind: 'prestiges', n: n as number }, reward: 5 + i * 10 }));
  [[100, 'Éthéré'], [10000, 'Être de lumière'], [1e6, 'Divinité']].forEach(([n, name], i) =>
    list.push({ id: `ether_${n}`, name: name as string, desc: `Posséder ${n} Éther au total`, emoji: '💠', cond: { kind: 'ether', n: n as number }, reward: 5 + i * 10 }));
  [[10, 'Ça tourne'], [1e3, 'Machine à cash'], [1e6, 'Planche à billets'], [1e9, 'Robinet d’or'], [1e12, 'Cascade de dollars'], [1e18, 'Trou noir financier']].forEach(([n, name], i) =>
    list.push({ id: `income_${i}`, name: name as string, desc: `Atteindre ${(n as number).toLocaleString('fr-FR')} $/s`, emoji: '📈', cond: { kind: 'income', n: n as number }, reward: 2 + i * 2 }));
  [[1, 'Œil du cyclone'], [25, 'Chasseur de tempêtes'], [100, 'Ouragan vivant']].forEach(([n, name], i) =>
    list.push({ id: `storm_${n}`, name: name as string, desc: `Déclencher ${n} tempête${(n as number) > 1 ? 's' : ''}`, emoji: '🌪️', cond: { kind: 'storms', n: n as number }, reward: 2 + i * 3 }));
  [[1, 'Chaîne complète'], [50, 'Écosystème'], [200, 'Ciel maîtrisé']].forEach(([n, name], i) =>
    list.push({ id: `all_${n}`, name: name as string, desc: `Posséder au moins ${n} de chaque bâtiment`, emoji: '🌐', cond: { kind: 'allBuildings', n: n as number }, reward: 5 + i * 5 }));
  [[10, 'Commerçant'], [40, 'Négociant'], [100, 'Empire commercial']].forEach(([n, name], i) =>
    list.push({ id: `reach_${n}`, name: name as string, desc: `Cumuler ${n} niveaux de portée de marché`, emoji: '🌍', cond: { kind: 'reach', n: n as number }, reward: 3 + i * 3 }));
  return list;
}
export const ACHIEVEMENTS: AchievementDef[] = buildAchievements();
/** Bonus de prix par succès débloqué. */
export const ACH_BONUS = 0.02;

// ─── Quêtes quotidiennes ────────────────────────────────────
export type QuestKind = 'taps' | 'contracts' | 'birds' | 'buy' | 'storms' | 'sell';
export const QUEST_TEMPLATES: { kind: QuestKind; label: (n: number) => string; amounts: number[]; reward: number }[] = [
  { kind: 'taps', label: (n) => `Taper ${n} fois sur le nuage`, amounts: [150, 300, 500], reward: 4 },
  { kind: 'contracts', label: (n) => `Honorer ${n} contrat${n > 1 ? 's' : ''}`, amounts: [2, 3, 5], reward: 6 },
  { kind: 'birds', label: (n) => `Attraper ${n} Oiseau${n > 1 ? 'x' : ''}-tonnerre`, amounts: [1, 2, 3], reward: 5 },
  { kind: 'buy', label: (n) => `Acheter ${n} bâtiments`, amounts: [50, 100, 200], reward: 4 },
  { kind: 'storms', label: (n) => `Déclencher ${n} tempête${n > 1 ? 's' : ''}`, amounts: [1, 2, 3], reward: 5 },
  { kind: 'sell', label: (n) => `Vendre manuellement ${n} fois au-dessus de 120 % du prix`, amounts: [2, 4, 6], reward: 5 },
];
