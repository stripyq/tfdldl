/**
 * Opponent Scouting view — deep-dive stats for a selected opponent computed from ALL their matches.
 * Shows: overall record, map preferences, blowout/close game rates, damage HHI, collapse maps, lineups.
 */

import { useState, useMemo } from 'react';
import ExportButton from '../components/ExportButton.jsx';
import PlayerNames from '../components/PlayerNames.jsx';
import { getStatColor } from '../utils/getStatColor.js';

const FOCUS = 'wAnnaBees';

export default function OpponentScouting({ data, initialOpponent }) {
  const { teamMatchRows, playerRows } = data;

  // All non-focus teams that appear in the data
  const opponents = useMemo(() => {
    const counts = {};
    for (const r of teamMatchRows) {
      if (r.team_name === FOCUS) continue;
      counts[r.team_name] = (counts[r.team_name] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [teamMatchRows]);

  const [selectedOpp, setSelectedOpp] = useState(initialOpponent?.opponent || '');
  const opp = selectedOpp || opponents[0] || '';

  // Build set of opponent team members for sub badges
  const oppMembers = useMemo(() => {
    if (!opp) return new Set();
    const set = new Set();
    for (const p of playerRows) {
      if (p.team_membership === opp) set.add(p.canonical);
    }
    return set;
  }, [playerRows, opp]);

  // All rows for the selected opponent (all their matches, not just vs wB)
  const oppRows = useMemo(() => {
    if (!opp) return [];
    return teamMatchRows.filter((r) => r.team_name === opp);
  }, [teamMatchRows, opp]);

  // --- Overall record ---
  const overall = useMemo(() => {
    const wins = oppRows.filter((r) => r.result === 'W').length;
    const losses = oppRows.filter((r) => r.result === 'L').length;
    const draws = oppRows.filter((r) => r.result === 'D').length;
    const games = oppRows.length;
    return {
      games,
      wins,
      losses,
      draws,
      winPct: games > 0 ? (wins / games) * 100 : 0,
    };
  }, [oppRows]);

  // --- Map stats ---
  const mapStats = useMemo(() => {
    const maps = {};
    for (const r of oppRows) {
      if (!maps[r.map]) maps[r.map] = { games: 0, wins: 0, losses: 0 };
      maps[r.map].games++;
      if (r.result === 'W') maps[r.map].wins++;
      if (r.result === 'L') maps[r.map].losses++;
    }
    return Object.entries(maps)
      .map(([map, d]) => ({
        map,
        games: d.games,
        wins: d.wins,
        losses: d.losses,
        winPct: d.games > 0 ? (d.wins / d.games) * 100 : 0,
      }))
      .sort((a, b) => b.games - a.games);
  }, [oppRows]);

  // --- Blowout rate (won/lost by 3+ caps) ---
  const blowoutStats = useMemo(() => {
    if (oppRows.length === 0) return { blowoutWins: 0, blowoutLosses: 0, rate: 0 };
    let bw = 0;
    let bl = 0;
    for (const r of oppRows) {
      const diff = Math.abs(r.cap_diff);
      if (diff >= 3 && r.result === 'W') bw++;
      if (diff >= 3 && r.result === 'L') bl++;
    }
    return {
      blowoutWins: bw,
      blowoutLosses: bl,
      rate: oppRows.length > 0 ? ((bw + bl) / oppRows.length) * 100 : 0,
    };
  }, [oppRows]);

  // --- Close game record (±1 cap) ---
  const closeStats = useMemo(() => {
    const close = oppRows.filter((r) => Math.abs(r.cap_diff) <= 1);
    const wins = close.filter((r) => r.result === 'W').length;
    const losses = close.filter((r) => r.result === 'L').length;
    return {
      games: close.length,
      wins,
      losses,
      winPct: close.length > 0 ? (wins / close.length) * 100 : 0,
    };
  }, [oppRows]);

  // --- Avg damage HHI and DPM ---
  const avgStats = useMemo(() => {
    if (oppRows.length === 0) return { avgHhi: 0, avgDpm: 0 };
    const totalHhi = oppRows.reduce((s, r) => s + r.damage_hhi, 0);
    const totalDpm = oppRows.reduce((s, r) => s + r.avg_dpm, 0);
    return {
      avgHhi: totalHhi / oppRows.length,
      avgDpm: totalDpm / oppRows.length,
    };
  }, [oppRows]);

  // --- Collapse maps: win% < 40%, min 3 games ---
  const collapseMaps = useMemo(() => {
    return mapStats.filter((m) => m.games >= 3 && m.winPct < 40);
  }, [mapStats]);

  // --- Most common lineups ---
  const lineups = useMemo(() => {
    const map = {};
    for (const r of oppRows) {
      const key = r.lineup_key;
      if (!map[key]) map[key] = { key, players: r.player_names, games: 0, wins: 0, losses: 0 };
      map[key].games++;
      if (r.result === 'W') map[key].wins++;
      if (r.result === 'L') map[key].losses++;
    }
    return Object.values(map)
      .sort((a, b) => b.games - a.games)
      .slice(0, 10);
  }, [oppRows]);

  // --- Export ---
  const exportData = mapStats.map((m) => ({
    opponent: opp,
    map: m.map,
    games: m.games,
    wins: m.wins,
    losses: m.losses,
    win_pct: m.winPct.toFixed(1),
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--color-accent)' }}
        >
          Opponent Scouting
        </h2>
        <ExportButton data={exportData} filename={`wb_scouting_${opp.toLowerCase().replace(/\s+/g, '_')}.csv`} />
      </div>

      {/* Opponent selector */}
      <div className="mb-6">
        <label className="text-xs block mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Opponent
        </label>
        <select
          value={opp}
          onChange={(e) => setSelectedOpp(e.target.value)}
          className="px-3 py-1.5 rounded text-sm cursor-pointer"
          style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
        >
          {opponents.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      {oppRows.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No data for this opponent.</p>
      ) : (
        <>
          {/* Overview stats */}
          <div
            className="rounded-lg p-4 mb-6"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <p
              className="text-xs uppercase tracking-wide mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Overall Record (all matches)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Stat label="Games" value={overall.games} />
              <Stat
                label="Record"
                value={`${overall.wins}W\u2013${overall.losses}L`}
              />
              <Stat
                label="Win%"
                value={`${overall.winPct.toFixed(0)}%`}
                color={getStatColor(overall.winPct, 'winPct', true)}
              />
              <Stat label="Avg DPM" value={avgStats.avgDpm.toFixed(0)} />
              <Stat
                label="Dmg HHI"
                value={avgStats.avgHhi.toFixed(3)}
                note={avgStats.avgHhi > 0.30 ? 'carry-dependent' : 'balanced'}
              />
              <Stat
                label="Blowout Rate"
                value={`${blowoutStats.rate.toFixed(0)}%`}
                note={`${blowoutStats.blowoutWins}W / ${blowoutStats.blowoutLosses}L by 3+`}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <Stat
                label="Close Games (\u00B11)"
                value={`${closeStats.wins}W\u2013${closeStats.losses}L`}
                note={closeStats.games > 0 ? `${closeStats.winPct.toFixed(0)}% from ${closeStats.games}g` : ''}
              />
            </div>
          </div>

          {/* Map preferences */}
          <div
            className="rounded-lg p-4 mb-6"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <p
              className="text-xs uppercase tracking-wide mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Map Preferences (ranked by games played)
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Map', 'G', 'W-L', 'Win%'].map((h) => (
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
                {mapStats.map((m) => (
                  <tr key={m.map}>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                      {m.map}
                    </td>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                      {m.games}
                    </td>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                      {m.wins}-{m.losses}
                    </td>
                    <td
                      className="py-1.5 border-b font-semibold"
                      style={{
                        borderColor: 'var(--color-border)',
                        color: getStatColor(m.winPct, 'winPct', true),
                      }}
                    >
                      {m.winPct.toFixed(0)}%
                      {m.games < 3 && <span className="sample-warn" title={`Low sample size: only ${m.games} game${m.games !== 1 ? 's' : ''}. Patterns may not be reliable.`}>{'\u26A0'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Collapse maps */}
          {collapseMaps.length > 0 && (
            <div
              className="rounded-lg p-4 mb-6"
              style={{ backgroundColor: 'var(--color-surface)' }}
            >
              <p
                className="text-xs uppercase tracking-wide mb-3"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Collapse Maps (win% &lt; 40%, 3+ games) &mdash; opportunities for us
              </p>
              <div className="flex flex-wrap gap-3">
                {collapseMaps.map((m) => (
                  <div
                    key={m.map}
                    className="rounded px-3 py-2 text-sm"
                    style={{
                      backgroundColor: 'rgba(34, 197, 94, 0.12)',
                      border: '1px solid var(--color-win)',
                    }}
                  >
                    <span className="font-semibold" style={{ color: 'var(--color-win)' }}>{m.map}</span>
                    <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {m.winPct.toFixed(0)}% ({m.wins}-{m.losses})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lineups */}
          {lineups.length > 0 && (
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: 'var(--color-surface)' }}
            >
              <p
                className="text-xs uppercase tracking-wide mb-3"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Most Common Lineups
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['Lineup', 'G', 'W-L', 'Win%'].map((h) => (
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
                  {lineups.map((l) => {
                    const pct = l.games > 0 ? (l.wins / l.games) * 100 : 0;
                    return (
                      <tr key={l.key}>
                        <td className="py-1.5 border-b text-xs" style={{ borderColor: 'var(--color-border)' }}>
                          <PlayerNames names={l.players} teamMembers={oppMembers} />
                        </td>
                        <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                          {l.games}
                        </td>
                        <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                          {l.wins}-{l.losses}
                        </td>
                        <td
                          className="py-1.5 border-b font-semibold"
                          style={{
                            borderColor: 'var(--color-border)',
                            color: getStatColor(pct, 'winPct', true),
                          }}
                        >
                          {pct.toFixed(0)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color, note }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p className="text-xl font-bold mt-0.5" style={color ? { color } : undefined}>
        {value}
      </p>
      {note && (
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {note}
        </p>
      )}
    </div>
  );
}
