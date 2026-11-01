# Bilan de la semaine par e-mail : mise en place

Chaque dimanche vers 7 h (heure de Paris), GitHub lance `send.mjs`. Il prépare le bilan de chaque utilisateur qui a coché « Par e-mail » dans l'appli (menu → Bilan de la semaine), puis l'envoie depuis ton adresse Gmail.

C'est gratuit et ça ne demande pas le forfait payant de Firebase. Tant que les 3 secrets ci-dessous ne sont pas ajoutés, rien n'est envoyé.

## 1. Un mot de passe d'application Gmail (2 min)

1. Active la validation en deux étapes sur ton compte Google si ce n'est pas déjà fait : https://myaccount.google.com/signinoptions/twosv
2. Va sur https://myaccount.google.com/apppasswords, nomme-le `TrackLift`, puis **Créer**.
3. Copie les 16 lettres affichées. Ce n'est pas ton vrai mot de passe : tu peux le supprimer à tout moment, et l'envoi s'arrête.

## 2. Une clé Firebase (2 min)

1. Ouvre la console Firebase, projet `trackliftbdd`.
2. Clique sur la roue dentée → **Paramètres du projet** → onglet **Comptes de service**.
3. Clique sur **Générer une nouvelle clé privée**. Un fichier `.json` se télécharge.
4. Ne mets jamais ce fichier dans le dossier de l'appli, ni dans GitHub : il donne accès à toute la base. Supprime-le de ton ordinateur une fois l'étape 3 faite.

## 3. Les 3 secrets dans GitHub (2 min)

Sur GitHub, ouvre le dépôt `tracklift.github.io`, puis **Settings** → **Secrets and variables** → **Actions** → **New repository secret** :

| Nom | Valeur |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | tout le contenu du fichier `.json` de l'étape 2 (ouvre-le avec le Bloc-notes, copie tout) |
| `GMAIL_USER` | ton adresse Gmail |
| `GMAIL_APP_PASSWORD` | les 16 lettres de l'étape 1 |

Les secrets ne sont visibles par personne, même pas dans les journaux.

## 4. Allumer l'option dans l'appli

Dans `js/bilan-config.js`, passe `BILAN_EMAIL_READY` à `true`, puis publie. L'interrupteur « Par e-mail » devient alors utilisable.

## 5. Essayer

1. Dans l'appli, coche « Par e-mail » (menu → Bilan de la semaine).
2. Sur GitHub, onglet **Actions** → **Bilan de la semaine** → **Run workflow**.
3. Laisse « oui » pour un essai : rien n'est envoyé, et le journal affiche seulement des nombres (combien de bilans sont prêts).
4. Relance avec « non » pour envoyer pour de vrai le bilan du dernier dimanche. Un bilan n'est jamais envoyé deux fois à la même personne.

## Bon à savoir

- **Qui reçoit quoi** : seulement les utilisateurs qui ont coché « Par e-mail », à l'adresse de leur compte Google (jamais une adresse tapée à la main). Chaque e-mail part à une seule personne : personne ne voit l'adresse des autres.
- **Ta boîte Gmail** : les bilans envoyés apparaissent dans tes « Messages envoyés ». Gmail limite l'envoi à environ 500 e-mails par jour.
- **Journaux publics** : le dépôt est public, donc les journaux GitHub aussi. Le programme n'y écrit aucune adresse, aucun nom et aucun identifiant, seulement des nombres.
- **Pause automatique de GitHub** : si le dépôt ne reçoit aucune modification pendant 60 jours, GitHub met en pause les tâches du dimanche. Pour les relancer : onglet **Actions** → **Bilan de la semaine** → **Enable workflow**.
- **Tout arrêter** : supprime le mot de passe d'application (étape 1), ou désactive la tâche dans l'onglet **Actions**.
- **Aperçu sur ton ordinateur**, sans rien installer : exporte tes données depuis l'appli (menu → Exporter mes données), puis lance
  `node tools/bilan/send.mjs --apercu <fichier exporté>.json`. Le fichier `bilan-apercu.html` montre l'e-mail tel qu'il serait envoyé.
