/**
 * Lineups view — lineup combo table + pair synergy heatmap.
 * Lineup table: min 3 games, sortable, expandable per-opponent breakdown.
 * Pair heatmap: wB players as rows/cols, cells = win% when pair plays together.
 */

import { useState, useMemo } from 'react';
import ExportButton from '../components/ExportButton.jsx';
import PlayerNames from '../components/PlayerNames.jsx';
import { getStatColor, getStatBg } from '../utils/getStatColor.js';

const FOCUS = 'wAnnaBees';
const MIN_GAMES = 3;

export default function Lineups({ data, onNavigateMatchLog }) {
  const { lineupStats, pairStats, teamMatchRows, playerRows } = data;

  // Build set of focus team members for sub badges
  const teamMembers = useMemo(() => {
    const set = new Set();
    for (const p of playerRows) {
      if (p.team_membership === FOCUS) set.add(p.canonical);
    }
    return set;
  }, [playerRows]);

  // --- Lineup table ---
  const [sortCol, setSortCol] = useState('games');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedLineup, setExpandedLineup] = useState(null);

  const filteredLineups = useMemo(
    () => lineupStats.filter((l) => l.games >= MIN_GAMES),
    [lineupStats]
  );

  const sortedLineups = useMemo(() => {
    const key = {
      lineup: 'lineup_key',
      games: 'games',
      winPct: 'win_pct',
      avgCapDiff: 'avg_cap_diff',
      avgNetDmg: 'avg_net_damage',
      avgHhi: 'avg_damage_hhi',
    }[sortCol] || 'games';

    return [...filteredLineups].sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });
  }, [filteredLineups, sortCol, sortAsc]);

  // Per-lineup per-opponent breakdown from teamMatchRows
  const lineupOppBreakdown = useMemo(() => {
    const focusRows = teamMatchRows.filter((r) => r.team_name === FOCUS);
    const map = new Map(); // lineup_key -> Map<opponent, { games, wins, losses, totalCapDiff }>
    for (const r of focusRows) {
      if (!map.has(r.lineup_key)) map.set(r.lineup_key, new Map());
      const oppMap = map.get(r.lineup_key);
      const opp = r.opponent_team || 'MIX';
      if (!oppMap.has(opp)) oppMap.set(opp, { games: 0, wins: 0, losses: 0, totalCapDiff: 0 });
      const entry = oppMap.get(opp);
      entry.games++;
      if (r.result === 'W') entry.wins++;
      if (r.result === 'L') entry.losses++;
      entry.totalCapDiff += r.cap_diff;
    }
    return map;
  }, [teamMatchRows]);

  function handleSort(col) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  }

  const lineupExport = sortedLineups.map((l) => ({
    lineup: l.lineup_key,
    games: l.games,
    wins: l.wins,
    losses: l.losses,
    win_pct: (l.win_pct * 100).toFixed(1),
    avg_cap_diff: l.avg_cap_diff.toFixed(2),
    avg_net_dmg: l.avg_net_damage.toFixed(0),
    avg_hhi: l.avg_damage_hhi.toFixed(3),
    maps: Object.entries(l.maps_played).map(([m, c]) => `${m}(${c})`).join(', '),
  }));

  // --- Pair synergy heatmap ---
  const { players, pairMap, pairExport } = useMemo(() => {
    // Get all wB players who appear in qualifying matches
    const focusRows = teamMatchRows.filter(
      (r) => r.team_name === FOCUS && r.qualifies_loose
    );
    const playerGames = {};
    for (const r of focusRows) {
      for (const p of r.player_names) {
        playerGames[p] = (playerGames[p] || 0) + 1;
      }
    }
    // Sort by games desc
    const sortedPlayers = Object.entries(playerGames)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    // Index pair stats
    const pm = new Map();
    for (const p of pairStats) {
      pm.set(p.pair_key, p);
    }

    // Export data
    const pe = pairStats
      .filter((p) => p.games >= MIN_GAMES)
      .map((p) => ({
        player_a: p.players[0],
        player_b: p.players[1],
        games: p.games,
        wins: p.wins,
        losses: p.losses,
        win_pct: (p.win_pct * 100).toFixed(1),
        avg_net_dmg: p.avg_net_damage.toFixed(0),
      }));

    return { players: sortedPlayers, pairMap: pm, pairExport: pe };
  }, [teamMatchRows, pairStats]);

  const columns = [
    { key: 'lineup', label: 'Lineup' },
    { key: 'games', label: 'G' },
    { key: 'winPct', label: 'Win%' },
    { key: 'avgCapDiff', label: 'Cap Diff' },
    { key: 'avgNetDmg', label: 'Net Dmg' },
    { key: 'avgHhi', label: 'HHI' },
  ];

  const colCount = columns.length + 1; // +1 for Maps column

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Lineup Table */}
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--color-accent)' }}
        >
          Lineups
        </h2>
        <ExportButton data={lineupExport} filename="wb_lineups.csv" />
      </div>

      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Lineups with {MIN_GAMES}+ games &middot; {filteredLineups.length} lineups &middot; click row to expand opponent breakdown
      </p>

      {sortedLineups.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>
          No lineups with {MIN_GAMES}+ games.
        </p>
      ) : (
        <div
          className="rounded-lg p-4 mb-8 overflow-x-auto"
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
                <th
                  className="text-left pb-2 border-b font-medium"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                >
                  Maps
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedLineups.map((l) => {
                const isExpanded = expandedLineup === l.lineup_key;
                return (
                  <LineupRow
                    key={l.lineup_key}
                    lineup={l}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedLineup(isExpanded ? null : l.lineup_key)}
                    oppBreakdown={lineupOppBreakdown.get(l.lineup_key)}
                    colCount={colCount}
                    onNavigateMatchLog={onNavigateMatchLog}
                    teamMembers={teamMembers}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pair Synergy Heatmap */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold" style={{ color: 'var(--color-accent)' }}>
          Pair Synergy
        </h3>
        <ExportButton data={pairExport} filename="wb_pair_synergy.csv" />
      </div>

      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Win% when pair plays together &middot; {MIN_GAMES}+ games shown with color
      </p>

      {players.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No pair data available.</p>
      ) : (
        <div
          className="rounded-lg p-4 overflow-x-auto"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <table className="text-xs">
            <thead>
              <tr>
                <th
                  className="pb-2 border-b text-left font-medium px-1"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                />
                {players.map((p) => (
                  <th
                    key={p}
                    className="pb-2 border-b font-medium px-1 text-center"
                    style={{
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-muted)',
                      writingMode: 'vertical-rl',
                      maxWidth: 32,
                      height: 80,
                    }}
                  >
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((row) => (
                <tr key={row}>
                  <td
                    className="py-1 border-b font-medium pr-2 whitespace-nowrap"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    {row}
                  </td>
                  {players.map((col) => {
                    if (row === col) {
                      return (
                        <td
                          key={col}
                          className="py-1 border-b text-center"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}
                        >
                          &mdash;
                        </td>
                      );
                    }
                    const pairKey = [row, col].sort().join('+');
                    const pair = pairMap.get(pairKey);
                    if (!pair || pair.games < MIN_GAMES) {
                      return (
                        <td
                          key={col}
                          className="py-1 border-b text-center"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-border)' }}
                        >
                          {pair ? pair.games : ''}
                        </td>
                      );
                    }
                    const pct = pair.win_pct * 100;
                    return (
                      <td
                        key={col}
                        className="py-1 border-b text-center font-semibold"
                        title={`${row} + ${col}: ${pair.wins}-${pair.losses} (${pair.games}g)`}
                        style={{
                          borderColor: 'var(--color-border)',
                          backgroundColor: getStatBg(pct, 'winPct'),
                          color: getStatColor(pct, 'winPct') || 'var(--color-text)',
                          minWidth: 36,
                        }}
                      >
                        {pct.toFixed(0)}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LineupRow({ lineup, isExpanded, onToggle, oppBreakdown, colCount, onNavigateMatchLog, teamMembers }) {
  const l = lineup;

  // Build sorted opponent breakdown
  const oppRows = useMemo(() => {
    if (!oppBreakdown) return [];
    const rows = [];
    for (const [opp, d] of oppBreakdown) {
      rows.push({
        opponent: opp,
        games: d.games,
        wins: d.wins,
        losses: d.losses,
        winPct: d.games > 0 ? (d.wins / d.games) * 100 : 0,
        avgCapDiff: d.games > 0 ? d.totalCapDiff / d.games : 0,
      });
    }
    return rows.sort((a, b) => b.games - a.games);
  }, [oppBreakdown]);

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer"
        style={{ backgroundColor: isExpanded ? 'var(--color-surface-hover)' : undefined }}
      >
        <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <PlayerNames names={l.player_names} teamMembers={teamMembers} />
        </td>
        <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span
            className="stat-link"
            onClick={(e) => { e.stopPropagation(); onNavigateMatchLog?.({ lineup: l.lineup_key }); }}
          >
            {l.games}
          </span>
        </td>
        <td
          className="py-1.5 border-b font-semibold"
          style={{
            borderColor: 'var(--color-border)',
            color: getStatColor(l.win_pct * 100, 'winPct'),
          }}
        >
          {(l.win_pct * 100).toFixed(0)}%
          <span className="text-xs font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>
            ({l.wins}-{l.losses})
          </span>
        </td>
        <td
          className="py-1.5 border-b"
          style={{
            borderColor: 'var(--color-border)',
            color: getStatColor(l.avg_cap_diff, 'capDiff'),
          }}
        >
          {l.avg_cap_diff >= 0 ? '+' : ''}{l.avg_cap_diff.toFixed(1)}
        </td>
        <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: getStatColor(l.avg_net_damage, 'netDmg') }}>
          {l.avg_net_damage.toFixed(0)}
        </td>
        <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: getStatColor(l.avg_damage_hhi, 'hhi') }}>
          {l.avg_damage_hhi.toFixed(3)}
        </td>
        <td className="py-1.5 border-b text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          {Object.entries(l.maps_played).map(([m, c]) => `${m}(${c})`).join(', ')}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={colCount} style={{ backgroundColor: 'var(--color-bg)' }}>
            <div className="py-2 px-4">
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Per-Opponent Breakdown
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {['Opponent', 'G', 'W-L', 'Win%', 'Avg Cap Diff'].map((h) => (
                      <th
                        key={h}
                        className="text-left pb-1 border-b font-medium"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {oppRows.map((o) => (
                    <tr key={o.opponent}>
                      <td className="py-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        {o.opponent}
                      </td>
                      <td className="py-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        {o.games}
                      </td>
                      <td className="py-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        {o.wins}-{o.losses}
                      </td>
                      <td
                        className="py-1 border-b font-semibold"
                        style={{
                          borderColor: 'var(--color-border)',
                          color: getStatColor(o.winPct, 'winPct'),
                        }}
                      >
                        {o.winPct.toFixed(0)}%
                      </td>
                      <td
                        className="py-1 border-b"
                        style={{
                          borderColor: 'var(--color-border)',
                          color: getStatColor(o.avgCapDiff, 'capDiff'),
                        }}
                      >
                        {o.avgCapDiff >= 0 ? '+' : ''}{o.avgCapDiff.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

