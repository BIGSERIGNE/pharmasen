# PHARMASEN

Plateforme de connexion pharmacies-clients au Sénégal.

## Installation

```bash
# 1. Clone le projet
git clone https://github.com/BIGSERIGNE/pharmasen.git
cd pharmasen

# 2. Installe les dépendances
npm install

# 3. Copie le fichier d'environnement
cp .env.example .env

# 4. Remplis .env avec tes clés Supabase
#    VITE_SUPABASE_URL=...
#    VITE_SUPABASE_ANON_KEY=...

# 5. Lance le projet
npm run dev
```

## Stack technique

| Technologie | Usage |
|---|---|
| React 19 + TypeScript | Interface utilisateur |
| Vite | Bundler et serveur de développement |
| Tailwind CSS + Shadcn/UI | Styles et composants |
| Supabase | Base de données + authentification |
| React Router DOM | Navigation |
| TanStack Query | Gestion des données asynchrones |

## Configuration Supabase

Crée un projet sur [supabase.com](https://supabase.com) puis génère les tables suivantes :

| Table | Description |
|---|---|
| `profiles` | Utilisateurs (client, pharmacist, admin) |
| `pharmacies` | Pharmacies partenaires |
| `medicines` | Médicaments par pharmacie |
| `orders` | Commandes clients |
| `categories` | Catégories de médicaments |
| `notifications` | Notifications utilisateurs |

## Rôles utilisateurs

- **client** → accès à `/home`, recherche de pharmacies, commandes
- **pharmacist** → accès à `/pharma/dashboard`, gestion stock et commandes
- **admin** → accès à `/admin/dashboard`, gestion des utilisateurs

## Variables d'environnement

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | URL de ton projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé publique (anon) Supabase |

> Ces valeurs se trouvent dans **Supabase → Settings → API**.
