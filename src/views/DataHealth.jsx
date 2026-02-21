/**
 * DataHealth view — sanity check dashboard showing pipeline diagnostics.
 */

import InfoTip from '../components/InfoTip.jsx';
import Collapsible from '../components/Collapsible.jsx';

export default function DataHealth({ data }) {
  const {
    matches,
    playerRows,
    teamMatchRows,
    allMatches,
    // allPlayerRows available for future views
    unresolvedPlayers,
    unresolvedNickCounts,
    unlinkedRoles,
    orphanedRoles,
    totalRoleEntries,
    rolesMerged,
    rolesLinkedByFallback,
    rolesStillUnlinked,
    duplicateRoles,
    durationParseErrors,
    pairStats,
    lineupStats,
    scopeDate,
  } = data;

  // Format breakdown
  const all4v4 = allMatches.filter((m) => m.is_4v4);
  const allNon4v4 = allMatches.filter((m) => !m.is_4v4);
  const scoped4v4 = matches.filter((m) => m.is_4v4);

  // Dataset qualification counts (scoped 4v4 matches)
  const qualLoose = matches.filter((m) => m.qualifies_loose).length;
  const qualStrict = matches.filter((m) => m.qualifies_strict).length;
  const qualH2h = matches.filter((m) => m.qualifies_h2h).length;
  const qualStandings = matches.filter((m) => m.qualifies_standings).length;

  // Unresolved players in scoped data
  const scopedUnresolved = playerRows.filter((p) => !p.resolved);
  const uniqueUnresolved = [...new Set(scopedUnresolved.map((p) => p.raw_nick))];

  // Unaffiliated players in scoped data
  const unaffiliated = [
    ...new Set(
      playerRows
        .filter((p) => p.team_membership === 'UNAFFILIATED')
        .map((p) => p.canonical)
    ),
  ];

  // Map frequency
  const mapCounts = {};
  for (const m of matches) {
    mapCounts[m.map] = (mapCounts[m.map] || 0) + 1;
  }
  const mapEntries = Object.entries(mapCounts).sort((a, b) => b[1] - a[1]);

  // Side classification distribution (scoped)
  const classCounts = { FULL_TEAM: 0, STACK_3PLUS: 0, MIX: 0 };
  for (const m of matches) {
    if (m.class_red) classCounts[m.class_red] = (classCounts[m.class_red] || 0) + 1;
    if (m.class_blue) classCounts[m.class_blue] = (classCounts[m.class_blue] || 0) + 1;
  }

  // Date range
  const dates = matches.map((m) => m.date_local).filter(Boolean).sort();
  const dateRange = dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : 'N/A';

  // Steam ID issues: players resolved but missing steam_id
  const missingSteamId = [
    ...new Set(
      playerRows
        .filter((p) => p.resolved && !p.steam_id)
        .map((p) => p.canonical)
    ),
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2
        className="text-2xl font-bold mb-6"
        style={{ color: 'var(--color-accent)' }}
      >
        Data Health Check
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Matches" value={allMatches.length} />
        <StatCard label={<>In Scope <InfoTip text={`Matches from ${scopeDate} onward (current competitive season).`} /></>} value={matches.length} />
        <StatCard label="Excluded (pre-scope)" value={allMatches.length - matches.length} />
        <StatCard label="Player Rows (scoped)" value={playerRows.length} />
      </div>

      {/* Format Breakdown */}
      <Collapsible title="Format Breakdown">
        <Table
          rows={[
            ['All matches', allMatches.length],
            ['4v4', all4v4.length],
            ['Non-4v4', allNon4v4.length],
            ['Scoped 4v4', scoped4v4.length],
          ]}
          headers={['Category', 'Count']}
        />
      </Collapsible>

      {/* Dataset Qualification */}
      <Collapsible title="Dataset Qualification (scoped matches)">
        <Table
          rows={[
            [<>Loose <InfoTip text="One side is a full team (4/4 same team). Opponent can be anyone." /></>, qualLoose],
            [<>Strict <InfoTip text="One side is a full team AND the opponent has at least 3 players from the same team." /></>, qualStrict],
            [<>H2H <InfoTip text="Both sides have at least 3 players from the same team. True team vs team matches." /></>, qualH2h],
            ['Standings (1 STACK_3PLUS+)', qualStandings],
          ]}
          headers={['Dataset', 'Qualifying Matches']}
        />
      </Collapsible>

      {/* Side Classification Distribution */}
      <Collapsible title="Side Classifications (scoped, both sides counted)">
        <Table
          rows={[
            [<>FULL_TEAM <InfoTip text="All 4 players on one side belong to the same team." /></>, classCounts.FULL_TEAM || 0],
            [<>STACK_3PLUS <InfoTip text="3 of 4 players belong to the same team, 1 is a substitute or unaffiliated." /></>, classCounts.STACK_3PLUS || 0],
            [<>MIX <InfoTip text="Players from different teams mixed together, no dominant team." /></>, classCounts.MIX || 0],
          ]}
          headers={['Classification', 'Count']}
        />
      </Collapsible>

      {/* Map Frequency */}
      <Collapsible title="Maps Played (scoped)">
        <Table rows={mapEntries} headers={['Map', 'Games']} />
      </Collapsible>

      {/* Unresolved Players */}
      <Collapsible title="Unresolved Players (not in registry)">
        {unresolvedPlayers.length === 0 ? (
          <GoodMsg>All players resolved</GoodMsg>
        ) : (
          <List items={unresolvedPlayers} color="var(--color-loss)" />
        )}
        {uniqueUnresolved.length > 0 && uniqueUnresolved.length !== unresolvedPlayers.length && (
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {uniqueUnresolved.length} unique unresolved in scoped data
            (across {scopedUnresolved.length} player-rows)
          </p>
        )}
      </Collapsible>

      {/* Top Unregistered Nicknames */}
      {unresolvedNickCounts && Object.keys(unresolvedNickCounts).length > 0 && (
        <Collapsible title="Top Unregistered Nicknames">
          <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Most frequently appearing unresolved nicks — consider adding to player_registry.json.
          </p>
          <Table
            rows={Object.entries(unresolvedNickCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 20)
              .map(([nick, count]) => [nick, `${count} match${count !== 1 ? 'es' : ''}`])}
            headers={['Nickname', 'Appearances']}
          />
        </Collapsible>
      )}

      {/* Unaffiliated Players */}
      <Collapsible title="Unaffiliated Players (in registry but no team)">
        {unaffiliated.length === 0 ? (
          <GoodMsg>All resolved players have team affiliations</GoodMsg>
        ) : (
          <List items={unaffiliated} color="var(--color-draw)" />
        )}
      </Collapsible>

      {/* Steam ID Issues */}
      <Collapsible title="Steam ID Discrepancies">
        {missingSteamId.length === 0 ? (
          <GoodMsg>No steam ID issues</GoodMsg>
        ) : (
          <>
            <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Players resolved via alias but missing steam_id in registry:
            </p>
            <List items={missingSteamId} color="var(--color-draw)" />
          </>
        )}
      </Collapsible>

      {/* Role Annotations */}
      <Collapsible title="Role Annotations">
        <Table
          rows={[
            ['Parsed role assignments', totalRoleEntries],
            ['Merged into player rows', rolesMerged],
            ['Linked by fallback (date/map/score)', rolesLinkedByFallback ?? 0],
            ['Orphaned (no match data)', orphanedRoles ? orphanedRoles.length : 0],
            ['Still unlinked (date exists, match failed)', unlinkedRoles.length],
            ['Duplicate role entries (last wins)', duplicateRoles ?? 0],
          ]}
          headers={['Metric', 'Count']}
        />
        {rolesStillUnlinked && rolesStillUnlinked.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-draw)' }}>
              Unlinked role entries (check console for details):
            </p>
            <List
              items={rolesStillUnlinked.map((u) => {
                const e = u.entry;
                const reason = u.reason === 'no_match' ? 'no matching match'
                  : u.reason === 'ambiguous' ? 'multiple matches'
                  : u.reason;
                return `${e.date_local} ${e.map} (${e.score_wb}-${e.score_opp} vs ${e.opponent}) — ${reason}`;
              })}
              color="var(--color-draw)"
            />
          </div>
        )}
      </Collapsible>

      {/* Orphaned Role Entries */}
      {orphanedRoles && orphanedRoles.length > 0 && (
        <Collapsible title="Role entries without match data (external server)">
          <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
            These role annotations reference dates not present in the uploaded qllr data.
            They may be from external servers or matches not tracked by qllr.
            Role assignments are preserved for analysis.
          </p>
          <List
            items={orphanedRoles.map(
              (e) => `${e.date_local} ${e.map} (${e.score_wb}-${e.score_opp} vs ${e.opponent}) [${e.session || ''}]`
            )}
            color="var(--color-text-muted)"
          />
        </Collapsible>
      )}

      {/* Computed Data Summary */}
      <Collapsible title="Computed Data Summary">
        <Table
          rows={[
            ['Team match rows (scoped)', teamMatchRows.length],
            ['Pair stats entries', pairStats.length],
            ['Lineup combinations', lineupStats.length],
            ['Date range', dateRange],
            ['Duration parse errors', durationParseErrors ?? 0],
          ]}
          headers={['Metric', 'Value']}
        />
      </Collapsible>
    </div>
  );
}

// --- Helper components ---

function StatCard({ label, value }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Table({ headers, rows }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          {headers.map((h) => (
            <th
              key={h}
              className="text-left pb-2 border-b font-medium"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td
                key={j}
                className="py-1.5 border-b"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GoodMsg({ children }) {
  return (
    <p className="text-sm" style={{ color: 'var(--color-win)' }}>
      {children}
    </p>
  );
}

function List({ items, color }) {
  return (
    <ul className="text-sm space-y-0.5">
      {items.map((item, i) => (
        <li key={i} style={{ color }}>
          {item}
        </li>
      ))}
    </ul>
  );
}
