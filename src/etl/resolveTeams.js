/**
 * Step 2: Assign team membership to each playerRow based on era (scope_date).
 */

/**
 * Build a lookup from canonical name to registry entry.
 */
function buildCanonicalMap(registry) {
  const map = new Map();
  for (const entry of registry) {
    map.set(entry.canonical.toLowerCase(), entry);
  }
  return map;
}

/**
 * Mutates playerRows in place, adding team_membership to each row.
 * @param {Array} playerRows
 * @param {Array} matches - needed to look up date_local per match
 * @param {Array} playerRegistry
 * @param {Object} teamConfig
 */
export function resolveTeams(playerRows, matches, playerRegistry, teamConfig) {
  const canonicalMap = buildCanonicalMap(playerRegistry);
  const matchDateMap = new Map();
  for (const m of matches) {
    matchDateMap.set(m.match_id, m.date_local);
  }

  const scopeDate = teamConfig.scope_date;

  for (const row of playerRows) {
    const dateLocal = matchDateMap.get(row.match_id);
    const entry = canonicalMap.get(row.canonical.toLowerCase());

    if (!entry) {
      row.team_membership = 'UNAFFILIATED';
      continue;
    }

    // Null/invalid date guard — mark UNAFFILIATED to avoid inflating team counts
    if (!dateLocal) {
      row.team_membership = 'UNAFFILIATED';
      row.date_invalid = true;
      continue;
    }

    const useNew = dateLocal >= scopeDate;
    const team2024 = entry.team_2024 || null;
    const team2026 = entry.team_2026 || null;

    if (useNew) {
      if (team2026) {
        row.team_membership = team2026;
      } else if (team2024) {
        // Fall back to old era if no 2026 entry
        row.team_membership = team2024;
      } else {
        row.team_membership = 'UNAFFILIATED';
      }
    } else {
      if (team2024) {
        row.team_membership = team2024;
      } else if (team2026) {
        row.team_membership = team2026;
      } else {
        row.team_membership = 'UNAFFILIATED';
      }
    }
  }
}
