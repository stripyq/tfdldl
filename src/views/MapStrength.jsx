/**
 * MapStrength view — per-map performance table + bar chart.
 * Sortable, Loose/Strict toggle, color-coded win%, ExportButton.
 */

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import ExportButton from '../components/ExportButton.jsx';

const MIN_GAMES = 3;

export default function MapStrength({ data, onNavigateMatchLog }) {
  const { teamMatchRows } = data;
  const [mode, setMode] = useState('loose'); // 'loose' | 'strict'
  const [sortCol, setSortCol] = useState('games');
  const [sortAsc, setSortAsc] = useState(false);

  const predicate = mode === 'strict' ? 'qualifies_strict' : 'qualifies_loose';

  const mapStats = useMemo(() => {
    const focusRows = teamMatchRows.filter(
      (r) => r.team_name === 'wAnnaBees' && r[predicate]
    );

    const mapMap = {};
    for (const r of focusRows) {
      if (!mapMap[r.map]) {
        mapMap[r.map] = {
          map: r.map,
          games: 0,
          wins: 0,
          losses: 0,
          totalCapDiff: 0,
          totalNetDmg: 0,
          totalDpm: 0,
          totalHhi: 0,
        };
      }
      const m = mapMap[r.map];
      m.games++;
      if (r.result === 'W') m.wins++;
      if (r.result === 'L') m.losses++;
      m.totalCapDiff += r.cap_diff;
      m.totalNetDmg += r.avg_net_damage;
      m.totalDpm += r.avg_dpm;
      m.totalHhi += r.damage_hhi;
    }

    return Object.values(mapMap)
      .filter((m) => m.games >= MIN_GAMES)
      .map((m) => ({
        map: m.map,
        games: m.games,
        wins: m.wins,
        losses: m.losses,
        winPct: m.games > 0 ? (m.wins / m.games) * 100 : 0,
        avgCapDiff: m.games > 0 ? m.totalCapDiff / m.games : 0,
        avgNetDmg: m.games > 0 ? m.totalNetDmg / m.games : 0,
        avgDpm: m.games > 0 ? m.totalDpm / m.games : 0,
        avgHhi: m.games > 0 ? m.totalHhi / m.games : 0,
      }));
  }, [teamMatchRows, predicate]);

  const sorted = useMemo(() => {
    const colKey = {
      map: 'map',
      games: 'games',
      wins: 'wins',
      losses: 'losses',
      winPct: 'winPct',
      avgCapDiff: 'avgCapDiff',
      avgNetDmg: 'avgNetDmg',
      avgDpm: 'avgDpm',
      avgHhi: 'avgHhi',
    }[sortCol] || 'games';

    return [...mapStats].sort((a, b) => {
      const va = a[colKey];
      const vb = b[colKey];
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });
  }, [mapStats, sortCol, sortAsc]);

  // Chart data sorted by win%
  const chartData = useMemo(
    () => [...mapStats].sort((a, b) => b.winPct - a.winPct),
    [mapStats]
  );

  // Export-ready flat data
  const exportData = sorted.map((m) => ({
    map: m.map,
    games: m.games,
    wins: m.wins,
    losses: m.losses,
    win_pct: m.winPct.toFixed(1),
    avg_cap_diff: m.avgCapDiff.toFixed(2),
    avg_net_dmg: m.avgNetDmg.toFixed(0),
    avg_dpm: m.avgDpm.toFixed(0),
    avg_hhi: m.avgHhi.toFixed(3),
  }));

  function handleSort(col) {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  }

  const columns = [
    { key: 'map', label: 'Map' },
    { key: 'games', label: 'G' },
    { key: 'wins', label: 'W' },
    { key: 'losses', label: 'L' },
    { key: 'winPct', label: 'Win%' },
    { key: 'avgCapDiff', label: 'Cap Diff' },
    { key: 'avgNetDmg', label: 'Net Dmg' },
    { key: 'avgDpm', label: 'DPM' },
    { key: 'avgHhi', label: 'HHI' },
  ];

  function fmtCell(col, row) {
    switch (col) {
      case 'winPct': return `${row.winPct.toFixed(0)}%`;
      case 'avgCapDiff': {
        const v = row.avgCapDiff;
        return v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1);
      }
      case 'avgNetDmg': return row.avgNetDmg.toFixed(0);
      case 'avgDpm': return row.avgDpm.toFixed(0);
      case 'avgHhi': return row.avgHhi.toFixed(3);
      default: return row[col];
    }
  }

  function cellColor(col, row) {
    if (col === 'winPct') {
      return row.winPct > 60 ? 'var(--color-win)' : row.winPct < 40 ? 'var(--color-loss)' : undefined;
    }
    if (col === 'avgCapDiff') {
      return row.avgCapDiff > 0 ? 'var(--color-win)' : row.avgCapDiff < 0 ? 'var(--color-loss)' : undefined;
    }
    return undefined;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--color-accent)' }}
        >
          Map Strength
        </h2>
        <div className="flex items-center gap-3">
          <div
            title={mode === 'loose'
              ? 'Loose: at least one side is a full team roster'
              : 'Strict: full team vs organized stack (3+ from same team)'}
          >
            <Toggle
              options={['loose', 'strict']}
              value={mode}
              onChange={setMode}
            />
          </div>
          <ExportButton data={exportData} filename={`wb_map_strength_${mode}.csv`} />
        </div>
      </div>

      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
        {mode === 'strict' ? 'Strict' : 'Loose'} dataset &middot; maps with {MIN_GAMES}+ games
      </p>

      {sorted.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>
          No maps with {MIN_GAMES}+ games in {mode} dataset.
        </p>
      ) : (
        <>
          {/* Table */}
          <div
            className="rounded-lg p-4 mb-6 overflow-x-auto"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => handleSort(c.key)}
                      className="text-left pb-2 border-b font-medium cursor-pointer select-none"
                      style={{
                        borderColor: 'var(--color-border)',
                        color: sortCol === c.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      }}
                    >
                      {c.label}
                      {sortCol === c.key && (sortAsc ? ' \u25B2' : ' \u25BC')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.map}>
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className="py-1.5 border-b"
                        style={{
                          borderColor: 'var(--color-border)',
                          color: cellColor(c.key, row),
                          fontWeight: c.key === 'winPct' ? 600 : undefined,
                        }}
                      >
                        {c.key === 'games' ? (
                          <span
                            className="stat-link"
                            onClick={() => onNavigateMatchLog?.({ map: row.map, dataset: mode })}
                          >
                            {row.games}
                          </span>
                        ) : c.key === 'wins' ? (
                          <span
                            className="stat-link"
                            style={{ color: 'var(--color-win)' }}
                            onClick={() => onNavigateMatchLog?.({ map: row.map, result: 'W', dataset: mode })}
                          >
                            {row.wins}
                          </span>
                        ) : c.key === 'losses' ? (
                          <span
                            className="stat-link"
                            style={{ color: 'var(--color-loss)' }}
                            onClick={() => onNavigateMatchLog?.({ map: row.map, result: 'L', dataset: mode })}
                          >
                            {row.losses}
                          </span>
                        ) : (
                          fmtCell(c.key, row)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bar chart */}
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <p
              className="text-xs uppercase tracking-wide mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Win% by Map
            </p>
            <ResponsiveContainer width="100%" height={Math.max(chartData.length * 40, 120)}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="map"
                  width={120}
                  tick={{ fill: 'var(--color-text)', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    color: 'var(--color-text)',
                  }}
                  formatter={(v) => [`${v.toFixed(1)}%`, 'Win%']}
                />
                <ReferenceLine x={50} stroke="var(--color-text-muted)" strokeDasharray="3 3" />
                <Bar dataKey="winPct" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.map}
                      fill={
                        entry.winPct > 60
                          ? 'var(--color-win)'
                          : entry.winPct < 40
                            ? 'var(--color-loss)'
                            : 'var(--color-accent)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

function Toggle({ options, value, onChange }) {
  return (
    <div
      className="flex rounded-md overflow-hidden text-xs"
      style={{ border: '1px solid var(--color-border)' }}
    >
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className="px-3 py-1.5 capitalize cursor-pointer"
          style={{
            backgroundColor: value === opt ? 'var(--color-accent)' : 'transparent',
            color: value === opt ? 'var(--color-bg)' : 'var(--color-text-muted)',
            fontWeight: value === opt ? 600 : 400,
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
