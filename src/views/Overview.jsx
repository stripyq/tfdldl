/**
 * Overview view — team identity card for the focus team (wAnnaBees).
 * Shows overall record, avg DPM, avg cap diff, close game record,
 * damage concentration (HHI), most used lineup, date range.
 * Uses scopedLoose predicate by default.
 */

import ExportButton from '../components/ExportButton.jsx';

export default function Overview({ data }) {
  const { teamMatchRows } = data;

  // Focus team rows with loose qualification
  const focusRows = teamMatchRows.filter(
    (r) => r.team_name === 'wAnnaBees' && r.qualifies_loose
  );

  const wins = focusRows.filter((r) => r.result === 'W').length;
  const losses = focusRows.filter((r) => r.result === 'L').length;
  const draws = focusRows.filter((r) => r.result === 'D').length;
  const total = focusRows.length;
  const winPct = total > 0 ? (wins / total) * 100 : 0;

  const avgDpm = total > 0
    ? focusRows.reduce((s, r) => s + r.avg_dpm, 0) / total
    : 0;
  const avgCapDiff = total > 0
    ? focusRows.reduce((s, r) => s + r.cap_diff, 0) / total
    : 0;

  // Close games: decided by ±1 cap
  const closeGames = focusRows.filter((r) => Math.abs(r.cap_diff) <= 1 && r.result !== 'D');
  const closeWins = closeGames.filter((r) => r.result === 'W').length;
  const closeLosses = closeGames.filter((r) => r.result === 'L').length;

  // Avg HHI
  const avgHhi = total > 0
    ? focusRows.reduce((s, r) => s + r.damage_hhi, 0) / total
    : 0;

  // Most used lineup
  const lineupCounts = {};
  for (const r of focusRows) {
    lineupCounts[r.lineup_key] = (lineupCounts[r.lineup_key] || 0) + 1;
  }
  const topLineup = Object.entries(lineupCounts).sort((a, b) => b[1] - a[1])[0];

  // Date range
  const dates = focusRows.map((r) => r.date_local).filter(Boolean).sort();
  const dateRange = dates.length > 0
    ? `${dates[0]} to ${dates[dates.length - 1]}`
    : 'N/A';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--color-accent)' }}
        >
          wAnnaBees Overview
        </h2>
        <ExportButton data={focusRows} filename="wb_team_matches.csv" />
      </div>

      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Loose dataset ({total} games) &middot; {dateRange}
      </p>

      {/* Record hero card */}
      <div
        className="rounded-lg p-6 mb-6"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-4xl font-bold">
            {wins}W&ndash;{losses}L{draws > 0 ? `\u2013${draws}D` : ''}
          </span>
          <span
            className="text-2xl font-semibold"
            style={{ color: winPct >= 50 ? 'var(--color-win)' : 'var(--color-loss)' }}
          >
            {winPct.toFixed(1)}%
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Avg DPM" value={avgDpm.toFixed(0)} />
          <Metric
            label="Avg Cap Diff"
            value={avgCapDiff >= 0 ? `+${avgCapDiff.toFixed(1)}` : avgCapDiff.toFixed(1)}
            color={avgCapDiff >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}
          />
          <Metric
            label="Close Games (±1)"
            value={`${closeWins}W\u2013${closeLosses}L`}
            subtitle={`${closeGames.length} total`}
          />
          <Metric
            label="Dmg Concentration"
            value={avgHhi.toFixed(3)}
            subtitle="HHI (0.25 = equal)"
          />
        </div>
      </div>

      {/* Most used lineup */}
      {topLineup && (
        <div
          className="rounded-lg p-4 mb-6"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <p
            className="text-xs uppercase tracking-wide mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Most Used Lineup ({topLineup[1]} games)
          </p>
          <p className="text-lg font-semibold">
            {topLineup[0].split('+').join(' \u00B7 ')}
          </p>
        </div>
      )}

      {/* Quick opponent breakdown */}
      <OpponentBreakdown rows={focusRows} />
    </div>
  );
}

function Metric({ label, value, subtitle, color }) {
  return (
    <div>
      <p
        className="text-xs uppercase tracking-wide"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </p>
      <p className="text-xl font-bold mt-0.5" style={color ? { color } : undefined}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function OpponentBreakdown({ rows }) {
  const oppMap = {};
  for (const r of rows) {
    const opp = r.opponent_team || 'Unknown';
    if (!oppMap[opp]) oppMap[opp] = { games: 0, wins: 0, losses: 0 };
    oppMap[opp].games++;
    if (r.result === 'W') oppMap[opp].wins++;
    if (r.result === 'L') oppMap[opp].losses++;
  }

  const oppRows = Object.entries(oppMap)
    .map(([name, s]) => ({
      name,
      ...s,
      winPct: s.games > 0 ? (s.wins / s.games) * 100 : 0,
    }))
    .sort((a, b) => b.games - a.games);

  return (
    <div
      className="rounded-lg p-4"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <p
        className="text-xs uppercase tracking-wide mb-3"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Record by Opponent
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr>
            {['Opponent', 'G', 'W', 'L', 'Win%'].map((h) => (
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
          {oppRows.map((o) => (
            <tr key={o.name}>
              <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                {o.name}
              </td>
              <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                {o.games}
              </td>
              <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                {o.wins}
              </td>
              <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                {o.losses}
              </td>
              <td
                className="py-1.5 border-b font-medium"
                style={{
                  borderColor: 'var(--color-border)',
                  color: o.winPct > 60 ? 'var(--color-win)' : o.winPct < 40 ? 'var(--color-loss)' : 'var(--color-text)',
                }}
              >
                {o.winPct.toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
