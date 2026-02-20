/**
 * Step 4: Add dataset qualification flags to each match (4v4 only).
 *
 * Classification hierarchy: FULL_TEAM > STACK_3PLUS > MIX
 */

const CLASS_RANK = {
  FULL_TEAM: 3,
  STACK_3PLUS: 2,
  MIX: 1,
};

function rank(classification) {
  return CLASS_RANK[classification] || 0;
}

/**
 * Mutates matches in place, adding qualification flags.
 * @param {Array} matches
 */
export function datasetFlags(matches) {
  for (const match of matches) {
    if (!match.is_4v4) {
      match.qualifies_loose = false;
      match.qualifies_strict = false;
      match.qualifies_h2h = false;
      match.qualifies_standings = false;
      continue;
    }

    const rr = rank(match.class_red);
    const br = rank(match.class_blue);

    // loose: at least one side is FULL_TEAM
    match.qualifies_loose = rr >= 3 || br >= 3;

    // strict: one side FULL_TEAM and other at least STACK_3PLUS
    match.qualifies_strict =
      (rr >= 3 && br >= 2) || (br >= 3 && rr >= 2);

    // h2h: both sides at least STACK_3PLUS
    match.qualifies_h2h = rr >= 2 && br >= 2;

    // standings: at least one side is STACK_3PLUS or better
    match.qualifies_standings = rr >= 2 || br >= 2;
  }
}
