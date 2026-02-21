/**
 * OpponentMatrix view — heatmap table: rows=maps, columns=opponents.
 * Cells show win% color-coded + record (e.g. '3-1').
 * Uses scopedH2H predicate. Shows deviation from global map win%.
 */

import { useMemo } from 'react';
import ExportButton from '../components/ExportButton.jsx';
import { getStatColor, getStatBg } from '../utils/getStatColor.js';

const FOCUS = 'wAnnaBees';

export default function OpponentMatrix({ data, onNavigateMatchLog }) {
  const { teamMatchRows } = data;

  const { maps, opponents, matrix, globalMapWin, totalGames } = useMemo(() => {
    const rows = teamMatchRows.filter(
      (r) => r.team_name === FOCUS && r.qualifies_h2h
    );

    // Collect unique maps and opponents
    const mapSet = new Set();
    const oppSet = new Set();
    // matrix[map][opp] = { wins, losses, games }
    const mx = {};
    // globalMapWin[map] = { wins, games }
    const gmw = {};

    for (const r of rows) {
      const opp = r.opponent_team || 'Unknown';
      mapSet.add(r.map);
      oppSet.add(opp);

      if (!mx[r.map]) mx[r.map] = {};
      if (!mx[r.map][opp]) mx[r.map][opp] = { wins: 0, losses: 0, games: 0 };
      mx[r.map][opp].games++;
      if (r.result === 'W') mx[r.map][opp].wins++;
      if (r.result === 'L') mx[r.map][opp].losses++;

      if (!gmw[r.map]) gmw[r.map] = { wins: 0, games: 0 };
      gmw[r.map].games++;
      if (r.result === 'W') gmw[r.map].wins++;
    }

    // Sort maps by total games desc, opponents by total games desc
    const oppGames = {};
    for (const opp of oppSet) {
      oppGames[opp] = 0;
      for (const map of mapSet) {
        oppGames[opp] += (mx[map]?.[opp]?.games || 0);
      }
    }

    const sortedMaps = [...mapSet].sort((a, b) => (gmw[b]?.games || 0) - (gmw[a]?.games || 0));
    const sortedOpps = [...oppSet].sort((a, b) => oppGames[b] - oppGames[a]);

    return {
      maps: sortedMaps,
      opponents: sortedOpps,
      matrix: mx,
      globalMapWin: gmw,
      totalGames: rows.length,
    };
  }, [teamMatchRows]);

  // Export data
  const exportData = useMemo(() => {
    const rows = [];
    for (const map of maps) {
      for (const opp of opponents) {
        const cell = matrix[map]?.[opp];
        if (!cell || cell.games === 0) continue;
        const gm = globalMapWin[map];
        const globalPct = gm && gm.games > 0 ? (gm.wins / gm.games) * 100 : 0;
        const cellPct = (cell.wins / cell.games) * 100;
        rows.push({
          map,
          opponent: opp,
          games: cell.games,
          wins: cell.wins,
          losses: cell.losses,
          win_pct: cellPct.toFixed(1),
          global_map_win_pct: globalPct.toFixed(1),
          deviation: (cellPct - globalPct).toFixed(1),
        });
      }
    }
    return rows;
  }, [maps, opponents, matrix, globalMapWin]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--color-accent)' }}
        >
          Opponent Matrix
        </h2>
        <ExportButton data={exportData} filename="wb_opponent_matrix.csv" />
      </div>

      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
        H2H dataset ({totalGames} games) &middot; rows = maps, columns = opponents
      </p>

      {maps.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No H2H qualifying matches.</p>
      ) : (
        <div
          className="rounded-lg p-4 overflow-x-auto"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th
                  className="text-left pb-2 border-b font-medium sticky left-0"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)' }}
                >
                  Map
                </th>
                <th
                  className="text-center pb-2 border-b font-medium"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}
                >
                  All
                </th>
                {opponents.map((opp) => (
                  <th
                    key={opp}
                    className="text-center pb-2 border-b font-medium px-2"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                  >
                    {opp}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {maps.map((map) => {
                const gm = globalMapWin[map];
                const globalPct = gm && gm.games > 0 ? (gm.wins / gm.games) * 100 : 0;
                return (
                  <tr key={map}>
                    <td
                      className="py-1.5 border-b font-medium sticky left-0"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                    >
                      {map}
                    </td>
                    <td
                      className="py-1.5 border-b text-center font-semibold"
                      style={{
                        borderColor: 'var(--color-border)',
                        color: getStatColor(globalPct, 'winPct'),
                      }}
                    >
                      {globalPct.toFixed(0)}%
                      <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>
                        ({gm.wins}-{gm.games - gm.wins})
                      </span>
                    </td>
                    {opponents.map((opp) => {
                      const cell = matrix[map]?.[opp];
                      if (!cell || cell.games === 0) {
                        return (
                          <td
                            key={opp}
                            className="py-1.5 border-b text-center"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-border)' }}
                          >
                            &mdash;
                          </td>
                        );
                      }
                      const pct = (cell.wins / cell.games) * 100;
                      const dev = pct - globalPct;
                      return (
                        <td
                          key={opp}
                          className="py-1.5 border-b text-center px-2"
                          style={{
                            borderColor: 'var(--color-border)',
                            backgroundColor: getStatBg(pct, 'winPct'),
                          }}
                        >
                          <span
                            className="font-semibold stat-link"
                            style={{ color: 'var(--color-text)' }}
                            onClick={() => onNavigateMatchLog?.({ map, opponent: opp, dataset: 'h2h' })}
                          >
                            {cell.wins}-{cell.losses}
                          </span>
                          {cell.games < 3 && <span className="sample-warn" title="Small sample size">{'\u26A0'}</span>}
                          <br />
                          <span className="text-xs" style={{
                            color: dev > 10 ? 'var(--color-win)' : dev < -10 ? 'var(--color-loss)' : 'var(--color-text-muted)',
                          }}>
                            {dev >= 0 ? '+' : ''}{dev.toFixed(0)}%
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

