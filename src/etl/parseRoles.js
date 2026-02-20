/**
 * Step 6: Parse manual_roles.json role strings into structured role assignments.
 */

/**
 * Parse a single roles_raw string.
 * Format: "def: fo_tbh; off: zoza, fo_tbh, jcb (rotation on def)"
 *
 * @param {string} rolesRaw
 * @param {Object} roleNormalize - mapping of shorthand to normalized role names
 * @returns {Array<{ player: string, role_raw: string, role_parsed: string, notes: string|null }>}
 */
function parseRolesRaw(rolesRaw, roleNormalize) {
  if (!rolesRaw) return [];

  // Skip entries with "(no role notes)"
  if (rolesRaw.includes('(no role notes)')) return [];

  const segments = rolesRaw.split(';').map((s) => s.trim()).filter(Boolean);
  const playerRoles = new Map(); // canonical -> [{ role, notes }]

  for (const segment of segments) {
    const colonIdx = segment.indexOf(':');
    if (colonIdx === -1) continue;

    let roleToken = segment.slice(0, colonIdx).trim().toLowerCase();
    const playersStr = segment.slice(colonIdx + 1).trim();

    // Normalize the role token
    if (roleNormalize[roleToken]) {
      roleToken = roleNormalize[roleToken];
    }

    // Split players by comma
    const playerEntries = playersStr.split(',').map((s) => s.trim()).filter(Boolean);

    for (let entry of playerEntries) {
      // Extract parenthetical notes
      let notes = null;
      const parenMatch = entry.match(/\(([^)]+)\)/);
      if (parenMatch) {
        notes = parenMatch[1].trim();
        entry = entry.replace(/\([^)]+\)/, '').trim();
      }

      // Check for role prefix modifiers (e.g., "hRA jcb" → player=jcb, role=off+hRA)
      const parts = entry.split(/\s+/);
      let playerName;
      let modifier = null;

      if (parts.length >= 2) {
        // Check if first part is a known modifier
        const possibleModifier = parts[0].toLowerCase();
        const knownModifiers = ['hra', 'era', 'nmera', 'hmed', 'hm'];
        if (knownModifiers.includes(possibleModifier) || roleNormalize[possibleModifier]) {
          modifier = roleNormalize[possibleModifier] || possibleModifier;
          playerName = parts.slice(1).join(' ');
        } else {
          playerName = entry;
        }
      } else {
        playerName = entry;
      }

      if (!playerName) continue;

      const fullRole = modifier ? `${roleToken}+${modifier}` : roleToken;

      if (!playerRoles.has(playerName)) {
        playerRoles.set(playerName, []);
      }
      playerRoles.get(playerName).push({ role: fullRole, notes });
    }
  }

  // Build output, checking for ROTATION (multiple distinct base roles)
  const results = [];
  for (const [player, roles] of playerRoles) {
    const baseRoles = new Set(roles.map((r) => r.role.split('+')[0]));
    const allNotes = roles
      .map((r) => r.notes)
      .filter(Boolean)
      .join('; ');

    let roleParsed;
    if (baseRoles.size > 1) {
      roleParsed = 'ROTATION';
    } else {
      // Use the most specific role (with modifier if present)
      const withModifier = roles.find((r) => r.role.includes('+'));
      roleParsed = withModifier ? withModifier.role : roles[0].role;
    }

    results.push({
      player,
      role_raw: roles.map((r) => r.role).join(', '),
      role_parsed: roleParsed,
      notes: allNotes || null,
    });
  }

  return results;
}

/**
 * Normalize map name for fuzzy matching: lowercase, strip underscores/spaces.
 * e.g. "troubled_waters" → "troubledwaters", "Troubled Waters" → "troubledwaters"
 */
function normalizeMapName(name) {
  return (name || '').toLowerCase().replace(/[_\s]/g, '');
}

/**
 * Link unlinked manual role entries (no match_id) to processed matches
 * using a composite key: (date_local, normalized_map, score).
 *
 * Mutates manualRoles entries in place (sets match_id when exactly 1 match found).
 *
 * @param {Array} manualRoles - manual_roles.json contents
 * @param {Array} matches - processed matches from parseMatches
 * @returns {{ linkedCount: number, orphanedRoles: Array, stillUnlinked: Array<{ entry: Object, reason: string }> }}
 */
export function linkUnlinkedRoles(manualRoles, matches) {
  // Build indexes:
  //   dateIndex: date_local → [match, ...] (to detect orphans)
  //   dateMapIndex: "date_local::normalizedMap" → [match, ...]
  const dateIndex = new Map();
  const dateMapIndex = new Map();
  for (const m of matches) {
    if (!m.date_local) continue;
    if (!dateIndex.has(m.date_local)) dateIndex.set(m.date_local, []);
    dateIndex.get(m.date_local).push(m);

    const key = `${m.date_local}::${normalizeMapName(m.map)}`;
    if (!dateMapIndex.has(key)) dateMapIndex.set(key, []);
    dateMapIndex.get(key).push(m);
  }

  let linkedCount = 0;
  const orphanedRoles = [];
  const stillUnlinked = [];

  const unlinkedEntries = manualRoles.filter((e) => !e.match_id);

  for (const entry of unlinkedEntries) {
    const scoreWb = parseInt(entry.score_wb, 10);
    const scoreOpp = parseInt(entry.score_opp, 10);

    if (isNaN(scoreWb) || isNaN(scoreOpp)) {
      stillUnlinked.push({ entry, reason: 'invalid_score' });
      continue;
    }

    // Check if ANY matches exist on this date
    const matchesOnDate = dateIndex.get(entry.date_local);
    if (!matchesOnDate) {
      // Date not in match data at all → orphaned (external server / not in qllr)
      orphanedRoles.push(entry);
      continue;
    }

    // Look up by normalized map name
    const normMap = normalizeMapName(entry.map);
    const key = `${entry.date_local}::${normMap}`;
    const candidates = dateMapIndex.get(key) || [];

    if (candidates.length === 0) {
      // Date exists but map doesn't match — different session on same date → orphan
      orphanedRoles.push(entry);
      continue;
    }

    // Filter by score match (wB could be on either side)
    const scoreMatches = candidates.filter(
      (m) =>
        (m.score_red === scoreWb && m.score_blue === scoreOpp) ||
        (m.score_blue === scoreWb && m.score_red === scoreOpp)
    );

    if (scoreMatches.length === 1) {
      entry.match_id = scoreMatches[0].match_id;
      if (!entry.wb_side) {
        const m = scoreMatches[0];
        entry.wb_side =
          m.score_red === scoreWb && m.score_blue === scoreOpp ? 'red' : 'blue';
      }
      linkedCount++;
    } else if (scoreMatches.length === 0) {
      // Map exists on date but scores don't match — different session → orphan
      orphanedRoles.push(entry);
    } else {
      console.log(
        `[linkUnlinkedRoles] AMBIGUOUS: ${entry.date_local} ${entry.map} ${scoreWb}-${scoreOpp} — ${scoreMatches.length} matches`
      );
      stillUnlinked.push({ entry, reason: 'ambiguous' });
    }
  }

  console.log(
    `[linkUnlinkedRoles] Result: ${linkedCount} linked, ${orphanedRoles.length} orphaned, ${stillUnlinked.length} unlinked`
  );

  return { linkedCount, orphanedRoles, stillUnlinked };
}

/**
 * Parse all manual roles entries.
 * @param {Array} manualRoles - manual_roles.json contents
 * @param {Object} teamConfig
 * @returns {Array<{ match_id, canonical, role_raw, role_parsed }>}
 */
export function parseRoles(manualRoles, teamConfig) {
  const roleNormalize = teamConfig.role_normalize || {};
  const allRoles = [];

  for (const entry of manualRoles) {
    const parsed = parseRolesRaw(entry.roles_raw, roleNormalize);
    for (const p of parsed) {
      allRoles.push({
        match_id: entry.match_id,
        canonical: p.player,
        role_raw: p.role_raw,
        role_parsed: p.role_parsed,
        notes: p.notes,
      });
    }
  }

  return allRoles;
}

/**
 * Merge parsed roles into playerRows where match_id + canonical match.
 * Role entries may use raw nicks (e.g. "Fo_Tbh", "wB fo_tbh") so we also
 * try normalizing through clan-tag stripping + alias lookup.
 * @param {Array} playerRows
 * @param {Array} roles - output of parseRoles
 * @param {function} [normalizeNick] - clan-tag stripping function
 * @param {Array} [playerRegistry] - for alias resolution fallback
 */
export function mergeRoles(playerRows, roles, normalizeNick, playerRegistry) {
  // Build alias map for resolving role player names → canonical
  let aliasMap = null;
  if (normalizeNick && playerRegistry) {
    aliasMap = new Map();
    for (const entry of playerRegistry) {
      const canon = entry.canonical.toLowerCase();
      aliasMap.set(canon, entry.canonical);
      const normCanon = normalizeNick(entry.canonical).toLowerCase();
      if (normCanon) aliasMap.set(normCanon, entry.canonical);
      if (entry.aliases) {
        for (const alias of entry.aliases) {
          aliasMap.set(alias.toLowerCase(), entry.canonical);
          const normAlias = normalizeNick(alias).toLowerCase();
          if (normAlias) aliasMap.set(normAlias, entry.canonical);
        }
      }
    }
  }

  function resolveRoleName(name) {
    if (!aliasMap) return name.toLowerCase();
    // Try exact casefolded
    const lower = name.toLowerCase();
    const exact = aliasMap.get(lower);
    if (exact) return exact.toLowerCase();
    // Try normalized (clan-tag stripped)
    if (normalizeNick) {
      const norm = normalizeNick(name).toLowerCase();
      const resolved = aliasMap.get(norm);
      if (resolved) return resolved.toLowerCase();
    }
    return lower;
  }

  // Build lookup by match_id + resolved canonical
  const roleMap = new Map();
  for (const r of roles) {
    const resolvedName = resolveRoleName(r.canonical);
    const key = `${r.match_id}::${resolvedName}`;
    roleMap.set(key, r);
  }

  for (const row of playerRows) {
    const key = `${row.match_id}::${row.canonical.toLowerCase()}`;
    const role = roleMap.get(key);
    if (role) {
      row.role_raw = role.role_raw;
      row.role_parsed = role.role_parsed;
    }
  }
}
