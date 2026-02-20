/**
 * Draft Helper view — map pick/ban advisor for a given opponent.
 * Shows best pick, safe pick, veto recommendation, and full map breakdown.
 */

import { useState, useMemo } from 'react';

const MIN_H2H = 2;

export default function DraftHelper({ data }) {
  const { teamMatchRows } = data;

  // Focus team rows (loose qualification)
  const focusRows = useMemo(
    () => teamMatchRows.filter((r) => r.team_name === 'wAnnaBees' && r.qualifies_loose),
    [teamMatchRows]
  );

  // Unique opponents sorted by game count
  const opponents = useMemo(() => {
    const counts = {};
    for (const r of focusRows) {
      const opp = r.opponent_team || 'Unknown';
      counts[opp] = (counts[opp] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [focusRows]);

  const [selectedOpp, setSelectedOpp] = useState('');

  // Global map stats (all opponents)
  const globalMapStats = useMemo(() => {
    const stats = {};
    for (const r of focusRows) {
      if (!stats[r.map]) stats[r.map] = { games: 0, wins: 0, losses: 0 };
      stats[r.map].games++;
      if (r.result === 'W') stats[r.map].wins++;
      if (r.result === 'L') stats[r.map].losses++;
    }
    for (const s of Object.values(stats)) {
      s.winPct = s.games > 0 ? (s.wins / s.games) * 100 : 0;
    }
    return stats;
  }, [focusRows]);

  // H2H map stats against selected opponent
  const h2hMapStats = useMemo(() => {
    if (!selectedOpp) return {};
    const stats = {};
    for (const r of focusRows) {
      if (r.opponent_team !== selectedOpp) continue;
      if (!stats[r.map]) stats[r.map] = { games: 0, wins: 0, losses: 0 };
      stats[r.map].games++;
      if (r.result === 'W') stats[r.map].wins++;
      if (r.result === 'L') stats[r.map].losses++;
    }
    for (const s of Object.values(stats)) {
      s.winPct = s.games > 0 ? (s.wins / s.games) * 100 : 0;
    }
    return stats;
  }, [focusRows, selectedOpp]);

  // All maps from both global and h2h
  const allMaps = useMemo(() => {
    const mapSet = new Set([...Object.keys(globalMapStats), ...Object.keys(h2hMapStats)]);
    return [...mapSet].sort();
  }, [globalMapStats, h2hMapStats]);

  const hasH2H = Object.keys(h2hMapStats).length > 0;

  // Build table rows
  const tableRows = useMemo(() => {
    return allMaps.map((map) => {
      const global = globalMapStats[map] || { games: 0, wins: 0, losses: 0, winPct: 0 };
      const h2h = h2hMapStats[map] || null;
      const h2hWinPct = h2h ? h2h.winPct : null;
      const h2hGames = h2h ? h2h.games : 0;

      // Recommendation logic
      let rec = '';
      if (selectedOpp) {
        const effectivePct = h2hGames >= MIN_H2H ? h2hWinPct : global.winPct;
        if (effectivePct >= 60) rec = 'pick';
        else if (effectivePct >= 45) rec = 'safe';
        else rec = 'avoid';
      }

      return { map, global, h2h, h2hGames, h2hWinPct, rec };
    });
  }, [allMaps, globalMapStats, h2hMapStats, selectedOpp]);

  // Best pick: highest win% vs opponent (min 2 H2H games, fallback to global)
  const bestPick = useMemo(() => {
    if (!selectedOpp) return null;
    const candidates = tableRows
      .filter((r) => r.h2hGames >= MIN_H2H)
      .sort((a, b) => b.h2hWinPct - a.h2hWinPct);
    if (candidates.length > 0) return { map: candidates[0].map, pct: candidates[0].h2hWinPct, source: 'h2h' };
    // Fallback to global
    const globalSorted = tableRows
      .filter((r) => r.global.games >= MIN_H2H)
      .sort((a, b) => b.global.winPct - a.global.winPct);
    if (globalSorted.length > 0) return { map: globalSorted[0].map, pct: globalSorted[0].global.winPct, source: 'global' };
    return null;
  }, [selectedOpp, tableRows]);

  // Safe pick: highest global win% regardless of opponent
  const safePick = useMemo(() => {
    const sorted = tableRows
      .filter((r) => r.global.games >= MIN_H2H)
      .sort((a, b) => b.global.winPct - a.global.winPct);
    return sorted.length > 0 ? { map: sorted[0].map, pct: sorted[0].global.winPct } : null;
  }, [tableRows]);

  // Veto: opponent's best map (our lowest win% vs them)
  const veto = useMemo(() => {
    if (!selectedOpp) return null;
    const candidates = tableRows
      .filter((r) => r.h2hGames >= MIN_H2H)
      .sort((a, b) => a.h2hWinPct - b.h2hWinPct);
    if (candidates.length > 0) return { map: candidates[0].map, pct: candidates[0].h2hWinPct };
    const globalSorted = tableRows
      .filter((r) => r.global.games >= MIN_H2H)
      .sort((a, b) => a.global.winPct - b.global.winPct);
    if (globalSorted.length > 0) return { map: globalSorted[0].map, pct: globalSorted[0].global.winPct, source: 'global' };
    return null;
  }, [selectedOpp, tableRows]);

  function recColor(rec) {
    if (rec === 'pick') return 'var(--color-win)';
    if (rec === 'avoid') return 'var(--color-loss)';
    return 'var(--color-text-muted)';
  }

  function recLabel(rec) {
    if (rec === 'pick') return 'Pick';
    if (rec === 'avoid') return 'Avoid';
    if (rec === 'safe') return 'Safe';
    return '';
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2
        className="text-2xl font-bold mb-6"
        style={{ color: 'var(--color-accent)' }}
      >
        Draft Helper
      </h2>

      {/* Opponent selector */}
      <div className="mb-6">
        <label
          className="text-sm block mb-1"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Select Opponent
        </label>
        <select
          value={selectedOpp}
          onChange={(e) => setSelectedOpp(e.target.value)}
          className="px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
        >
          <option value="">— choose opponent —</option>
          {opponents.map((opp) => (
            <option key={opp} value={opp}>{opp}</option>
          ))}
        </select>
      </div>

      {/* Recommendations cards */}
      {selectedOpp && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <RecCard
            label="Best Pick"
            subtitle="Highest win% vs opponent"
            map={bestPick?.map}
            pct={bestPick?.pct}
            note={bestPick?.source === 'global' ? 'Based on global (no H2H data)' : null}
            color="var(--color-win)"
          />
          <RecCard
            label="Safe Pick"
            subtitle="Highest global win%"
            map={safePick?.map}
            pct={safePick?.pct}
            color="var(--color-accent)"
          />
          <RecCard
            label="Veto"
            subtitle="Their best map vs you"
            map={veto?.map}
            pct={veto?.pct}
            note={veto?.source === 'global' ? 'Based on global (no H2H data)' : null}
            color="var(--color-loss)"
          />
        </div>
      )}

      {/* No opponent selected — show global note */}
      {!selectedOpp && (
        <div
          className="rounded-lg p-4 mb-6 text-sm"
          style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
        >
          Select an opponent above to see pick/ban recommendations. Showing global map strength below.
        </div>
      )}

      {/* H2H data note */}
      {selectedOpp && !hasH2H && (
        <div
          className="rounded-lg p-4 mb-6 text-sm"
          style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
        >
          No head-to-head data vs {selectedOpp}. Recommendations are based on global map strength.
        </div>
      )}

      {/* Full map table */}
      <div
        className="rounded-lg p-4"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <p
          className="text-xs uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Map Breakdown{selectedOpp ? ` vs ${selectedOpp}` : ''}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {[
                  'Map',
                  'Global W%',
                  'Global G',
                  ...(selectedOpp ? ['H2H W%', 'H2H G', 'Rec'] : []),
                ].map((h) => (
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
              {tableRows
                .sort((a, b) => b.global.winPct - a.global.winPct)
                .map((r) => (
                  <tr key={r.map}>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                      {r.map}
                    </td>
                    <td
                      className="py-1.5 border-b font-medium"
                      style={{
                        borderColor: 'var(--color-border)',
                        color: r.global.winPct >= 60
                          ? 'var(--color-win)'
                          : r.global.winPct < 40
                            ? 'var(--color-loss)'
                            : 'var(--color-text)',
                      }}
                    >
                      {r.global.winPct.toFixed(0)}%
                    </td>
                    <td
                      className="py-1.5 border-b"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                    >
                      {r.global.games} ({r.global.wins}W-{r.global.losses}L)
                    </td>
                    {selectedOpp && (
                      <>
                        <td
                          className="py-1.5 border-b font-medium"
                          style={{
                            borderColor: 'var(--color-border)',
                            color: r.h2hWinPct !== null
                              ? r.h2hWinPct >= 60
                                ? 'var(--color-win)'
                                : r.h2hWinPct < 40
                                  ? 'var(--color-loss)'
                                  : 'var(--color-text)'
                              : 'var(--color-text-muted)',
                          }}
                        >
                          {r.h2hWinPct !== null ? `${r.h2hWinPct.toFixed(0)}%` : '—'}
                          {r.h2hGames > 0 && r.h2hGames < 3 && <span className="sample-warn" title="Small sample size">{'\u26A0'}</span>}
                        </td>
                        <td
                          className="py-1.5 border-b"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                        >
                          {r.h2h ? `${r.h2hGames} (${r.h2h.wins}W-${r.h2h.losses}L)` : '—'}
                        </td>
                        <td
                          className="py-1.5 border-b font-semibold"
                          style={{ borderColor: 'var(--color-border)', color: recColor(r.rec) }}
                        >
                          {recLabel(r.rec)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RecCard({ label, subtitle, map, pct, note, color }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ backgroundColor: 'var(--color-surface)', borderLeft: `3px solid ${color}` }}
    >
      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
        {subtitle}
      </p>
      {map ? (
        <>
          <p className="text-lg font-bold" style={{ color }}>
            {map}
          </p>
          <p className="text-sm font-medium" style={{ color }}>
            {pct.toFixed(0)}% win rate
          </p>
          {note && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{note}</p>
          )}
        </>
      ) : (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Insufficient data
        </p>
      )}
    </div>
  );
}
