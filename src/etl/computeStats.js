/**
 * Step 5: Compute derived stats for playerRows, team match rows, pair stats, lineup stats.
 */

/**
 * Compute per-player derived stats. Mutates playerRows in place.
 */
function computePlayerStats(playerRows, matches) {
  const matchMap = new Map();
  for (const m of matches) matchMap.set(m.match_id, m);

  for (const row of playerRows) {
    const match = matchMap.get(row.match_id);
    const durMin = match ? match.duration_min : 1;

    row.dpm = durMin > 0 ? row.dmg_dealt / durMin : 0;
    row.net_damage = row.dmg_dealt - row.dmg_taken;
    row.kd_ratio = row.frags / Math.max(row.deaths, 1);
    row.frag_efficiency =
      row.frags + row.deaths > 0 ? row.frags / (row.frags + row.deaths) : 0;
    row.cap_contribution = row.caps + row.defends;

    const totalDmg = row.dmg_dealt || 1; // avoid div by 0
    row.rl_share = row.rl / totalDmg;
    row.rg_share = row.rg / totalDmg;
    row.sg_share = row.sg / totalDmg;
    row.lg_share = row.lg / totalDmg;
  }
}

/**
 * Build team match rows for each team appearance in each match.
 */
function buildTeamMatchRows(matches, playerRows) {
  const matchSideMap = new Map();
  for (const p of playerRows) {
    const key = `${p.match_id}::${p.side}`;
    if (!matchSideMap.has(key)) matchSideMap.set(key, []);
    matchSideMap.get(key).push(p);
  }

  const teamMatchRows = [];

  for (const match of matches) {
    const sides = [
      { side: 'red', team: match.team_red, opponentTeam: match.team_blue },
      { side: 'blue', team: match.team_blue, opponentTeam: match.team_red },
    ];

    for (const { side, team, opponentTeam } of sides) {
      if (!team || team === 'MIX') continue;

      const players = matchSideMap.get(`${match.match_id}::${side}`) || [];
      if (players.length === 0) continue;

      const scoreFor = side === 'red' ? match.score_red : match.score_blue;
      const scoreAgainst = side === 'red' ? match.score_blue : match.score_red;
      const result = scoreFor > scoreAgainst ? 'W' : scoreFor < scoreAgainst ? 'L' : 'D';

      const totalDamage = players.reduce((s, p) => s + p.dmg_dealt, 0);
      const totalFrags = players.reduce((s, p) => s + p.frags, 0);
      const totalDeaths = players.reduce((s, p) => s + p.deaths, 0);
      const totalCaps = players.reduce((s, p) => s + p.caps, 0);
      const totalDefends = players.reduce((s, p) => s + p.defends, 0);

      const avgDpm = players.reduce((s, p) => s + p.dpm, 0) / players.length;
      const avgNetDamage = players.reduce((s, p) => s + p.net_damage, 0) / players.length;
      const avgKd = players.reduce((s, p) => s + p.kd_ratio, 0) / players.length;

      // Damage HHI: sum of (player_dmg / team_dmg)^2
      const damageHhi =
        totalDamage > 0
          ? players.reduce((s, p) => s + Math.pow(p.dmg_dealt / totalDamage, 2), 0)
          : 0;

      const playerNames = players.map((p) => p.canonical).sort();
      const lineupKey = playerNames.join('+');

      teamMatchRows.push({
        match_id: match.match_id,
        team_name: team,
        side,
        map: match.map,
        date_local: match.date_local,
        opponent_team: opponentTeam,
        result,
        score_for: scoreFor,
        score_against: scoreAgainst,
        cap_diff: scoreFor - scoreAgainst,
        total_damage: totalDamage,
        total_frags: totalFrags,
        total_deaths: totalDeaths,
        total_caps: totalCaps,
        total_defends: totalDefends,
        avg_dpm: avgDpm,
        avg_net_damage: avgNetDamage,
        avg_kd: avgKd,
        damage_hhi: damageHhi,
        player_names: playerNames,
        lineup_key: lineupKey,
        duration_min: match.duration_min,
        qualifies_loose: match.qualifies_loose,
        qualifies_strict: match.qualifies_strict,
        qualifies_h2h: match.qualifies_h2h,
        qualifies_standings: match.qualifies_standings,
      });
    }
  }

  return teamMatchRows;
}

/**
 * Compute pair synergy stats for the focus team.
 * @param {Array} teamMatchRows
 * @param {string} focusTeam
 * @param {Array} playerRows - needed to look up per-player net_damage
 */
export function buildPairStats(teamMatchRows, focusTeam, playerRows) {
  const pairMap = new Map();

  // Build playerRow index: match_id::side → Map<canonical, playerRow>
  const playerIndex = new Map();
  for (const p of playerRows) {
    const key = `${p.match_id}::${p.side}`;
    if (!playerIndex.has(key)) playerIndex.set(key, new Map());
    playerIndex.get(key).set(p.canonical, p);
  }

  const focusRows = teamMatchRows.filter((r) => r.team_name === focusTeam);

  for (const row of focusRows) {
    const names = row.player_names;
    const sidePlayers = playerIndex.get(`${row.match_id}::${row.side}`);
    // Generate all 2-player combinations
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const pairKey = [names[i], names[j]].sort().join('+');
        if (!pairMap.has(pairKey)) {
          pairMap.set(pairKey, {
            pair_key: pairKey,
            players: [names[i], names[j]].sort(),
            games: 0,
            wins: 0,
            losses: 0,
            total_net_damage: 0,
            maps_played: new Set(),
          });
        }
        const pair = pairMap.get(pairKey);
        pair.games++;
        if (row.result === 'W') pair.wins++;
        if (row.result === 'L') pair.losses++;
        // Sum the two specific players' net_damage (not team average)
        const p1 = sidePlayers?.get(names[i]);
        const p2 = sidePlayers?.get(names[j]);
        pair.total_net_damage += (p1?.net_damage || 0) + (p2?.net_damage || 0);
        pair.maps_played.add(row.map);
      }
    }
  }

  // Finalize pair stats
  const pairStats = [];
  for (const pair of pairMap.values()) {
    pairStats.push({
      pair_key: pair.pair_key,
      players: pair.players,
      games: pair.games,
      wins: pair.wins,
      losses: pair.losses,
      win_pct: pair.games > 0 ? pair.wins / pair.games : 0,
      avg_net_damage: pair.games > 0 ? pair.total_net_damage / pair.games : 0,
      maps_played: [...pair.maps_played],
    });
  }

  return pairStats;
}

/**
 * Compute lineup stats for the focus team.
 */
export function buildLineupStats(teamMatchRows, focusTeam) {
  const lineupMap = new Map();

  const focusRows = teamMatchRows.filter((r) => r.team_name === focusTeam);

  for (const row of focusRows) {
    const key = row.lineup_key;
    if (!lineupMap.has(key)) {
      lineupMap.set(key, {
        lineup_key: key,
        player_names: row.player_names,
        games: 0,
        wins: 0,
        losses: 0,
        total_cap_diff: 0,
        total_net_damage: 0,
        total_hhi: 0,
        maps_played: new Map(), // map -> count
        strict_games: 0,
        strict_wins: 0,
        strict_losses: 0,
      });
    }
    const lineup = lineupMap.get(key);
    lineup.games++;
    if (row.result === 'W') lineup.wins++;
    if (row.result === 'L') lineup.losses++;
    lineup.total_cap_diff += row.cap_diff;
    lineup.total_net_damage += row.avg_net_damage;
    lineup.total_hhi += row.damage_hhi;
    lineup.maps_played.set(row.map, (lineup.maps_played.get(row.map) || 0) + 1);

    if (row.qualifies_strict) {
      lineup.strict_games++;
      if (row.result === 'W') lineup.strict_wins++;
      if (row.result === 'L') lineup.strict_losses++;
    }
  }

  const lineupStats = [];
  for (const lineup of lineupMap.values()) {
    const g = lineup.games;
    lineupStats.push({
      lineup_key: lineup.lineup_key,
      player_names: lineup.player_names,
      games: g,
      wins: lineup.wins,
      losses: lineup.losses,
      win_pct: g > 0 ? lineup.wins / g : 0,
      avg_cap_diff: g > 0 ? lineup.total_cap_diff / g : 0,
      avg_net_damage: g > 0 ? lineup.total_net_damage / g : 0,
      avg_damage_hhi: g > 0 ? lineup.total_hhi / g : 0,
      maps_played: Object.fromEntries(lineup.maps_played),
      strict_games: lineup.strict_games,
      strict_wins: lineup.strict_wins,
      strict_losses: lineup.strict_losses,
      strict_win_pct:
        lineup.strict_games > 0 ? lineup.strict_wins / lineup.strict_games : 0,
    });
  }

  return lineupStats;
}

/**
 * Main compute function.
 * Pair and lineup stats are computed separately after scope filtering (see index.js).
 * @param {Array} matches
 * @param {Array} playerRows
 * @returns {{ teamMatchRows }}
 */
export function computeStats(matches, playerRows) {
  // 1. Per-player derived stats
  computePlayerStats(playerRows, matches);

  // 2. Team match rows
  const teamMatchRows = buildTeamMatchRows(matches, playerRows);

  return { teamMatchRows };
}
