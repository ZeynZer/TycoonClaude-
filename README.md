# ☁️ Stratos — L'usine à météo

Un **tycoon idle en PWA** (installable sur mobile et PC, jouable hors ligne) dans lequel vous dirigez la première usine de météo au monde : vous faites bouillir l'océan, condensez des nuages, ensemencez des averses, forgez des éclairs et tissez des aurores boréales… puis vous vendez tout ça sur une bourse météo vivante.

## 🎮 Boucle de jeu

| Étage | Bâtiment | Produit | Intrants |
|---|---|---|---|
| 0 | ♨️ Évaporateur | 💨 Vapeur | — |
| 1 | 🧊 Condenseur | ☁️ Nuage | 4 💨 |
| 0 | 🔆 Capteur solaire | ☀️ Rayon de soleil | — |
| 2 | 🌱 Ensemenceur | 🌧️ Averse | 2 ☁️ |
| 2 | 🏔️ Cryo-tour | ❄️ Neige | 3 ☁️ |
| 3 | 🌩️ Forge à éclairs | ⚡ Éclair | 2 ☁️ + 1 🌧️ |
| 3 | 🔮 Prisme géant | 🌈 Arc-en-ciel | 2 🌧️ + 4 ☀️ |
| 4 | 🧵 Tisseur d'aurores | 🌌 Aurore boréale | 2 ⚡ + 3 ❄️ + 1 🌈 |

Les étages supérieurs consomment la production fraîche des étages inférieurs. Un convertisseur mal alimenté affiche son **efficacité** : vous devez équilibrer toute la chaîne.

## 📈 L'économie

- **Coûts exponentiels** (×1,08 à ×1,15 par bâtiment) et **paliers** (10, 25, 50, 100, 150, 200, 300…) qui doublent la vitesse.
- **154 améliorations** : rendement ×2, prix ×2, multiplicateurs globaux, taps, stockage, contrats, portée.
- **Bourse vivante** : chaque bien a un prix qui dépend de
  - la **saison** (4 saisons de 3 min : la neige vaut ×2,1 en hiver, le soleil ×1,6 en été…),
  - des **événements** aléatoires (sécheresse, JO d'hiver, panne géante, krach du nuage…),
  - d'une **tendance** aléatoire (processus d'Ornstein-Uhlenbeck),
  - de la **saturation** : plus vous vendez, plus le prix baisse (jusqu'à 30 % du prix), puis le marché récupère. La recette d'une grosse vente est calculée par intégrale exacte.
- **Portée de marché** par bien : élargit la demande (×1,6 par niveau).
- **Stockage et spéculation** : coupez la vente auto d'un bien, stockez-le, puis revendez-le au pic de sa saison ou pendant un événement.
- **Contrats** : des clients commandent X unités dans un délai ; la production est captée en priorité. Récompense 3 à 4× la valeur du marché, parfois des grêlons.

## 🔥 Les mécaniques addictives

- **Tap** sur le nuage géant (+ coups critiques), qui remplit une **jauge de pression** → **Tempête** ×3 pendant 15 s.
- **Oiseau-tonnerre** qui traverse le ciel : frénésie ×7, pluie d'or, marché fou, grêlons.
- **Prestige « Nouvelle ère climatique »** : gagnez de l'**Éther** 💠 (+2 % de revenus chacun) et dépensez-le dans un arbre de 15 améliorations permanentes (le dilemme : dépenser fait perdre du bonus passif).
- **Gains hors-ligne** (2 h à 50 % de base, améliorables), doublables avec des grêlons.
- **Bonus quotidien** sur 7 jours, **3 missions quotidiennes**, **93 succès** (+2 % chacun), **boutique de grêlons** 🧊 (turbo ×2, distorsions temporelles…).
- **Ciel vivant** dessiné en temps réel : il pleut quand vous produisez de la pluie, il neige, des éclairs zèbrent le ciel, un arc-en-ciel apparaît, des aurores dansent la nuit, avec un cycle jour/nuit et les saisons.
- Sons synthétisés (aucun fichier audio), vibrations, confettis, nombres flottants, toasts.
- **Classement en ligne et sauvegarde cloud** (Supabase, sans compte), code de transfert entre appareils.

## ⚖️ Équilibrage

`scripts/simulate.ts` fait jouer un bot glouton pendant des heures simulées pour vérifier la courbe de progression (déblocages, prestiges, absence d'emballement) :

```bash
npx tsx scripts/simulate.ts 6 1   # 6 h, joueur actif
npx tsx scripts/simulate.ts 3 0   # 3 h, joueur passif
```

L'Éther suit une racine cubique des gains totaux, ce qui garantit une boucle de prestige convergente.

## 🛠️ Développement

```bash
npm install
npm run dev      # serveur de dev
npm test         # tests unitaires (vitest)
npm run build    # build de production + service worker
```

Stack : Vite + React + TypeScript, `vite-plugin-pwa` (Workbox). Le moteur de jeu (`src/game`) est en TypeScript pur, sans dépendance à React.

### Cloud (optionnel)

1. Appliquer `supabase/migrations/20261121000000_tycoon_cloud.sql` sur un projet Supabase.
2. Créer un fichier `.env.local` (ou des variables de build) :
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_KEY=<clé publishable/anon>
   ```
Sans ces variables, le jeu fonctionne entièrement hors ligne et l'onglet Classement est simplement désactivé.

### Déploiement

Le workflow `.github/workflows/deploy.yml` publie le jeu sur **GitHub Pages** à chaque push sur `main` (activer *Settings → Pages → Source : GitHub Actions*).
