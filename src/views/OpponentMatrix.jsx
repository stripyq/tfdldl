/**
 * Opponents view — combined opponent matrix + draft helper.
 * Top: heatmap table (rows=maps, columns=opponents, H2H dataset).
 * Bottom: opponent dropdown → pick/ban recommendation cards + map breakdown.
 */

import { useState, useMemo } from 'react';
import ExportButton from '../components/ExportButton.jsx';
import { getStatColor, getStatBg } from '../utils/getStatColor.js';

const MIN_H2H = 2;

function fmtRatio(f, a) {
  if (f === 0 && a === 0) return '\u2014';
  if (a === 0) return '\u221E';
  return (f / a).toFixed(2);
}

function ratioColor(f, a) {
  if (a === 0) return f > 0 ? 'var(--color-win)' : undefined;
  const r = f / a;
  return r >= 1.0 ? 'var(--color-win)' : 'var(--color-loss)';
}

export default function OpponentMatrix({ data, officialOnly, onNavigateMatchLog, matchNotes, initialOpponent }) {
  const { teamMatchRows, focusTeam, lineupStats } = data;

  // ── Opponent Matrix (H2H dataset) ──────────────────────────────

  const { maps, opponents: matrixOpponents, matrix, globalMapWin, totalGames } = useMemo(() => {
    const rows = teamMatchRows.filter(
      (r) => r.team_name === focusTeam && r.qualifies_h2h && (!officialOnly || r.match_type === 'official')
    );

    const mapSet = new Set();
    const oppSet = new Set();
    const mx = {};
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
  }, [teamMatchRows, focusTeam, officialOnly]);

  const matrixExportData = useMemo(() => {
    const rows = [];
    for (const map of maps) {
      for (const opp of matrixOpponents) {
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
  }, [maps, matrixOpponents, matrix, globalMapWin]);

  // ── Draft Helper (loose dataset) ───────────────────────────────

  const focusRows = useMemo(
    () => teamMatchRows.filter((r) => r.team_name === focusTeam && r.qualifies_loose && (!officialOnly || r.match_type === 'official')),
    [teamMatchRows, focusTeam, officialOnly]
  );

  const draftOpponents = useMemo(() => {
    const counts = {};
    for (const r of focusRows) {
      const opp = r.opponent_team || 'Unknown';
      counts[opp] = (counts[opp] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [focusRows]);

  const [selectedOpp, setSelectedOpp] = useState(initialOpponent?.opponent || '');
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

  // Their lineup is implicitly reset when theirLineupOptions changes (opponent change)
  // If selected value not in options, treat as empty
  const effectiveTheirLineup = theirLineupOptions.some((l) => l.lineup_key === selectedTheirLineup)
    ? selectedTheirLineup
    : '';

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

  const globalMapStats = useMemo(() => {
    const stats = {};
    for (const r of focusRows) {
      if (!stats[r.map]) stats[r.map] = { games: 0, wins: 0, losses: 0, flagsFor: 0, flagsAgainst: 0 };
      stats[r.map].games++;
      if (r.result === 'W') stats[r.map].wins++;
      if (r.result === 'L') stats[r.map].losses++;
      stats[r.map].flagsFor += r.score_for;
      stats[r.map].flagsAgainst += r.score_against;
    }
    for (const s of Object.values(stats)) {
      s.winPct = s.games > 0 ? (s.wins / s.games) * 100 : 0;
    }
    return stats;
  }, [focusRows]);

  const h2hMapStats = useMemo(() => {
    if (!selectedOpp) return {};
    const stats = {};
    for (const r of focusRows) {
      if (r.opponent_team !== selectedOpp) continue;
      if (effectiveTheirLineup && r.opponent_lineup_key !== effectiveTheirLineup) continue;
      if (!stats[r.map]) stats[r.map] = { games: 0, wins: 0, losses: 0, flagsFor: 0, flagsAgainst: 0 };
      stats[r.map].games++;
      if (r.result === 'W') stats[r.map].wins++;
      if (r.result === 'L') stats[r.map].losses++;
      stats[r.map].flagsFor += r.score_for;
      stats[r.map].flagsAgainst += r.score_against;
    }
    for (const s of Object.values(stats)) {
      s.winPct = s.games > 0 ? (s.wins / s.games) * 100 : 0;
    }
    return stats;
  }, [focusRows, selectedOpp, effectiveTheirLineup]);

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

  const allDraftMaps = useMemo(() => {
    const mapSet = new Set([
      ...Object.keys(globalMapStats),
      ...Object.keys(h2hMapStats),
      ...Object.keys(oppGlobalMapStats),
    ]);
    return [...mapSet].sort();
  }, [globalMapStats, h2hMapStats, oppGlobalMapStats]);

  const hasH2H = Object.keys(h2hMapStats).length > 0;

  const tableRows = useMemo(() => {
    return allDraftMaps.map((map) => {
      const global = globalMapStats[map] || { games: 0, wins: 0, losses: 0, winPct: 0 };
      const h2h = h2hMapStats[map] || null;
      const h2hWinPct = h2h ? h2h.winPct : null;
      const h2hGames = h2h ? h2h.games : 0;
      const oppGlobal = oppGlobalMapStats[map] || null;

      let rec = '';
      if (selectedOpp) {
        const effectivePct = h2hGames >= MIN_H2H ? h2hWinPct : global.winPct;
        if (effectivePct >= 60) rec = 'pick';
        else if (effectivePct >= 45) rec = 'safe';
        else rec = 'avoid';
      }

      return { map, global, h2h, h2hGames, h2hWinPct, oppGlobal, rec };
    });
  }, [allDraftMaps, globalMapStats, h2hMapStats, oppGlobalMapStats, selectedOpp]);

  const bestPick = useMemo(() => {
    if (!selectedOpp) return null;
    const candidates = tableRows
      .filter((r) => r.h2hGames >= MIN_H2H)
      .sort((a, b) => b.h2hWinPct - a.h2hWinPct);
    if (candidates.length > 0) return { map: candidates[0].map, pct: candidates[0].h2hWinPct, source: 'h2h' };
    const globalSorted = tableRows
      .filter((r) => r.global.games >= MIN_H2H)
      .sort((a, b) => b.global.winPct - a.global.winPct);
    if (globalSorted.length > 0) return { map: globalSorted[0].map, pct: globalSorted[0].global.winPct, source: 'global' };
    return null;
  }, [selectedOpp, tableRows]);

  const safePick = useMemo(() => {
    const sorted = tableRows
      .filter((r) => r.global.games >= MIN_H2H)
      .sort((a, b) => b.global.winPct - a.global.winPct);
    return sorted.length > 0 ? { map: sorted[0].map, pct: sorted[0].global.winPct } : null;
  }, [tableRows]);

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

  // Veto history from official match notes vs selected opponent
  const vetoHistory = useMemo(() => {
    if (!selectedOpp || !matchNotes || matchNotes.size === 0) return [];
    const oppMatchIds = new Set();
    for (const r of focusRows) {
      if (r.opponent_team === selectedOpp) oppMatchIds.add(r.match_id);
    }
    const rows = [];
    const seen = new Set();
    for (const [id, note] of matchNotes) {
      if (!oppMatchIds.has(id)) continue;
      if (note.match_type !== 'official') continue;
      if (!note.our_ban && !note.their_ban && !note.our_pick && !note.their_pick && !note.decider) continue;
      const dateKey = note.date_local || '';
      if (seen.has(dateKey)) continue;
      seen.add(dateKey);
      rows.push({
        match_id: id,
        date_local: note.date_local || '',
        roundLabel: note.round != null ? `R${note.round}` : '',
        coin_toss: note.coin_toss || null,
        our_ban: note.our_ban || null,
        their_ban: note.their_ban || null,
        our_pick: note.our_pick || null,
        their_pick: note.their_pick || null,
        decider: note.decider || null,
      });
    }
    return rows.sort((a, b) => a.date_local.localeCompare(b.date_local));
  }, [selectedOpp, matchNotes, focusRows]);

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

  const draftExportData = tableRows.map((r) => {
    const lu = ourLineupMapStats[r.map];
    return {
    map: r.map,
    wb_global_win_pct: r.global.winPct.toFixed(1),
    wb_global_record: `${r.global.wins}W-${r.global.losses}L`,
    ...(selectedOurLineup ? {
      our_lineup_win_pct: lu?.games >= 2 ? lu.winPct.toFixed(1) : '',
      our_lineup_record: lu?.games >= 2 ? `${lu.wins}W-${lu.losses}L` : '',
    } : {}),
    flags_ratio_h2h: r.h2h ? fmtRatio(r.h2h.flagsFor, r.h2h.flagsAgainst) : '',
    flags_ratio_global: fmtRatio(r.global.flagsFor || 0, r.global.flagsAgainst || 0),
    wb_vs_opp_win_pct: r.h2hWinPct !== null ? r.h2hWinPct.toFixed(1) : '',
    wb_vs_opp_record: r.h2h ? `${r.h2h.wins}W-${r.h2h.losses}L` : '',
    ...(effectiveTheirLineup ? { their_lineup_filter: effectiveTheirLineup } : {}),
    opp_global_win_pct: r.oppGlobal ? r.oppGlobal.winPct.toFixed(1) : '',
    opp_global_record: r.oppGlobal ? `${r.oppGlobal.wins}W-${r.oppGlobal.losses}L` : '',
    recommendation: recLabel(r.rec),
  };});

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page title */}
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--color-accent)' }}
        >
          Opponents
        </h2>
        <ExportButton data={matrixExportData} filename="wb_opponent_matrix.csv" />
      </div>

      {/* ── Opponent Matrix ─────────────────────────────────────── */}

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
                {matrixOpponents.map((opp) => (
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
                    {matrixOpponents.map((opp) => {
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
                          {cell.games < 3 && <span className="sample-warn" title={`Low sample size: only ${cell.games} game${cell.games !== 1 ? 's' : ''}. Patterns may not be reliable.`}>{'\u26A0'}</span>}
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

      {/* ── Draft Helper ────────────────────────────────────────── */}

      <div
        className="mt-10 mb-6 border-t pt-8"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-xl font-bold"
            style={{ color: 'var(--color-accent)' }}
          >
            Draft Helper
          </h3>
          {selectedOpp && (
            <ExportButton data={draftExportData} filename={`wb_draft_vs_${selectedOpp.toLowerCase().replace(/\s+/g, '_')}.csv`} />
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
              {draftOpponents.map((opp) => (
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
                value={effectiveTheirLineup}
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

        {/* No opponent selected */}
        {!selectedOpp && (
          <div
            className="rounded-lg p-4 text-sm"
            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
          >
            Select an opponent above for draft recommendations.
          </div>
        )}

        {/* Recommendation cards */}
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

        {/* H2H data note */}
        {selectedOpp && !hasH2H && (
          <div
            className="rounded-lg p-4 mb-6 text-sm"
            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
          >
            No head-to-head data vs {selectedOpp}{effectiveTheirLineup ? ' with this lineup filter' : ''}. Recommendations are based on global map strength.
          </div>
        )}
        {selectedOpp && hasH2H && effectiveTheirLineup && Object.values(h2hMapStats).reduce((s, m) => s + m.games, 0) < 2 && (
          <div
            className="rounded-lg p-4 mb-6 text-sm"
            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-draw, orange)' }}
          >
            Low sample: &lt;2 games for this opponent lineup filter. H2H data may not be reliable.
          </div>
        )}

        {/* Veto history from official matches */}
        {selectedOpp && vetoHistory.length > 0 && (
          <div
            className="rounded-lg p-4 mb-6"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <p
              className="text-xs uppercase tracking-wide mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Veto History vs {selectedOpp}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['Date', 'Round', 'Coin', 'Our Ban', 'Their Ban', 'Our Pick', 'Their Pick', 'Decider'].map((h) => (
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
                  {vetoHistory.map((v) => (
                    <tr key={v.match_id}>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>{v.date_local}</td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}>{v.roundLabel || '\u2014'}</td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: v.coin_toss === 'won' ? 'var(--color-win)' : v.coin_toss === 'lost' ? 'var(--color-loss)' : undefined }}>{v.coin_toss || '\u2014'}</td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-loss)' }}>{v.our_ban || '\u2014'}</td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-loss)' }}>{v.their_ban || '\u2014'}</td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-win)' }}>{v.our_pick || '\u2014'}</td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-win)' }}>{v.their_pick || '\u2014'}</td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}>{v.decider || '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Full map table */}
        {selectedOpp && (
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <p
              className="text-xs uppercase tracking-wide mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Map Breakdown vs {selectedOpp}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['Map', 'wB Global W%', ...(selectedOurLineup ? ['Our Lineup W%'] : []), 'F.Ratio', 'wB vs Opp W%', 'wB vs Opp Record', 'Opp Global W%', 'Opp Global Record', 'Rec'].map((h) => (
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
                        <td
                          className="py-1.5 border-b font-medium"
                          style={{
                            borderColor: 'var(--color-border)',
                            color: r.h2h
                              ? ratioColor(r.h2h.flagsFor, r.h2h.flagsAgainst)
                              : ratioColor(r.global.flagsFor || 0, r.global.flagsAgainst || 0),
                          }}
                        >
                          {r.h2h
                            ? fmtRatio(r.h2h.flagsFor, r.h2h.flagsAgainst)
                            : fmtRatio(r.global.flagsFor || 0, r.global.flagsAgainst || 0)}
                          {r.h2h && r.h2hGames < 3 && <span className="sample-warn" title={`Low sample size: only ${r.h2hGames} game${r.h2hGames !== 1 ? 's' : ''}. Patterns may not be reliable.`}>{'\u26A0'}</span>}
                        </td>
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
                          {r.h2hGames > 0 && r.h2hGames < 3 && <span className="sample-warn" title={`Low sample size: only ${r.h2hGames} game${r.h2hGames !== 1 ? 's' : ''}. Patterns may not be reliable.`}>{'\u26A0'}</span>}
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
                          {r.oppGlobal && r.oppGlobal.games < 3 && <span className="sample-warn" title={`Low sample size: only ${r.oppGlobal.games} game${r.oppGlobal.games !== 1 ? 's' : ''}. Patterns may not be reliable.`}>{'\u26A0'}</span>}
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
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
