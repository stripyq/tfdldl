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
 * @param {Array} playerRows
 * @param {Array} roles - output of parseRoles
 */
export function mergeRoles(playerRows, roles) {
  // Build lookup by match_id + canonical
  const roleMap = new Map();
  for (const r of roles) {
    const key = `${r.match_id}::${r.canonical.toLowerCase()}`;
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
