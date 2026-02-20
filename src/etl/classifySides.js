/**
 * Step 3: Classify each side of each match as FULL_TEAM / STACK_3PLUS / MIX.
 */

/**
 * Classify one side of a match.
 * @param {Array} sidePlayers - playerRows for this side
 * @returns {{ team: string, classification: string }}
 */
function classifySide(sidePlayers) {
  // Count team membership frequency (ignoring UNAFFILIATED and AMBIGUOUS_MEMBER)
  const teamCounts = new Map();
  for (const p of sidePlayers) {
    const tm = p.team_membership;
    if (!tm || tm === 'UNAFFILIATED' || tm === 'AMBIGUOUS_MEMBER') continue;
    teamCounts.set(tm, (teamCounts.get(tm) || 0) + 1);
  }

  if (teamCounts.size === 0) {
    return { team: 'MIX', classification: 'MIX' };
  }

  // Find the team with the most players
  let maxTeam = null;
  let maxCount = 0;
  for (const [team, count] of teamCounts) {
    if (count > maxCount) {
      maxCount = count;
      maxTeam = team;
    }
  }

  const sideSize = sidePlayers.length;

  if (maxCount === sideSize) {
    return { team: maxTeam, classification: 'FULL_TEAM' };
  }
  if (maxCount >= 3) {
    return { team: maxTeam, classification: 'STACK_3PLUS' };
  }
  return { team: 'MIX', classification: 'MIX' };
}

/**
 * Mutates matches in place, adding team_red, team_blue, class_red, class_blue.
 * @param {Array} matches
 * @param {Array} playerRows
 */
export function classifySides(matches, playerRows) {
  // Group playerRows by match_id and side for quick lookup
  const matchSideMap = new Map();
  for (const p of playerRows) {
    const key = `${p.match_id}::${p.side}`;
    if (!matchSideMap.has(key)) matchSideMap.set(key, []);
    matchSideMap.get(key).push(p);
  }

  for (const match of matches) {
    const redPlayers = matchSideMap.get(`${match.match_id}::red`) || [];
    const bluePlayers = matchSideMap.get(`${match.match_id}::blue`) || [];

    const red = classifySide(redPlayers);
    const blue = classifySide(bluePlayers);

    match.team_red = red.team;
    match.team_blue = blue.team;
    match.class_red = red.classification;
    match.class_blue = blue.classification;
  }
}
