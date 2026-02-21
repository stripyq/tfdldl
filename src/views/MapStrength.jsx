/**
 * MapStrength view — per-map performance table + bar chart.
 * Sortable, Loose/Strict toggle, color-coded win%, ExportButton.
 */

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import ExportButton from '../components/ExportButton.jsx';
import InfoTip from '../components/InfoTip.jsx';
import { getStatColor } from '../utils/getStatColor.js';

const MIN_GAMES = 3;

export default function MapStrength({ data, officialOnly, onNavigateMatchLog, matchNotes }) {
  const { teamMatchRows } = data;
  const [mode, setMode] = useState('loose'); // 'loose' | 'strict'
  const [sortCol, setSortCol] = useState('games');
  const [sortAsc, setSortAsc] = useState(false);

  const predicate = mode === 'strict' ? 'qualifies_strict' : 'qualifies_loose';

  const focusRows = useMemo(() => {
    return teamMatchRows.filter(
      (r) => r.team_name === 'wAnnaBees' && r[predicate] && (!officialOnly || r.match_type === 'official')
    );
  }, [teamMatchRows, predicate, officialOnly]);

  const mapStats = useMemo(() => {
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
          totalDuration: 0,
          totalCaps: 0,
          blowouts: 0,
          closeGames: 0,
          durations: [],
          flagsFor: 0,
          flagsAgainst: 0,
          dpmCount: 0,
          durCount: 0,
        };
      }
      const m = mapMap[r.map];
      m.games++;
      if (r.result === 'W') m.wins++;
      if (r.result === 'L') m.losses++;
      m.totalCapDiff += r.cap_diff;
      m.totalNetDmg += r.avg_net_damage;
      if (r.avg_dpm != null) { m.totalDpm += r.avg_dpm; m.dpmCount++; }
      m.totalHhi += r.damage_hhi;
      if (r.duration_min != null) { m.totalDuration += r.duration_min; m.durCount++; }
      m.totalCaps += r.score_for + r.score_against;
      m.flagsFor += r.score_for;
      m.flagsAgainst += r.score_against;
      if (Math.abs(r.cap_diff) >= 3) m.blowouts++;
      if (Math.abs(r.cap_diff) <= 1 && r.result !== 'D') m.closeGames++;
      if (r.duration_min != null) m.durations.push({ dur: r.duration_min, result: r.result });
    }

    return Object.values(mapMap)
      .filter((m) => m.games >= MIN_GAMES)
      .map((m) => {
        const avgDuration = m.durCount > 0 ? m.totalDuration / m.durCount : 0;
        // Split at map's median duration for fast/slow comparison
        const sortedDur = [...m.durations].sort((a, b) => a.dur - b.dur);
        const medianDur = sortedDur.length > 0 ? sortedDur[Math.floor(sortedDur.length / 2)].dur : 0;
        const fastGames = m.durations.filter((d) => d.dur < medianDur);
        const slowGames = m.durations.filter((d) => d.dur >= medianDur);
        const fastWinPct = fastGames.length > 0
          ? (fastGames.filter((d) => d.result === 'W').length / fastGames.length) * 100 : null;
        const slowWinPct = slowGames.length > 0
          ? (slowGames.filter((d) => d.result === 'W').length / slowGames.length) * 100 : null;

        return {
          map: m.map,
          games: m.games,
          wins: m.wins,
          losses: m.losses,
          winPct: m.games > 0 ? (m.wins / m.games) * 100 : 0,
          avgCapDiff: m.games > 0 ? m.totalCapDiff / m.games : 0,
          avgNetDmg: m.games > 0 ? m.totalNetDmg / m.games : 0,
          avgDpm: m.dpmCount > 0 ? m.totalDpm / m.dpmCount : 0,
          avgHhi: m.games > 0 ? m.totalHhi / m.games : 0,
          avgDuration,
          flagsFor: m.flagsFor,
          flagsAgainst: m.flagsAgainst,
          flagsRatio: m.flagsAgainst > 0 ? m.flagsFor / m.flagsAgainst : (m.flagsFor > 0 ? Infinity : null),
          blowoutRate: m.games > 0 ? (m.blowouts / m.games) * 100 : 0,
          closeRate: m.games > 0 ? (m.closeGames / m.games) * 100 : 0,
          capsPerMin: m.totalDuration > 0 ? m.totalCaps / m.totalDuration : 0,
          medianDur,
          fastWinPct,
          slowWinPct,
          fastCount: fastGames.length,
          slowCount: slowGames.length,
        };
      });
  }, [focusRows]);

  // Tempo labels based on avg duration percentile across maps
  const tempoLabels = useMemo(() => {
    if (mapStats.length === 0) return {};
    const durations = mapStats.map((m) => m.avgDuration).sort((a, b) => a - b);
    const p33 = durations[Math.floor(durations.length / 3)] || 0;
    const p66 = durations[Math.floor((durations.length * 2) / 3)] || 0;
    const labels = {};
    for (const m of mapStats) {
      if (m.avgDuration <= p33) labels[m.map] = 'Fast';
      else if (m.avgDuration >= p66) labels[m.map] = 'Slow';
      else labels[m.map] = 'Medium';
    }
    return labels;
  }, [mapStats]);

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
      flagsRatio: 'flagsRatio',
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

  // Formation breakdown per map from match notes
  const mapFormationStats = useMemo(() => {
    if (!matchNotes || matchNotes.size === 0) return [];
    const byMap = {};
    for (const r of focusRows) {
      const note = matchNotes.get(r.match_id);
      if (!note?.formation) continue;
      if (!byMap[r.map]) byMap[r.map] = {};
      const f = note.formation;
      if (!byMap[r.map][f]) byMap[r.map][f] = { games: 0, wins: 0 };
      byMap[r.map][f].games++;
      if (r.result === 'W') byMap[r.map][f].wins++;
    }
    return Object.entries(byMap)
      .map(([map, formations]) => ({
        map,
        formations: Object.entries(formations)
          .map(([f, d]) => ({ formation: f, games: d.games, wins: d.wins, winPct: d.games > 0 ? (d.wins / d.games) * 100 : 0 }))
          .sort((a, b) => b.games - a.games),
      }))
      .sort((a, b) => b.formations.reduce((s, f) => s + f.games, 0) - a.formations.reduce((s, f) => s + f.games, 0));
  }, [focusRows, matchNotes]);

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
    flags_for: m.flagsFor,
    flags_against: m.flagsAgainst,
    flags_ratio: m.flagsRatio === null ? '' : m.flagsRatio === Infinity ? 'Inf' : m.flagsRatio.toFixed(2),
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
    { key: 'avgHhi', label: <>HHI <InfoTip text="Damage concentration index. 0.25 = perfectly equal damage spread. Higher = one player doing most of the damage." /></> },
    { key: 'flagsRatio', label: <>F.Ratio <InfoTip text="Flags captured / flags conceded on this map. Below 1.0 = conceding more flags than capturing." /></> },
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
      case 'flagsRatio': {
        if (row.flagsRatio === null) return '\u2014';
        if (row.flagsRatio === Infinity) return '\u221E';
        return row.flagsRatio.toFixed(2);
      }
      default: return row[col];
    }
  }

  function cellColor(col, row) {
    if (col === 'winPct') return getStatColor(row.winPct, 'winPct');
    if (col === 'avgCapDiff') return getStatColor(row.avgCapDiff, 'capDiff');
    if (col === 'avgNetDmg') return getStatColor(row.avgNetDmg, 'netDmg');
    if (col === 'avgDpm') return getStatColor(row.avgDpm, 'dpm');
    if (col === 'avgHhi') return getStatColor(row.avgHhi, 'hhi');
    if (col === 'flagsRatio') {
      if (row.flagsRatio === null) return undefined;
      if (row.flagsRatio === Infinity) return 'var(--color-win)';
      return row.flagsRatio >= 1.0 ? 'var(--color-win)' : 'var(--color-loss)';
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
        {mode === 'strict' ? 'Strict' : 'Loose'} dataset
        <InfoTip text={mode === 'strict'
          ? 'One side is a full team AND the opponent has at least 3 players from the same team.'
          : 'One side is a full team (4/4 same team). Opponent can be anyone.'}
        />
        {' '}&middot; maps with {MIN_GAMES}+ games
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
                        {c.key === 'map' ? (
                          <>
                            {row.map}
                            <ConfidenceBadge games={row.games} />
                          </>
                        ) : c.key === 'games' ? (
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

          {/* Formation per map (if annotated) */}
          {mapFormationStats.length > 0 && (
            <div
              className="rounded-lg p-4 mb-6"
              style={{ backgroundColor: 'var(--color-surface)' }}
            >
              <p
                className="text-xs uppercase tracking-wide mb-3"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Formation by Map <InfoTip text="Based on match notes. Small sample — patterns only." />
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mapFormationStats.map((m) => (
                  <div key={m.map} className="px-3 py-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                    <p className="text-sm font-medium mb-1">{m.map}</p>
                    <div className="flex flex-wrap gap-2">
                      {m.formations.map((f) => (
                        <span key={f.formation} className="text-xs">
                          <span style={{ color: 'var(--color-accent)' }}>{f.formation}</span>
                          {' '}
                          <span style={{ color: getStatColor(f.winPct, 'winPct') }}>
                            {f.wins}/{f.games} ({f.winPct.toFixed(0)}%)
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tempo stats per map */}
          <div
            className="rounded-lg p-4 mb-6"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <p className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Map Tempo <InfoTip text="Tempo classification based on avg duration percentile across all maps. Fast/Medium/Slow." />
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Map', 'Tempo', 'Avg Dur', 'Blowout%', 'Close%', 'Caps/min', 'Win% Fast', 'Win% Slow'].map((h) => (
                    <th
                      key={h}
                      className="text-left pb-2 border-b font-medium"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                    >
                      {h === 'Blowout%' ? <>{h} <InfoTip text="Percentage of games decided by 3+ cap difference." /></> :
                       h === 'Close%' ? <>{h} <InfoTip text="Percentage of games decided by \u00B11 cap difference." /></> :
                       h === 'Win% Fast' ? <>{h} <InfoTip text="Win% in games below map's median duration." /></> :
                       h === 'Win% Slow' ? <>{h} <InfoTip text="Win% in games at or above map's median duration." /></> :
                       h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...mapStats].sort((a, b) => a.avgDuration - b.avgDuration).map((m) => {
                  const tempo = tempoLabels[m.map] || 'Medium';
                  const tempoColor = tempo === 'Fast' ? 'var(--color-win)' : tempo === 'Slow' ? 'var(--color-loss)' : 'var(--color-draw)';
                  return (
                    <tr key={m.map}>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>{m.map}</td>
                      <td className="py-1.5 border-b font-semibold" style={{ borderColor: 'var(--color-border)', color: tempoColor }}>
                        {tempo}
                      </td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>{m.avgDuration.toFixed(1)}m</td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>{m.blowoutRate.toFixed(0)}%</td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>{m.closeRate.toFixed(0)}%</td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>{m.capsPerMin.toFixed(2)}</td>
                      <td className="py-1.5 border-b" style={{
                        borderColor: 'var(--color-border)',
                        color: m.fastWinPct !== null ? getStatColor(m.fastWinPct, 'winPct') : undefined,
                      }}>
                        {m.fastWinPct !== null ? `${m.fastWinPct.toFixed(0)}% (${m.fastCount})` : '\u2014'}
                      </td>
                      <td className="py-1.5 border-b" style={{
                        borderColor: 'var(--color-border)',
                        color: m.slowWinPct !== null ? getStatColor(m.slowWinPct, 'winPct') : undefined,
                      }}>
                        {m.slowWinPct !== null ? `${m.slowWinPct.toFixed(0)}% (${m.slowCount})` : '\u2014'}
                      </td>
                    </tr>
                  );
                })}
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

function ConfidenceBadge({ games }) {
  if (games >= 8) return null; // Reliable — no badge needed
  const isLow = games <= 4;
  return (
    <span
      className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium"
      style={{
        backgroundColor: isLow ? 'rgba(249, 115, 22, 0.15)' : 'rgba(234, 179, 8, 0.15)',
        color: isLow ? 'rgb(249, 115, 22)' : 'rgb(234, 179, 8)',
      }}
      title={isLow ? `Low sample size: only ${games} game${games !== 1 ? 's' : ''}. Patterns may not be reliable.` : `Limited sample size: only ${games} games. Trends are suggestive, not definitive.`}
    >
      {'\u26A0'} {isLow ? 'Low sample' : 'Limited'}
    </span>
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
