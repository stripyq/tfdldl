/**
 * DataHealth view — sanity check dashboard showing pipeline diagnostics.
 */

export default function DataHealth({ data }) {
  const {
    matches,
    playerRows,
    teamMatchRows,
    allMatches,
    // allPlayerRows available for future views
    unresolvedPlayers,
    unlinkedRoles,
    orphanedRoles,
    totalRoleEntries,
    rolesMerged,
    rolesLinkedByFallback,
    rolesStillUnlinked,
    pairStats,
    lineupStats,
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
        <StatCard label="In Scope" value={matches.length} />
        <StatCard label="Excluded (pre-scope)" value={allMatches.length - matches.length} />
        <StatCard label="Player Rows (scoped)" value={playerRows.length} />
      </div>

      {/* Format Breakdown */}
      <Section title="Format Breakdown">
        <Table
          rows={[
            ['All matches', allMatches.length],
            ['4v4', all4v4.length],
            ['Non-4v4', allNon4v4.length],
            ['Scoped 4v4', scoped4v4.length],
          ]}
          headers={['Category', 'Count']}
        />
      </Section>

      {/* Dataset Qualification */}
      <Section title="Dataset Qualification (scoped matches)">
        <Table
          rows={[
            ['Loose (1 FULL_TEAM)', qualLoose],
            ['Strict (FULL_TEAM vs STACK_3PLUS+)', qualStrict],
            ['H2H (both STACK_3PLUS+)', qualH2h],
            ['Standings (1 STACK_3PLUS+)', qualStandings],
          ]}
          headers={['Dataset', 'Qualifying Matches']}
        />
      </Section>

      {/* Side Classification Distribution */}
      <Section title="Side Classifications (scoped, both sides counted)">
        <Table
          rows={Object.entries(classCounts).sort((a, b) => b[1] - a[1])}
          headers={['Classification', 'Count']}
        />
      </Section>

      {/* Map Frequency */}
      <Section title="Maps Played (scoped)">
        <Table rows={mapEntries} headers={['Map', 'Games']} />
      </Section>

      {/* Unresolved Players */}
      <Section title="Unresolved Players (not in registry)">
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
      </Section>

      {/* Unaffiliated Players */}
      <Section title="Unaffiliated Players (in registry but no team)">
        {unaffiliated.length === 0 ? (
          <GoodMsg>All resolved players have team affiliations</GoodMsg>
        ) : (
          <List items={unaffiliated} color="var(--color-draw)" />
        )}
      </Section>

      {/* Steam ID Issues */}
      <Section title="Steam ID Discrepancies">
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
      </Section>

      {/* Role Annotations */}
      <Section title="Role Annotations">
        <Table
          rows={[
            ['Parsed role assignments', totalRoleEntries],
            ['Merged into player rows', rolesMerged],
            ['Linked by fallback (date/map/score)', rolesLinkedByFallback ?? 0],
            ['Orphaned (no match data)', orphanedRoles ? orphanedRoles.length : 0],
            ['Still unlinked (date exists, match failed)', unlinkedRoles.length],
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
      </Section>

      {/* Orphaned Role Entries */}
      {orphanedRoles && orphanedRoles.length > 0 && (
        <Section title="Role entries without match data (external server)">
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
        </Section>
      )}

      {/* Computed Data Summary */}
      <Section title="Computed Data Summary">
        <Table
          rows={[
            ['Team match rows (scoped)', teamMatchRows.length],
            ['Pair stats entries', pairStats.length],
            ['Lineup combinations', lineupStats.length],
            ['Date range', dateRange],
          ]}
          headers={['Metric', 'Value']}
        />
      </Section>
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

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <div
        className="rounded-lg p-4"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        {children}
      </div>
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
