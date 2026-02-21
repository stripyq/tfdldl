/**
 * Step 1: Parse raw match JSON into normalized matches[] and playerRows[].
 */

import { buildNickNormalizer } from './normalizeNick.js';

/**
 * Parse "MM:SS" or "H:MM:SS" duration string to seconds.
 * Returns null for missing/unparseable formats so callers can exclude
 * these matches from rate-based metrics (DPM, caps/min).
 */
function parseDuration(dur) {
  if (!dur) return null;
  const parts = dur.split(':');
  if (parts.length === 2) {
    const val = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    return isNaN(val) ? null : val;
  }
  if (parts.length === 3) {
    const val = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
    return isNaN(val) ? null : val;
  }
  return null;
}

/**
 * Parse "3 : 4" score string into [red, blue].
 */
function parseScores(scoreStr) {
  if (!scoreStr) return [0, 0];
  const parts = scoreStr.split(':').map((s) => parseInt(s.trim(), 10));
  return [parts[0] || 0, parts[1] || 0];
}

/**
 * Parse accuracy string like "21%" to 0.21.
 */
function parseAccuracy(acc) {
  if (!acc || !acc.SA) return null;
  const str = String(acc.SA).replace('%', '');
  const val = parseFloat(str);
  return isNaN(val) ? null : val / 100;
}

/**
 * Convert UTC datetime string to Europe/Zagreb local datetime and date-only string.
 * Uses Intl.DateTimeFormat for proper DST handling (CET/CEST).
 * Input format: "2026-02-18 21:21 UTC"
 */
const dtfDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Zagreb',
  year: 'numeric', month: '2-digit', day: '2-digit',
});
const dtfTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Zagreb',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

function toLocal(utcStr) {
  if (!utcStr) return { datetime_local: null, date_local: null };
  const cleaned = utcStr.replace(' UTC', '');
  const date = new Date(cleaned + 'Z');
  if (isNaN(date.getTime())) return { datetime_local: null, date_local: null };

  const date_local = dtfDate.format(date); // "YYYY-MM-DD" (en-CA locale)
  const time_local = dtfTime.format(date); // "HH:MM"

  return {
    datetime_local: `${date_local} ${time_local}`,
    date_local,
  };
}

/**
 * Build alias lookup map from player registry.
 * Keys are casefolded AND normalized (clan-tag-stripped) forms of aliases and canonical names.
 * Returns Map<string, registryEntry>
 */
function buildAliasMap(registry, normalizeNick) {
  const map = new Map();
  let aliasCollisions = 0;
  for (const entry of registry) {
    const canonical = entry.canonical;

    // Index by casefolded canonical name (raw and normalized)
    map.set(canonical.toLowerCase(), entry);
    const normalizedCanonical = normalizeNick(canonical).toLowerCase();
    if (normalizedCanonical && !map.has(normalizedCanonical)) {
      map.set(normalizedCanonical, entry);
    } else if (normalizedCanonical && map.get(normalizedCanonical)?.canonical !== canonical) {
      aliasCollisions++;
    }

    // Index by each alias (raw casefolded and normalized casefolded)
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        if (map.has(alias.toLowerCase()) && map.get(alias.toLowerCase())?.canonical !== canonical) {
          aliasCollisions++;
        }
        map.set(alias.toLowerCase(), entry);
        const normalizedAlias = normalizeNick(alias).toLowerCase();
        if (normalizedAlias && !map.has(normalizedAlias)) {
          map.set(normalizedAlias, entry);
        } else if (normalizedAlias && map.get(normalizedAlias)?.canonical !== canonical) {
          aliasCollisions++;
        }
      }
    }

    // Index by steam_id
    if (entry.steam_id) {
      map.set(String(entry.steam_id), entry);
    }
  }
  return { map, aliasCollisions };
}

/**
 * Resolve a player nick to canonical name and steam_id using the registry.
 * Resolution order: normalize nick → casefold → look up in alias map.
 * Returns { canonical, steam_id, resolved }
 */
function resolvePlayer(nick, aliasMap, normalizeNick) {
  // 1. Try raw nick (casefolded) first — handles exact matches
  const rawKey = nick.toLowerCase();
  let entry = aliasMap.get(rawKey);
  if (entry) {
    return { canonical: entry.canonical, steam_id: entry.steam_id != null ? String(entry.steam_id) : null, resolved: true };
  }

  // 2. Normalize nick (strip clan tags) then casefold
  const normalized = normalizeNick(nick).toLowerCase();
  if (normalized && normalized !== rawKey) {
    entry = aliasMap.get(normalized);
    if (entry) {
      return { canonical: entry.canonical, steam_id: entry.steam_id != null ? String(entry.steam_id) : null, resolved: true };
    }
  }

  // 3. Not found — mark unresolved
  return { canonical: nick, steam_id: null, resolved: false };
}

/**
 * Main parse function.
 * @param {Array} rawMatches - raw JSON array from qllr export + optional manual matches
 * @param {Array} playerRegistry - player_registry.json contents
 * @param {Object} teamConfig - team_config.json (needs clan_tag_patterns)
 * @returns {{ matches: Array, playerRows: Array, unresolvedPlayers: Set }}
 */
export function parseMatches(rawMatches, playerRegistry, teamConfig) {
  const normalizeNick = buildNickNormalizer(teamConfig.clan_tag_patterns);
  const { map: aliasMap, aliasCollisions } = buildAliasMap(playerRegistry, normalizeNick);
  const matches = [];
  const playerRows = [];
  const unresolvedPlayers = new Set();
  let durationParseErrors = 0;

  for (const raw of rawMatches) {
    const isManual = !!raw.manual;
    const matchId = raw.match_id;

    const durationSec = parseDuration(raw.duration);
    if (durationSec === null) {
      durationParseErrors++;
    }
    const durationMin = durationSec !== null ? durationSec / 60 : null;

    // Manual matches have score_red/score_blue directly; qllr has "3 : 4" string
    let scoreRed, scoreBlue;
    if (isManual) {
      scoreRed = raw.score_red ?? 0;
      scoreBlue = raw.score_blue ?? 0;
    } else {
      [scoreRed, scoreBlue] = parseScores(raw.scores);
    }

    // Manual matches have ISO date_utc; qllr has "YYYY-MM-DD HH:MM UTC"
    let datetime_local, date_local;
    if (isManual && raw.date_utc) {
      const d = new Date(raw.date_utc);
      if (!isNaN(d.getTime())) {
        date_local = dtfDate.format(d);
        const time_local = dtfTime.format(d);
        datetime_local = `${date_local} ${time_local}`;
      } else {
        datetime_local = null;
        date_local = null;
      }
    } else {
      ({ datetime_local, date_local } = toLocal(raw.played_at));
    }

    let winnerSide = 'draw';
    if (scoreRed > scoreBlue) winnerSide = 'red';
    else if (scoreBlue > scoreRed) winnerSide = 'blue';

    const playersArr = raw.players || [];
    const redPlayers = playersArr.filter((p) => p.team === 'red');
    const bluePlayers = playersArr.filter((p) => p.team === 'blue');

    const match = {
      match_id: matchId,
      datetime_utc: isManual ? (raw.date_utc || null) : raw.played_at,
      datetime_local,
      date_local,
      map: isManual ? raw.map : raw.arena,
      duration_sec: durationSec,
      duration_min: durationMin,
      score_red: scoreRed,
      score_blue: scoreBlue,
      winner_side: winnerSide,
      player_count_red: redPlayers.length,
      player_count_blue: bluePlayers.length,
      is_4v4: redPlayers.length === 4 && bluePlayers.length === 4,
      manual: isManual,
      source: isManual ? (raw.source || 'manual') : 'qllr',
      url: isManual ? null : `https://qllr.xyz/scoreboard/${matchId}`,
      // These will be filled by classifySides
      team_red: null,
      team_blue: null,
      class_red: null,
      class_blue: null,
      // These will be filled by datasetFlags
      qualifies_loose: false,
      qualifies_strict: false,
      qualifies_h2h: false,
      qualifies_standings: false,
    };

    matches.push(match);

    // Process each player in the match
    for (const p of playersArr) {
      // Manual matches use lowercase field names; qllr uses PascalCase
      const nick = isManual ? p.nick : p.Nick;
      const { canonical, steam_id, resolved } = resolvePlayer(nick, aliasMap, normalizeNick);
      if (!resolved) {
        unresolvedPlayers.add(nick);
      }

      const dmg = (isManual ? null : p.Damage) || {};
      const dmgDealt = isManual ? (p.damage_dealt || 0) : (p.DamageDealt || 0);
      const dmgTaken = isManual ? (p.damage_taken || 0) : (p.DamageTaken || 0);

      playerRows.push({
        match_id: matchId,
        side: p.team,
        raw_nick: nick,
        canonical,
        steam_id,
        resolved,
        frags: p.frags || 0,
        deaths: p.deaths || 0,
        caps: (isManual ? p.captures : p.captures) || 0,
        assists: p.assists || 0,
        defends: p.defends || 0,
        dmg_dealt: dmgDealt,
        dmg_taken: dmgTaken,
        score: p.score || 0,
        mg: dmg.MG || 0,
        sg: dmg.SG || 0,
        gl: dmg.GL || 0,
        rl: dmg.RL || 0,
        rg: dmg.RG || 0,
        lg: dmg.LG || 0,
        pg: dmg.PG || 0,
        accuracy_sa: isManual ? null : parseAccuracy(p.Accuracy),
        old_rating: isManual ? null : (p.OldRating ?? null),
        new_rating: isManual ? null : (p.NewRating ?? null),
        rating_diff: isManual ? null : (p.Diff ?? null),
        // Will be filled by resolveTeams
        team_membership: null,
        // Will be filled by computeStats
        dpm: 0,
        net_damage: 0,
        kd_ratio: 0,
        frag_efficiency: 0,
        cap_contribution: 0,
        rl_share: 0,
        rg_share: 0,
        sg_share: 0,
        lg_share: 0,
        // Will be filled by parseRoles
        role_raw: null,
        role_parsed: null,
      });
    }
  }

  return { matches, playerRows, unresolvedPlayers, durationParseErrors, aliasCollisions };
}
