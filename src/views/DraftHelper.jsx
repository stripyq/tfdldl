/**
 * Draft Helper view — map pick/ban advisor for a given opponent.
 * Shows best pick, safe pick, veto recommendation, and full map breakdown.
 */

import { useState, useMemo } from 'react';
import ExportButton from '../components/ExportButton.jsx';
import { getStatColor } from '../utils/getStatColor.js';

const MIN_H2H = 2;

export default function DraftHelper({ data }) {
  const { teamMatchRows, focusTeam, lineupStats } = data;

  // Focus team rows (loose qualification)
  const focusRows = useMemo(
    () => teamMatchRows.filter((r) => r.team_name === focusTeam && r.qualifies_loose),
    [teamMatchRows, focusTeam]
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
  const [selectedOurLineup, setSelectedOurLineup] = useState('');
  const [selectedTheirLineup, setSelectedTheirLineup] = useState('');

  // Available focus team lineups for "Our Lineup" selector (min 2 games)
  const ourLineupOptions = useMemo(() => {
    if (!lineupStats) return [];
    return lineupStats
      .filter((l) => l.games >= 2)
      .sort((a, b) => b.games - a.games);
  }, [lineupStats]);

  // Available opponent lineups for "Their Lineup" selector (min 2 games, scoped to selected opponent)
  const theirLineupOptions = useMemo(() => {
    if (!selectedOpp) return [];
    const counts = {};
    for (const r of focusRows) {
      if (r.opponent_team !== selectedOpp) continue;
      const key = r.opponent_lineup_key;
      if (!key) continue;
      if (!counts[key]) counts[key] = { lineup_key: key, games: 0, player_names: null };
      counts[key].games++;
      if (!counts[key].player_names) counts[key].player_names = key.split('+');
    }
    return Object.values(counts)
      .filter((l) => l.games >= 2)
      .sort((a, b) => b.games - a.games);
  }, [focusRows, selectedOpp]);

  // Reset their lineup when opponent changes
  const prevOppRef = { current: selectedOpp };
  useMemo(() => {
    if (prevOppRef.current !== selectedOpp) {
      setSelectedTheirLineup('');
    }
    prevOppRef.current = selectedOpp;
  }, [selectedOpp]);

  // Per-map stats for selected "Our Lineup"
  const ourLineupMapStats = useMemo(() => {
    if (!selectedOurLineup) return {};
    const stats = {};
    for (const r of focusRows) {
      if (r.lineup_key !== selectedOurLineup) continue;
      if (!stats[r.map]) stats[r.map] = { games: 0, wins: 0, losses: 0 };
      stats[r.map].games++;
      if (r.result === 'W') stats[r.map].wins++;
      if (r.result === 'L') stats[r.map].losses++;
    }
    for (const s of Object.values(stats)) {
      s.winPct = s.games > 0 ? (s.wins / s.games) * 100 : 0;
    }
    return stats;
  }, [focusRows, selectedOurLineup]);

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

  // H2H map stats against selected opponent (optionally filtered by their lineup)
  const h2hMapStats = useMemo(() => {
    if (!selectedOpp) return {};
    const stats = {};
    for (const r of focusRows) {
      if (r.opponent_team !== selectedOpp) continue;
      if (selectedTheirLineup && r.opponent_lineup_key !== selectedTheirLineup) continue;
      if (!stats[r.map]) stats[r.map] = { games: 0, wins: 0, losses: 0 };
      stats[r.map].games++;
      if (r.result === 'W') stats[r.map].wins++;
      if (r.result === 'L') stats[r.map].losses++;
    }
    for (const s of Object.values(stats)) {
      s.winPct = s.games > 0 ? (s.wins / s.games) * 100 : 0;
    }
    return stats;
  }, [focusRows, selectedOpp, selectedTheirLineup]);

  // Opponent's global map stats (from ALL their matches, not just vs us)
  const oppGlobalMapStats = useMemo(() => {
    if (!selectedOpp) return {};
    const stats = {};
    for (const r of teamMatchRows) {
      if (r.team_name !== selectedOpp) continue;
      if (!stats[r.map]) stats[r.map] = { games: 0, wins: 0, losses: 0 };
      stats[r.map].games++;
      if (r.result === 'W') stats[r.map].wins++;
      if (r.result === 'L') stats[r.map].losses++;
    }
    for (const s of Object.values(stats)) {
      s.winPct = s.games > 0 ? (s.wins / s.games) * 100 : 0;
    }
    return stats;
  }, [teamMatchRows, selectedOpp]);

  // All maps from global, h2h, and opponent global
  const allMaps = useMemo(() => {
    const mapSet = new Set([
      ...Object.keys(globalMapStats),
      ...Object.keys(h2hMapStats),
      ...Object.keys(oppGlobalMapStats),
    ]);
    return [...mapSet].sort();
  }, [globalMapStats, h2hMapStats, oppGlobalMapStats]);

  const hasH2H = Object.keys(h2hMapStats).length > 0;

  // Build table rows
  const tableRows = useMemo(() => {
    return allMaps.map((map) => {
      const global = globalMapStats[map] || { games: 0, wins: 0, losses: 0, winPct: 0 };
      const h2h = h2hMapStats[map] || null;
      const h2hWinPct = h2h ? h2h.winPct : null;
      const h2hGames = h2h ? h2h.games : 0;
      const oppGlobal = oppGlobalMapStats[map] || null;

      // Recommendation logic
      let rec = '';
      if (selectedOpp) {
        const effectivePct = h2hGames >= MIN_H2H ? h2hWinPct : global.winPct;
        if (effectivePct >= 60) rec = 'pick';
        else if (effectivePct >= 45) rec = 'safe';
        else rec = 'avoid';
      }

      return { map, global, h2h, h2hGames, h2hWinPct, oppGlobal, rec };
    });
  }, [allMaps, globalMapStats, h2hMapStats, oppGlobalMapStats, selectedOpp]);

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

  // Veto/Avoid: opponent's best map against us (our lowest win% vs them)
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

  // Ban: opponent's highest global win% map (from ALL their matches, not just vs us)
  const ban = useMemo(() => {
    if (!selectedOpp) return null;
    const candidates = tableRows
      .filter((r) => r.oppGlobal && r.oppGlobal.games >= MIN_H2H)
      .sort((a, b) => b.oppGlobal.winPct - a.oppGlobal.winPct);
    if (candidates.length > 0) {
      return { map: candidates[0].map, pct: candidates[0].oppGlobal.winPct };
    }
    return null;
  }, [selectedOpp, tableRows]);

  // Text summary — includes opponent's global % where relevant
  const summaryText = useMemo(() => {
    if (!selectedOpp) return '';
    const parts = [];
    if (bestPick) {
      const oppStat = oppGlobalMapStats[bestPick.map];
      const oppPart = oppStat ? `, them ${oppStat.winPct.toFixed(0)}%` : '';
      parts.push(`Pick: ${bestPick.map} (you ${bestPick.pct.toFixed(0)}%${oppPart})`);
    }
    if (ban) {
      parts.push(`Ban: ${ban.map} (them ${ban.pct.toFixed(0)}%)`);
    }
    if (veto) {
      parts.push(`Avoid: ${veto.map} (you ${veto.pct.toFixed(0)}%)`);
    }
    if (safePick) {
      parts.push(`Safe: ${safePick.map} (you ${safePick.pct.toFixed(0)}%)`);
    }
    return parts.join('. ') + '.';
  }, [selectedOpp, bestPick, ban, veto, safePick, oppGlobalMapStats]);

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

  // Export data (after recLabel defined so compiler can inline)
  const exportData = tableRows.map((r) => {
    const lu = ourLineupMapStats[r.map];
    return {
    map: r.map,
    wb_global_win_pct: r.global.winPct.toFixed(1),
    wb_global_record: `${r.global.wins}W-${r.global.losses}L`,
    ...(selectedOurLineup ? {
      our_lineup_win_pct: lu?.games >= 2 ? lu.winPct.toFixed(1) : '',
      our_lineup_record: lu?.games >= 2 ? `${lu.wins}W-${lu.losses}L` : '',
    } : {}),
    wb_vs_opp_win_pct: r.h2hWinPct !== null ? r.h2hWinPct.toFixed(1) : '',
    wb_vs_opp_record: r.h2h ? `${r.h2h.wins}W-${r.h2h.losses}L` : '',
    ...(selectedTheirLineup ? { their_lineup_filter: selectedTheirLineup } : {}),
    opp_global_win_pct: r.oppGlobal ? r.oppGlobal.winPct.toFixed(1) : '',
    opp_global_record: r.oppGlobal ? `${r.oppGlobal.wins}W-${r.oppGlobal.losses}L` : '',
    recommendation: recLabel(r.rec),
  };});

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--color-accent)' }}
        >
          Draft Helper
        </h2>
        {selectedOpp && (
          <ExportButton data={exportData} filename={`wb_draft_vs_${selectedOpp.toLowerCase().replace(/\s+/g, '_')}.csv`} />
        )}
      </div>

      {/* Opponent + lineup selectors */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
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
        {ourLineupOptions.length > 0 && (
          <div>
            <label
              className="text-sm block mb-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Our Lineup
            </label>
            <select
              value={selectedOurLineup}
              onChange={(e) => setSelectedOurLineup(e.target.value)}
              className="px-3 py-2 rounded text-sm"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              <option value="">All lineups</option>
              {ourLineupOptions.map((l) => (
                <option key={l.lineup_key} value={l.lineup_key}>
                  {l.player_names.join(' \u00B7 ')} ({l.games}g)
                </option>
              ))}
            </select>
          </div>
        )}
        {selectedOpp && theirLineupOptions.length > 0 && (
          <div>
            <label
              className="text-sm block mb-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Their Lineup
            </label>
            <select
              value={selectedTheirLineup}
              onChange={(e) => setSelectedTheirLineup(e.target.value)}
              className="px-3 py-2 rounded text-sm"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              <option value="">All lineups</option>
              {theirLineupOptions.map((l) => (
                <option key={l.lineup_key} value={l.lineup_key}>
                  {l.player_names.join(' \u00B7 ')} ({l.games}g)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Recommendations cards */}
      {selectedOpp && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
            label="Avoid"
            subtitle="Your lowest win% vs them"
            map={veto?.map}
            pct={veto?.pct}
            note={veto?.source === 'global' ? 'Based on global (no H2H data)' : null}
            color="var(--color-loss)"
          />
          <RecCard
            label="Ban"
            subtitle="Their highest global win%"
            map={ban?.map}
            pct={ban?.pct}
            pctLabel="opp global win%"
            color="var(--color-loss)"
          />
        </div>
      )}

      {/* Text summary */}
      {selectedOpp && summaryText && (
        <div
          className="rounded-lg p-3 mb-6 text-sm"
          style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
        >
          {summaryText}
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
          No head-to-head data vs {selectedOpp}{selectedTheirLineup ? ' with this lineup filter' : ''}. Recommendations are based on global map strength.
        </div>
      )}
      {selectedOpp && hasH2H && selectedTheirLineup && Object.values(h2hMapStats).reduce((s, m) => s + m.games, 0) < 2 && (
        <div
          className="rounded-lg p-4 mb-6 text-sm"
          style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-draw, orange)' }}
        >
          Low sample: &lt;2 games for this opponent lineup filter. H2H data may not be reliable.
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
                  'wB Global W%',
                  ...(selectedOurLineup ? ['Our Lineup W%'] : []),
                  ...(selectedOpp ? ['wB vs Opp W%', 'wB vs Opp Record', 'Opp Global W%', 'Opp Global Record', 'Rec'] : ['Games']),
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
                        color: getStatColor(r.global.winPct, 'winPct'),
                      }}
                    >
                      {r.global.winPct.toFixed(0)}%
                      <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>
                        ({r.global.wins}-{r.global.losses})
                      </span>
                    </td>
                    {selectedOurLineup && (
                      <td
                        className="py-1.5 border-b font-medium"
                        style={{
                          borderColor: 'var(--color-border)',
                          color: ourLineupMapStats[r.map]?.games >= 2
                            ? getStatColor(ourLineupMapStats[r.map].winPct, 'winPct')
                            : 'var(--color-text-muted)',
                        }}
                      >
                        {ourLineupMapStats[r.map]?.games >= 2
                          ? <>{ourLineupMapStats[r.map].winPct.toFixed(0)}%<span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>({ourLineupMapStats[r.map].wins}-{ourLineupMapStats[r.map].losses})</span></>
                          : '\u2014'}
                      </td>
                    )}
                    {selectedOpp ? (
                      <>
                        <td
                          className="py-1.5 border-b font-medium"
                          style={{
                            borderColor: 'var(--color-border)',
                            color: r.h2hWinPct !== null
                              ? getStatColor(r.h2hWinPct, 'winPct') || 'var(--color-text)'
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
                          {r.h2h ? `${r.h2h.wins}W-${r.h2h.losses}L` : '—'}
                        </td>
                        <td
                          className="py-1.5 border-b font-medium"
                          style={{
                            borderColor: 'var(--color-border)',
                            color: r.oppGlobal
                              ? getStatColor(r.oppGlobal.winPct, 'winPct', true) || 'var(--color-text)'
                              : 'var(--color-text-muted)',
                          }}
                        >
                          {r.oppGlobal ? `${r.oppGlobal.winPct.toFixed(0)}%` : '—'}
                          {r.oppGlobal && r.oppGlobal.games < 3 && <span className="sample-warn" title="Small sample size">{'\u26A0'}</span>}
                        </td>
                        <td
                          className="py-1.5 border-b"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                        >
                          {r.oppGlobal ? `${r.oppGlobal.wins}W-${r.oppGlobal.losses}L` : '—'}
                        </td>
                        <td
                          className="py-1.5 border-b font-semibold"
                          style={{ borderColor: 'var(--color-border)', color: recColor(r.rec) }}
                        >
                          {recLabel(r.rec)}
                        </td>
                      </>
                    ) : (
                      <td
                        className="py-1.5 border-b"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                      >
                        {r.global.games}
                      </td>
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

function RecCard({ label, subtitle, map, pct, pctLabel, note, color }) {
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
            {pct.toFixed(0)}% {pctLabel || 'win rate'}
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
