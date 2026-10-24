# Connexion Notion pour TrackLift

Les utilisateurs de TrackLift peuvent connecter leur propre compte Notion (comme « Se connecter avec Google »), choisir leurs bases et les importer en programme. Ça demande deux choses, à faire **une seule fois** par le propriétaire de l'appli :

1. une **intégration publique Notion** (elle fournit l'écran « Autoriser TrackLift »),
2. un **relais** gratuit (Cloudflare Worker) qui garde le secret de l'intégration. L'API Notion refuse les appels faits directement depuis un navigateur, et le secret ne doit jamais être dans un site public.

Tant que ce n'est pas fait, l'onglet « Mon Notion » indique que la connexion n'est pas activée, et l'import par fichier CSV reste disponible.

## 1. Déployer le relais (5 min, gratuit)

On commence par le relais, car son adresse sert à l'étape 2.

1. Crée un compte sur https://dash.cloudflare.com.
2. **Workers & Pages** → **Créer** → **Créer un Worker** → nomme-le `tracklift-notion` → **Déployer**.
3. **Modifier le code** : remplace tout par le contenu de `worker.js`, puis **Déployer**.
4. Note l'adresse du Worker, par exemple `https://tracklift-notion.<ton-compte>.workers.dev`.

## 2. Créer l'intégration publique Notion (5 min)

1. Va sur https://www.notion.so/profile/integrations, puis **Nouvelle intégration**.
2. Nom : `TrackLift`. Type : **Publique**.
3. Capacités : **Lire le contenu** uniquement (TrackLift n'écrit jamais dans Notion).
4. **URI de redirection** : `https://tracklift-notion.<ton-compte>.workers.dev/oauth/callback`. Elle doit être identique, au caractère près.
5. Notion demande aussi un site web, une politique de confidentialité et des conditions d'utilisation : l'adresse de l'appli (`https://assalasarab.github.io/tracklift.github.io/`) peut servir pour les trois au début.
6. Enregistre, puis copie l'**ID client OAuth** et le **secret client OAuth**.

## 3. Donner les clés au relais

Dans Cloudflare : Worker `tracklift-notion` → **Paramètres** → **Variables et secrets** :

| Nom | Type | Valeur |
|---|---|---|
| `NOTION_CLIENT_ID` | Texte | l'ID client OAuth |
| `NOTION_CLIENT_SECRET` | **Secret** | le secret client OAuth |
| `ALLOWED_ORIGINS` | Texte | `https://assalasarab.github.io` (ajoute `,http://127.0.0.1:8765` pour tester en local) |

Puis **Déployer**.

## 4. Brancher l'appli

Dans `js/notion-config.js`, mets l'adresse du Worker :

```js
export const NOTION_PROXY_URL = "https://tracklift-notion.<ton-compte>.workers.dev";
```

Puis publie le site. Le bouton **Connecter mon Notion** apparaît dans : menu profil → **Importer depuis Notion**, ainsi que dans le questionnaire de départ (« Il est dans Notion »).

## Ce qui se passe pour l'utilisateur

1. **Connecter mon Notion** → page Notion « Autoriser TrackLift » → il coche les pages qui contiennent ses séances.
2. Retour dans l'appli : la liste de ses bases s'affiche, il coche une base par séance.
3. L'appli lit les bases et propose une correspondance pour chaque exercice. Il peut la changer, créer l'exercice en perso ou l'ignorer.
4. **Créer le programme** : une séance par base, avec les séries, les reps et les charges.

Le jeton Notion de l'utilisateur est enregistré dans son document Firestore (`users/<uid>`, champ `notion`). Il n'est pas inclus dans l'export JSON, et **Déconnecter** le supprime. Les règles Firestore doivent limiter chaque document `users/<uid>` à son propriétaire, ce qui est déjà le cas si elles suivent le modèle `allow read, write: if request.auth.uid == userId`.

## Format de base reconnu

**Une ligne = une série** (format de « salas workout ») :

| Exercice | Poids (kg) | Répétition | Type | Poids 2 (baisse de charge) | Répétition 2 (baisse de charge) | STATUT |
|---|---|---|---|---|---|---|
| Développé incliné Smith | 51 | 15 | Chauffe | | | actif |
| Développé incliné Smith | 78,5 | 5 | Travail | 66 | 4 | actif |
| Pec fly | 80 | 7 | Travail | | | en pause |

- Les lignes d'un même exercice sont regroupées, même avec des différences de majuscules, d'accents, un suffixe « (1) » ou une faute de frappe.
- **Type** : « Chauffe » donne une série de chauffe, le reste des séries de travail.
- **Poids 2 / Répétition 2** : une baisse de charge, enchaînée sans repos pendant la séance.
- **STATUT** « en pause » : la ligne est ignorée (une case permet de l'inclure quand même).
- Les noms des colonnes sont détectés automatiquement et modifiables dans « Colonnes utilisées ».

**Une ligne = un exercice** marche aussi, avec une colonne **Séries**. Si les lignes ont une **Date**, l'appli propose en plus d'importer l'historique des séances.
