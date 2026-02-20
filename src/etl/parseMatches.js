/**
 * Step 1: Parse raw match JSON into normalized matches[] and playerRows[].
 */

/**
 * Parse "MM:SS" duration string to seconds.
 */
function parseDuration(dur) {
  if (!dur) return 0;
  const parts = dur.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return 0;
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
 * Convert UTC datetime string to UTC+1 local datetime and date-only string.
 * Input format: "2026-02-18 21:21 UTC"
 */
function toLocal(utcStr) {
  if (!utcStr) return { datetime_local: null, date_local: null };
  // Parse the UTC string
  const cleaned = utcStr.replace(' UTC', '');
  const date = new Date(cleaned + 'Z');
  if (isNaN(date.getTime())) return { datetime_local: null, date_local: null };

  // Shift to UTC+1
  const localMs = date.getTime() + 60 * 60 * 1000;
  const local = new Date(localMs);

  const yyyy = local.getUTCFullYear();
  const mm = String(local.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(local.getUTCDate()).padStart(2, '0');
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mi = String(local.getUTCMinutes()).padStart(2, '0');

  return {
    datetime_local: `${yyyy}-${mm}-${dd} ${hh}:${mi}`,
    date_local: `${yyyy}-${mm}-${dd}`,
  };
}

/**
 * Build alias lookup map from player registry.
 * Returns { lowercaseAlias -> registryEntry }
 */
function buildAliasMap(registry) {
  const map = new Map();
  for (const entry of registry) {
    // Index by canonical name
    map.set(entry.canonical.toLowerCase(), entry);
    // Index by each alias
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        map.set(alias.toLowerCase(), entry);
      }
    }
    // Index by steam_id
    if (entry.steam_id) {
      map.set(String(entry.steam_id), entry);
    }
  }
  return map;
}

/**
 * Resolve a player nick to canonical name and steam_id using the registry.
 * Returns { canonical, steam_id, resolved }
 */
function resolvePlayer(nick, aliasMap) {
  const key = nick.toLowerCase();

  // 1. Look up by alias
  let entry = aliasMap.get(key);
  if (entry) {
    return { canonical: entry.canonical, steam_id: String(entry.steam_id), resolved: true };
  }

  // 2. Not found — mark unresolved
  return { canonical: nick, steam_id: null, resolved: false };
}

/**
 * Main parse function.
 * @param {Array} rawMatches - raw JSON array from qllr export
 * @param {Array} playerRegistry - player_registry.json contents
 * @returns {{ matches: Array, playerRows: Array, unresolvedPlayers: Set }}
 */
export function parseMatches(rawMatches, playerRegistry) {
  const aliasMap = buildAliasMap(playerRegistry);
  const matches = [];
  const playerRows = [];
  const unresolvedPlayers = new Set();

  for (const raw of rawMatches) {
    const matchId = raw.match_id;
    const durationSec = parseDuration(raw.duration);
    const durationMin = durationSec / 60;
    const [scoreRed, scoreBlue] = parseScores(raw.scores);
    const { datetime_local, date_local } = toLocal(raw.played_at);

    let winnerSide = 'draw';
    if (scoreRed > scoreBlue) winnerSide = 'red';
    else if (scoreBlue > scoreRed) winnerSide = 'blue';

    const playersArr = raw.players || [];
    const redPlayers = playersArr.filter((p) => p.team === 'red');
    const bluePlayers = playersArr.filter((p) => p.team === 'blue');

    const match = {
      match_id: matchId,
      datetime_utc: raw.played_at,
      datetime_local,
      date_local,
      map: raw.arena,
      duration_sec: durationSec,
      duration_min: durationMin,
      score_red: scoreRed,
      score_blue: scoreBlue,
      winner_side: winnerSide,
      player_count_red: redPlayers.length,
      player_count_blue: bluePlayers.length,
      is_4v4: redPlayers.length === 4 && bluePlayers.length === 4,
      url: `https://qllr.xyz/scoreboard/${matchId}`,
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
      const { canonical, steam_id, resolved } = resolvePlayer(p.Nick, aliasMap);
      if (!resolved) {
        unresolvedPlayers.add(p.Nick);
      }

      const dmg = p.Damage || {};
      const dmgDealt = p.DamageDealt || 0;

      playerRows.push({
        match_id: matchId,
        side: p.team,
        raw_nick: p.Nick,
        canonical,
        steam_id,
        resolved,
        frags: p.frags || 0,
        deaths: p.deaths || 0,
        caps: p.captures || 0,
        assists: p.assists || 0,
        defends: p.defends || 0,
        dmg_dealt: dmgDealt,
        dmg_taken: p.DamageTaken || 0,
        score: p.score || 0,
        mg: dmg.MG || 0,
        sg: dmg.SG || 0,
        gl: dmg.GL || 0,
        rl: dmg.RL || 0,
        rg: dmg.RG || 0,
        lg: dmg.LG || 0,
        pg: dmg.PG || 0,
        accuracy_sa: parseAccuracy(p.Accuracy),
        old_rating: p.OldRating ?? null,
        new_rating: p.NewRating ?? null,
        rating_diff: p.Diff ?? null,
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

  return { matches, playerRows, unresolvedPlayers };
}
