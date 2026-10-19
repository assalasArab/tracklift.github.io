# Relais Notion pour TrackLift

TrackLift importe tes entraînements depuis une base Notion. L'API Notion refuse les appels faits directement depuis un navigateur, et elle exige une clé secrète qu'on ne doit jamais mettre dans un site public. Ce petit relais (un Cloudflare Worker gratuit) garde la clé côté serveur et transmet les données à l'appli.

Pas envie de configurer ça ? Dans l'appli, l'onglet **Fichier CSV** fonctionne sans relais : exporte ta base depuis Notion et importe le fichier.

## 1. Créer l'intégration Notion (2 min)

1. Va sur https://www.notion.so/profile/integrations, puis **Nouvelle intégration**.
2. Nom : `TrackLift`. Type : **Interne**. Capacités : **Lire le contenu** suffit.
3. Copie le **jeton secret** (il commence par `ntn_` ou `secret_`).
4. Ouvre ta base d'entraînements dans Notion, puis **⋯** → **Connexions** → ajoute **TrackLift**.

## 2. Déployer le relais (3 min, gratuit)

1. Crée un compte sur https://dash.cloudflare.com.
2. **Workers & Pages** → **Créer** → **Créer un Worker** → nomme-le `tracklift-notion` → **Déployer**.
3. **Modifier le code** : remplace tout par le contenu de `worker.js`, puis **Déployer**.
4. **Paramètres** → **Variables et secrets** :
   - `NOTION_TOKEN`, de type **Secret** : colle le jeton de l'étape 1.
   - `ALLOWED_ORIGINS`, de type **Texte** : `https://assalasarab.github.io` (ajoute `,http://localhost:5500` si tu testes en local).
5. Note l'adresse du Worker, du type `https://tracklift-notion.<ton-compte>.workers.dev`.

## 3. Connecter l'appli

Menu profil → **Importer depuis Notion** → onglet **API Notion** :

- **Adresse du relais** : l'adresse du Worker.
- **Lien de la base** : copie le lien de ta base Notion (⋯ → Copier le lien).

L'appli détecte les colonnes automatiquement, et tu peux corriger l'association avant d'importer.

## Format de base conseillé

Une ligne = un exercice d'une séance :

| Date | Séance | Exercice | Séries | Reps | Poids |
|------|--------|----------|--------|------|-------|
| 19/10/2026 | Push A | Développé couché | 4 | 8 | 80 |
| 19/10/2026 | Push A | Élévations latérales | 3 | 12,12,10 | 10 |

- **Reps** et **Poids** acceptent une liste (`8,8,6`) : une valeur par série.
- Sans colonne **Séries**, chaque ligne compte pour une série.
- Une séance déjà importée (même date, même nom) n'est jamais importée deux fois.
- Les exercices sont reconnus par leur nom, en français ou en anglais. Un nom inconnu est gardé tel quel.
