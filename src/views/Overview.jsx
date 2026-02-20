/**
 * Overview view — team identity card for the focus team (wAnnaBees).
 * Shows overall record, avg DPM, avg cap diff, close game record,
 * damage concentration (HHI), tempo identity, date range.
 * Uses scopedLoose predicate by default.
 */

import ExportButton from '../components/ExportButton.jsx';

export default function Overview({ data, onNavigateMatchLog }) {
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

  // Date range
  const dates = focusRows.map((r) => r.date_local).filter(Boolean).sort();
  const dateRange = dates.length > 0
    ? `${dates[0]} to ${dates[dates.length - 1]}`
    : 'N/A';

  // Tempo identity stats
  const avgDuration = total > 0
    ? focusRows.reduce((s, r) => s + r.duration_min, 0) / total
    : 0;
  const blowoutWins = focusRows.filter((r) => r.result === 'W' && r.cap_diff >= 3).length;
  const blowoutLosses = focusRows.filter((r) => r.result === 'L' && r.cap_diff <= -3).length;

  // Close games per map (±1 cap, non-draw)
  const closeByMap = {};
  for (const r of closeGames) {
    if (!closeByMap[r.map]) closeByMap[r.map] = { wins: 0, losses: 0 };
    if (r.result === 'W') closeByMap[r.map].wins++;
    if (r.result === 'L') closeByMap[r.map].losses++;
  }
  const closeMapRows = Object.entries(closeByMap)
    .map(([map, s]) => ({ map, ...s, total: s.wins + s.losses }))
    .sort((a, b) => b.total - a.total);

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

      {/* Tempo Identity */}
      <TempoIdentity
        avgDuration={avgDuration}
        blowoutWins={blowoutWins}
        blowoutLosses={blowoutLosses}
        closeMapRows={closeMapRows}
      />

      {/* Quick opponent breakdown */}
      <OpponentBreakdown rows={focusRows} onNavigateMatchLog={onNavigateMatchLog} />
    </div>
  );
}

function TempoIdentity({ avgDuration, blowoutWins, blowoutLosses, closeMapRows }) {
  return (
    <div
      className="rounded-lg p-4 mb-6"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <p
        className="text-xs uppercase tracking-wide mb-3"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Tempo Identity
      </p>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Avg Duration</p>
          <p className="text-lg font-bold">{avgDuration.toFixed(1)} min</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Blowout Wins (3+)</p>
          <p className="text-lg font-bold" style={{ color: 'var(--color-win)' }}>{blowoutWins}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Blowout Losses (3+)</p>
          <p className="text-lg font-bold" style={{ color: 'var(--color-loss)' }}>{blowoutLosses}</p>
        </div>
      </div>

      {closeMapRows.length > 0 && (
        <>
          <p
            className="text-xs uppercase tracking-wide mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Close Games by Map (±1 cap)
          </p>
          <div className="flex flex-wrap gap-3">
            {closeMapRows.map((m) => (
              <span
                key={m.map}
                className="text-sm px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <span style={{ color: 'var(--color-text-muted)' }}>{m.map}</span>
                {' '}
                <span style={{ color: 'var(--color-win)' }}>{m.wins}W</span>
                {'\u2013'}
                <span style={{ color: 'var(--color-loss)' }}>{m.losses}L</span>
              </span>
            ))}
          </div>
        </>
      )}
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

function OpponentBreakdown({ rows, onNavigateMatchLog }) {
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
                <span
                  className="stat-link"
                  onClick={() => onNavigateMatchLog?.({ opponent: o.name })}
                >
                  {o.games}
                </span>
              </td>
              <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <span
                  className="stat-link"
                  style={{ color: 'var(--color-win)' }}
                  onClick={() => onNavigateMatchLog?.({ opponent: o.name, result: 'W' })}
                >
                  {o.wins}
                </span>
              </td>
              <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <span
                  className="stat-link"
                  style={{ color: 'var(--color-loss)' }}
                  onClick={() => onNavigateMatchLog?.({ opponent: o.name, result: 'L' })}
                >
                  {o.losses}
                </span>
              </td>
              <td
                className="py-1.5 border-b font-medium"
                style={{
                  borderColor: 'var(--color-border)',
                  color: o.winPct > 60 ? 'var(--color-win)' : o.winPct < 40 ? 'var(--color-loss)' : 'var(--color-text)',
                }}
              >
                {o.winPct.toFixed(0)}%
                {o.games < 3 && <span className="sample-warn" title="Small sample size">{'\u26A0'}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
