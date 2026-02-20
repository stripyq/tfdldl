/**
 * Lineups view — lineup combo table + pair synergy heatmap.
 * Lineup table: min 3 games, sortable.
 * Pair heatmap: wB players as rows/cols, cells = win% when pair plays together.
 */

import { useState, useMemo } from 'react';
import ExportButton from '../components/ExportButton.jsx';

const FOCUS = 'wAnnaBees';
const MIN_GAMES = 3;

export default function Lineups({ data }) {
  const { lineupStats, pairStats, teamMatchRows } = data;

  // --- Lineup table ---
  const [sortCol, setSortCol] = useState('games');
  const [sortAsc, setSortAsc] = useState(false);

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
        Lineups with {MIN_GAMES}+ games &middot; {filteredLineups.length} lineups
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
              {sortedLineups.map((l) => (
                <tr key={l.lineup_key}>
                  <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    {l.player_names.join(' \u00B7 ')}
                  </td>
                  <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    {l.games}
                  </td>
                  <td
                    className="py-1.5 border-b font-semibold"
                    style={{
                      borderColor: 'var(--color-border)',
                      color: l.win_pct * 100 > 60 ? 'var(--color-win)' : l.win_pct * 100 < 40 ? 'var(--color-loss)' : undefined,
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
                      color: l.avg_cap_diff > 0 ? 'var(--color-win)' : l.avg_cap_diff < 0 ? 'var(--color-loss)' : undefined,
                    }}
                  >
                    {l.avg_cap_diff >= 0 ? '+' : ''}{l.avg_cap_diff.toFixed(1)}
                  </td>
                  <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    {l.avg_net_damage.toFixed(0)}
                  </td>
                  <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    {l.avg_damage_hhi.toFixed(3)}
                  </td>
                  <td className="py-1.5 border-b text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                    {Object.entries(l.maps_played).map(([m, c]) => `${m}(${c})`).join(', ')}
                  </td>
                </tr>
              ))}
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
                          backgroundColor: pairBg(pct),
                          color: pct > 65 ? 'var(--color-win)' : pct < 45 ? 'var(--color-loss)' : 'var(--color-text)',
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

function pairBg(pct) {
  if (pct > 65) return 'rgba(34, 197, 94, 0.15)';
  if (pct < 45) return 'rgba(239, 68, 68, 0.12)';
  return 'transparent';
}
