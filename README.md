# KODACHECK — Frontend

Plateforme de vérification des engins signalés volés : registre national, contrôle terrain (avec lecture de plaque
et mode hors-ligne) et déclaration en ligne pour les citoyens.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS · Supabase (auth, base, temps réel, Edge Functions) · Dexie (IndexedDB) · Tesseract.js (OCR local)

## Démarrage

```bash
npm install
cp .env.example .env   # puis renseigner l'URL et la clé anon du projet Supabase
npm run dev
```

| Script | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Vérification TypeScript puis build de production |
| `npm run typecheck` | Vérification TypeScript seule |
| `npm run lint` | Analyse statique (oxlint) |

## Rôles et espaces

| Rôle | Espace |
| --- | --- |
| `super_admin` | Commissariats, comptes commissaires, vue nationale |
| `commissaire` | Agents de son commissariat, signalements de l'unité |
| `agent_bureau` | Registre national, saisie de PV, signalements citoyens |
| `agent_terrain` | Vérification instantanée, scan de plaque, alertes en direct, hors-ligne |
| (public) | Espace citoyen : `/#citoyen` |

## Comptes et connexion

Les comptes sont créés **uniquement** par l'Edge Function `create-agent` (la clé `service_role` ne doit jamais être
dans le frontend). Chaque compte reçoit un matricule `MAT-XXXXXX` ; l'identifiant Supabase est
`mat-xxxxxx@kodacheck.com`, et l'agent se connecte avec son matricule.

Déploiement de la fonction :

```bash
supabase functions deploy create-agent --project-ref <ref-du-projet>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournies automatiquement par Supabase.

## Structure

```
src/
  components/ui/        Kit d'interface (boutons, champs, cartes, modales, onglets…)
  components/layout/    Logo, en-tête et mise en page des tableaux de bord
  components/vehicles/  Fiche engin, restitution, impression
  context/              Thème, authentification, notifications
  hooks/                Registre terrain (en ligne / hors-ligne / temps réel)
  lib/                  Supabase, base locale, utilitaires
  pages/                Écrans par rôle + espace public
supabase/functions/     Edge Functions
```
