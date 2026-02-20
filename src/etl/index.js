/**
 * ETL Pipeline Orchestrator.
 * Runs the full processing pipeline: parse → resolve teams → classify sides →
 * dataset flags → compute stats → parse roles → scope filter.
 */

import { parseMatches } from './parseMatches.js';
import { resolveTeams } from './resolveTeams.js';
import { classifySides } from './classifySides.js';
import { datasetFlags } from './datasetFlags.js';
import { computeStats } from './computeStats.js';
import { linkUnlinkedRoles, parseRoles, mergeRoles } from './parseRoles.js';

/**
 * Process raw match data through the full ETL pipeline.
 *
 * @param {Array} rawJson - raw match array from qllr export
 * @param {Array} playerRegistry - player_registry.json
 * @param {Object} teamConfig - team_config.json
 * @param {Array} manualRoles - manual_roles.json
 * @returns {Object} Processed data containing all computed datasets
 */
export function processData(rawJson, playerRegistry, teamConfig, manualRoles) {
  // Step 1: Parse raw matches into normalized structures (needs teamConfig for clan_tag_patterns)
  const { matches, playerRows, unresolvedPlayers } = parseMatches(rawJson, playerRegistry, teamConfig);

  // Step 2: Resolve team membership per player per era
  resolveTeams(playerRows, matches, playerRegistry, teamConfig);

  // Step 3: Classify each side (FULL_TEAM / STACK_3PLUS / MIX)
  classifySides(matches, playerRows);

  // Step 4: Add dataset qualification flags
  datasetFlags(matches);

  // Step 5: Compute derived stats (player, team, pair, lineup)
  const { teamMatchRows, pairStats, lineupStats } = computeStats(
    matches,
    playerRows,
    teamConfig
  );

  // Step 6a: Link unlinked manual role entries by (date, map, score) fallback
  const {
    linkedCount: rolesLinkedByFallback,
    orphanedRoles,
    stillUnlinked: rolesStillUnlinked,
  } = linkUnlinkedRoles(manualRoles, matches);

  // Step 6b: Parse and merge role annotations (includes newly linked + orphaned)
  // Parse ALL manual roles (linked, orphaned, and still-unlinked) so role data is available
  const roles = parseRoles(manualRoles, teamConfig);
  mergeRoles(playerRows, roles);

  // Count entries still unlinked (no match_id) after fallback — excludes orphaned
  const matchIdSet = new Set(matches.map((m) => m.match_id));
  const unlinkedRoles = manualRoles.filter(
    (r) => !matchIdSet.has(r.match_id) && !orphanedRoles.includes(r)
  );

  // Scope filter: only matches after scope_date
  const scopedMatches = matches.filter((m) => m.date_local >= teamConfig.scope_date);
  const scopedMatchIds = new Set(scopedMatches.map((m) => m.match_id));
  const scopedPlayerRows = playerRows.filter((p) => scopedMatchIds.has(p.match_id));
  const scopedTeamMatchRows = teamMatchRows.filter((r) => scopedMatchIds.has(r.match_id));

  return {
    matches: scopedMatches,
    playerRows: scopedPlayerRows,
    teamMatchRows: scopedTeamMatchRows,
    pairStats,
    lineupStats,
    allMatches: matches,
    allPlayerRows: playerRows,
    allTeamMatchRows: teamMatchRows,
    // Diagnostics
    unresolvedPlayers: [...unresolvedPlayers],
    unlinkedRoles,
    orphanedRoles,
    totalRoleEntries: roles.length,
    rolesMerged: playerRows.filter((p) => p.role_parsed !== null).length,
    rolesLinkedByFallback,
    rolesStillUnlinked,
  };
}
