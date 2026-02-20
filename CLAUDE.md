# CLAUDE.md — wB CTF Analytics

## Project Overview

Static website for analyzing Quake CTF team performance (focused on **wAnnaBees**). All processing happens in-browser — no backend, no database. User uploads a JSON match export from qllr, the site cross-references it with config files baked into the repo, and renders interactive dashboards.

## Tech Stack

- **Framework**: React 19 (Vite 7)
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Charts**: Recharts
- **Deployment**: GitHub Pages (base path: `/wb-ctf-analytics/`)
- **No backend** — everything runs client-side

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build to dist/
npm run preview  # Preview production build
npm run lint     # ESLint
```

## Project Structure

```
├── public/data/                  # Config files (checked into repo)
│   ├── player_registry.json      # Player lookup: canonical names, steam IDs, aliases, team eras
│   ├── team_config.json          # Teams, maps, thresholds, role normalization
│   └── manual_roles.json         # Role annotations per match
├── src/
│   ├── etl/                      # ETL pipeline (pure JS, no React)
│   │   ├── index.js              # Orchestrator: processData() runs full pipeline
│   │   ├── normalizeNick.js       # Clan-tag stripping (used by parseMatches before alias lookup)
│   │   ├── parseMatches.js       # Step 1: Raw JSON → normalized matches[] + playerRows[]
│   │   ├── resolveTeams.js       # Step 2: Player → team assignment per era
│   │   ├── classifySides.js      # Step 3: FULL_TEAM / STACK_3PLUS / MIX classification
│   │   ├── datasetFlags.js       # Step 4: loose/strict/h2h/standings qualification flags
│   │   ├── computeStats.js       # Step 5: DPM, net damage, K/D, HHI, pair/lineup stats
│   │   └── parseRoles.js         # Step 6: Manual role string → structured roles
│   ├── views/                    # Dashboard pages (React components)
│   │   └── DataHealth.jsx        # Sanity check: unresolved players, exclusions, flags
│   ├── components/               # Reusable UI components
│   │   └── FileUpload.jsx        # JSON file upload widget
│   ├── App.jsx                   # Root app: upload flow → DataHealth view
│   ├── main.jsx                  # React entry point
│   └── index.css                 # Tailwind import + CSS custom properties
├── index.html
├── vite.config.js
└── package.json
```

## Architecture: ETL Pipeline

The core of the app is the ETL pipeline in `src/etl/`. It's **pure JavaScript with no React dependencies** — designed to be testable in isolation.

### Pipeline Flow

```
processData(rawJson, playerRegistry, teamConfig, manualRoles)
  → Step 1: parseMatches()     — raw JSON → matches[] + playerRows[]
  → Step 2: resolveTeams()     — assigns team_membership per era (mutates playerRows)
  → Step 3: classifySides()    — classifies each match side (mutates matches)
  → Step 4: datasetFlags()     — adds qualification flags (mutates matches)
  → Step 5: computeStats()     — derived stats + teamMatchRows + pair/lineup stats
  → Step 6: parseRoles()       — parses manual role strings, merges into playerRows
  → Scope filter               — filters to matches after scope_date
```

### Key Data Structures

- **matches[]** — one row per match: scores, sides, map, duration, classification, flags
- **playerRows[]** — one row per player per match: stats, team, role, derived metrics
- **teamMatchRows[]** — one row per team appearance per match: aggregated team stats
- **pairStats[]** — win rate for every 2-player combo on focus team
- **lineupStats[]** — win rate for every 4-player lineup on focus team

### Important Conventions

- **steam_id is always a string** — never parse as number (too large for JS number)
- **Nick → canonical resolution**: strip clan tags (normalizeNick) → casefold → alias lookup → canonical match → fallback to raw nick (flagged UNRESOLVED)
- **Clan tag stripping**: `clan_tag_patterns` in team_config.json define regex patterns (e.g. `^CUBA`, `^wB[_ ]?`, `\\|`) applied before alias lookup
- **Era-based team assignment**: uses `scope_date` from team_config.json to decide team_2024 vs team_2026
- **Side classification hierarchy**: FULL_TEAM (all same team) > STACK_3PLUS (≥3) > MIX
- **Dataset flags**: loose/strict/h2h/standings — used by views to filter meaningful matches
- **HHI (Herfindahl index)**: 0.25 = perfectly equal damage distribution, 1.0 = one player did everything
- **Mutations**: Steps 2-4 mutate matches/playerRows in place for performance. Step 5 also mutates playerRows for per-player stats.

## Config Files

### player_registry.json
Array of player entries. Fields: `canonical`, `steam_id` (string!), `aliases` (array), `team_2024`, `team_2026`, `team_2026_short`, `notes`. Update when rosters change.

### team_config.json
- `focus_team`: the team being analyzed (e.g., "wAnnaBees")
- `scope_date`: cutoff date; matches before this use team_2024, after use team_2026
- `format_filter`: "4v4"
- `min_sample`: minimum game thresholds for maps, lineups, pairs
- `teams_2026`: team metadata (short name, color)
- `maps`: map name → short display name
- `clan_tag_patterns`: array of regex strings for stripping clan tags from nicks (e.g. `^CUBA`, `^wB[_ ]?`, `\\|`)
- `role_normalize`: shorthand role tokens → normalized form

### manual_roles.json
Array of per-match role annotations. Fields: `match_id`, `date_local`, `map`, `roles_raw` (semicolon-delimited role string), `opponent`, `wb_side`.

## Styling Conventions

- Dark theme using CSS custom properties (defined in `index.css`)
- Color palette: `--color-bg`, `--color-surface`, `--color-accent` (#FFD700), `--color-win` (green), `--color-loss` (red)
- Tailwind utility classes for layout; inline `style=` for theme colors that reference CSS vars
- Desktop-first, mobile-responsive

## Development Workflow

### Adding a new view
1. Create `src/views/NewView.jsx`
2. Accept `{ data }` prop (the full `processData()` output)
3. Add navigation/routing in `App.jsx`

### Updating player registry
Edit `public/data/player_registry.json`, push to GitHub. Site rebuilds automatically.

### Adding role notes
Edit `public/data/manual_roles.json`, push to GitHub.

### Input format
The upload expects a JSON array of match objects from qllr export (`ctf_matches_full.json`). Each match has `match_id`, `played_at`, `arena`, `duration`, `scores`, `players[]` with stats.

## Views Status

- **DataHealth** — implemented (sanity check dashboard)
- **FileUpload** — implemented (JSON upload widget)
- Overview, MapStrength, OpponentMatrix, Lineups, PlayerCards, MatchLog — not yet built
- FilterBar, StatTable, HeatmapCell — not yet built
