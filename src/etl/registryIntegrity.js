/**
 * Registry Integrity Check — detects alias collisions, steam_id duplicates,
 * and canonical/steam_id inconsistencies in match data.
 */

import { buildNickNormalizer } from './normalizeNick.js';

/**
 * Run all registry integrity checks.
 *
 * @param {Array} registry - player_registry.json entries
 * @param {Object} teamConfig - team_config.json (needs clan_tag_patterns)
 * @param {Array} playerRows - scoped playerRows (post-resolve, with canonical + steam_id)
 * @returns {Object} { aliasCollisions, steamIdCollisions, canonicalSteamIdMismatches }
 */
export function checkRegistryIntegrity(registry, teamConfig, playerRows) {
  const normalizeNick = buildNickNormalizer(teamConfig.clan_tag_patterns);

  const aliasCollisions = findAliasCollisions(registry, normalizeNick);
  const steamIdCollisions = findSteamIdCollisions(registry);
  const canonicalSteamIdMismatches = findCanonicalSteamIdMismatches(playerRows);

  return { aliasCollisions, steamIdCollisions, canonicalSteamIdMismatches };
}

/**
 * Check 1: Alias collisions.
 * Normalize every alias and canonical name. If two different canonical players
 * share the same normalized form, flag it.
 *
 * @returns {Array<{alias: string, normalized: string, players: string[]}>}
 */
function findAliasCollisions(registry, normalizeNick) {
  // Map: normalized lowercase string → Set of canonical player names that claim it
  const seen = new Map();

  for (const entry of registry) {
    const canonical = entry.canonical;

    // Add the canonical name itself (normalized + casefolded)
    const normCanonical = normalizeNick(canonical).toLowerCase();
    if (normCanonical) {
      if (!seen.has(normCanonical)) seen.set(normCanonical, new Map());
      seen.get(normCanonical).set(canonical, canonical);
    }

    // Add the raw casefolded canonical (if different from normalized)
    const rawCanonical = canonical.toLowerCase();
    if (rawCanonical !== normCanonical) {
      if (!seen.has(rawCanonical)) seen.set(rawCanonical, new Map());
      seen.get(rawCanonical).set(canonical, canonical);
    }

    // Add each alias (both raw casefolded and normalized casefolded)
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        const rawAlias = alias.toLowerCase();
        if (!seen.has(rawAlias)) seen.set(rawAlias, new Map());
        seen.get(rawAlias).set(canonical, alias);

        const normAlias = normalizeNick(alias).toLowerCase();
        if (normAlias && normAlias !== rawAlias) {
          if (!seen.has(normAlias)) seen.set(normAlias, new Map());
          seen.get(normAlias).set(canonical, alias);
        }
      }
    }
  }

  // Collect entries where more than one canonical player claims the same normalized form
  const collisions = [];
  for (const [normalized, claimants] of seen) {
    if (claimants.size > 1) {
      const players = [...claimants.entries()].map(
        ([canon, origAlias]) => `${canon} (via "${origAlias}")`
      );
      collisions.push({
        normalized,
        players,
      });
    }
  }

  return collisions;
}

/**
 * Check 2: Steam_id collisions.
 * Flag any two registry entries that share the same steam_id.
 *
 * @returns {Array<{steam_id: string, players: string[]}>}
 */
function findSteamIdCollisions(registry) {
  const byId = new Map();
  for (const entry of registry) {
    if (!entry.steam_id) continue;
    const id = String(entry.steam_id);
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(entry.canonical);
  }

  const collisions = [];
  for (const [steam_id, players] of byId) {
    if (players.length > 1) {
      collisions.push({ steam_id, players });
    }
  }
  return collisions;
}

/**
 * Check 3: Canonical ↔ steam_id consistency in match data.
 * For every resolved player across scoped matches, check if the same steam_id
 * ever maps to different canonical names.
 *
 * @returns {Array<{steam_id: string, canonicals: string[]}>}
 */
function findCanonicalSteamIdMismatches(playerRows) {
  const byId = new Map();
  for (const p of playerRows) {
    if (!p.resolved || !p.steam_id) continue;
    const id = String(p.steam_id);
    if (!byId.has(id)) byId.set(id, new Set());
    byId.get(id).add(p.canonical);
  }

  const mismatches = [];
  for (const [steam_id, canonicals] of byId) {
    if (canonicals.size > 1) {
      mismatches.push({ steam_id, canonicals: [...canonicals] });
    }
  }
  return mismatches;
}
