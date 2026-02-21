/**
 * Overview view — team identity card for the focus team (wAnnaBees).
 * Shows overall record, close games deep-dive, tempo identity, opponent breakdown.
 * Uses scopedLoose predicate by default.
 */

import { useState, useMemo } from 'react';
import ExportButton from '../components/ExportButton.jsx';
import InfoTip from '../components/InfoTip.jsx';
import { getStatColor } from '../utils/getStatColor.js';

function fmtRatio(flagsFor, flagsAgainst) {
  if (flagsFor === 0 && flagsAgainst === 0) return '\u2014';
  if (flagsAgainst === 0) return '\u221E';
  return (flagsFor / flagsAgainst).toFixed(2);
}

function ratioColor(flagsFor, flagsAgainst) {
  if (flagsAgainst === 0) return flagsFor > 0 ? 'var(--color-win)' : undefined;
  const ratio = flagsFor / flagsAgainst;
  if (ratio >= 1.0) return 'var(--color-win)';
  return 'var(--color-loss)';
}

export default function Overview({ data, onNavigateMatchLog, matchNotes, leagueConfig }) {
  const { teamMatchRows, focusTeam } = data;

  // Focus team rows with loose qualification
  const focusRows = useMemo(
    () => teamMatchRows.filter((r) => r.team_name === focusTeam && r.qualifies_loose),
    [teamMatchRows, focusTeam]
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

  // Global flags ratio
  const globalFlagsFor = focusRows.reduce((s, r) => s + r.score_for, 0);
  const globalFlagsAgainst = focusRows.reduce((s, r) => s + r.score_against, 0);

  // Close games: decided by ±1 cap
  const closeGames = focusRows.filter((r) => Math.abs(r.cap_diff) <= 1 && r.result !== 'D');
  const closeWins = closeGames.filter((r) => r.result === 'W');
  const closeLosses = closeGames.filter((r) => r.result === 'L');

  // Avg HHI
  const avgHhi = total > 0
    ? focusRows.reduce((s, r) => s + r.damage_hhi, 0) / total
    : 0;

  // Date range
  const dates = focusRows.map((r) => r.date_local).filter(Boolean).sort();
  const dateRange = dates.length > 0
    ? `${dates[0]} to ${dates[dates.length - 1]}`
    : 'N/A';

  // --- Close games deep-dive ---
  const avgNetDmgCloseW = closeWins.length > 0
    ? closeWins.reduce((s, r) => s + r.avg_net_damage * 4, 0) / closeWins.length : 0;
  const avgNetDmgCloseL = closeLosses.length > 0
    ? closeLosses.reduce((s, r) => s + r.avg_net_damage * 4, 0) / closeLosses.length : 0;
  const avgHhiCloseW = closeWins.length > 0
    ? closeWins.reduce((s, r) => s + r.damage_hhi, 0) / closeWins.length : 0;
  const avgHhiCloseL = closeLosses.length > 0
    ? closeLosses.reduce((s, r) => s + r.damage_hhi, 0) / closeLosses.length : 0;

  // Close games per map
  const closeByMap = {};
  for (const r of closeGames) {
    if (!closeByMap[r.map]) closeByMap[r.map] = { wins: 0, losses: 0 };
    if (r.result === 'W') closeByMap[r.map].wins++;
    if (r.result === 'L') closeByMap[r.map].losses++;
  }
  const closeMapRows = Object.entries(closeByMap)
    .map(([map, s]) => ({ map, ...s, total: s.wins + s.losses }))
    .sort((a, b) => b.total - a.total);

  // Close games per opponent
  const closeByOpp = {};
  for (const r of closeGames) {
    const opp = r.opponent_team || 'Unknown';
    if (!closeByOpp[opp]) closeByOpp[opp] = { wins: 0, losses: 0 };
    if (r.result === 'W') closeByOpp[opp].wins++;
    if (r.result === 'L') closeByOpp[opp].losses++;
  }
  const closeOppRows = Object.entries(closeByOpp)
    .map(([opp, s]) => ({ opp, ...s, total: s.wins + s.losses }))
    .sort((a, b) => b.total - a.total);

  // --- Tempo identity stats ---
  const avgDuration = total > 0
    ? focusRows.reduce((s, r) => s + r.duration_min, 0) / total : 0;
  const winRows = focusRows.filter((r) => r.result === 'W');
  const lossRows = focusRows.filter((r) => r.result === 'L');
  const avgDurWin = winRows.length > 0
    ? winRows.reduce((s, r) => s + r.duration_min, 0) / winRows.length : 0;
  const avgDurLoss = lossRows.length > 0
    ? lossRows.reduce((s, r) => s + r.duration_min, 0) / lossRows.length : 0;

  const blowoutWinRows = focusRows.filter((r) => r.result === 'W' && r.cap_diff >= 3);
  const blowoutLossRows = focusRows.filter((r) => r.result === 'L' && r.cap_diff <= -3);

  // Blowout maps
  const blowoutWinMaps = {};
  for (const r of blowoutWinRows) blowoutWinMaps[r.map] = (blowoutWinMaps[r.map] || 0) + 1;
  const blowoutLossMaps = {};
  for (const r of blowoutLossRows) blowoutLossMaps[r.map] = (blowoutLossMaps[r.map] || 0) + 1;

  // Score distribution
  const scoreDist = {};
  for (const r of focusRows) {
    const hi = Math.max(r.score_for, r.score_against);
    const lo = Math.min(r.score_for, r.score_against);
    const key = `${hi}-${lo}`;
    if (!scoreDist[key]) scoreDist[key] = { wins: 0, losses: 0, draws: 0 };
    if (r.result === 'W') scoreDist[key].wins++;
    else if (r.result === 'L') scoreDist[key].losses++;
    else scoreDist[key].draws++;
  }
  const scoreDistRows = Object.entries(scoreDist)
    .map(([score, s]) => ({ score, ...s, total: s.wins + s.losses + s.draws }))
    .sort((a, b) => b.total - a.total);

  // Season halves
  const sortedDates = [...dates];
  const midIdx = Math.floor(sortedDates.length / 2);
  const midDate = sortedDates[midIdx] || '';
  const firstHalf = focusRows.filter((r) => r.date_local < midDate);
  const secondHalf = focusRows.filter((r) => r.date_local >= midDate);
  const halfStats = (rows) => {
    const w = rows.filter((r) => r.result === 'W').length;
    const l = rows.filter((r) => r.result === 'L').length;
    const g = rows.length;
    return { games: g, wins: w, losses: l, winPct: g > 0 ? (w / g) * 100 : 0 };
  };
  const h1 = halfStats(firstHalf);
  const h2 = halfStats(secondHalf);

  // --- Formation breakdown from match notes ---
  const formationStats = useMemo(() => {
    if (!matchNotes || matchNotes.size === 0) return [];
    const formations = {};
    for (const r of focusRows) {
      const note = matchNotes.get(r.match_id);
      if (!note?.formation) continue;
      const f = note.formation;
      if (!formations[f]) formations[f] = { formation: f, games: 0, wins: 0, losses: 0 };
      formations[f].games++;
      if (r.result === 'W') formations[f].wins++;
      if (r.result === 'L') formations[f].losses++;
    }
    return Object.values(formations)
      .map((f) => ({ ...f, winPct: f.games > 0 ? (f.wins / f.games) * 100 : 0 }))
      .sort((a, b) => b.games - a.games);
  }, [focusRows, matchNotes]);

  const rotationStats = useMemo(() => {
    if (!matchNotes || matchNotes.size === 0) return [];
    const rotations = {};
    for (const r of focusRows) {
      const note = matchNotes.get(r.match_id);
      if (!note?.rotation_style) continue;
      const rs = note.rotation_style;
      if (!rotations[rs]) rotations[rs] = { style: rs, games: 0, wins: 0, losses: 0 };
      rotations[rs].games++;
      if (r.result === 'W') rotations[rs].wins++;
      if (r.result === 'L') rotations[rs].losses++;
    }
    return Object.values(rotations)
      .map((s) => ({ ...s, winPct: s.games > 0 ? (s.wins / s.games) * 100 : 0 }))
      .sort((a, b) => b.games - a.games);
  }, [focusRows, matchNotes]);

  const annotatedCount = formationStats.reduce((s, f) => s + f.games, 0)
    + rotationStats.reduce((s, r) => s + r.games, 0);

  // --- Series heuristic: group maps into series by opponent + date ---
  const seriesData = useMemo(() => {
    const seriesMap = {};
    for (const r of focusRows) {
      if (!r.opponent_team) continue;
      const key = `${r.opponent_team}::${r.date_local}`;
      if (!seriesMap[key]) seriesMap[key] = { opponent: r.opponent_team, date: r.date_local, maps: [] };
      seriesMap[key].maps.push(r);
    }

    const allSeries = Object.values(seriesMap).map((s) => {
      const mapsWon = s.maps.filter((m) => m.result === 'W').length;
      const mapsLost = s.maps.filter((m) => m.result === 'L').length;
      const mapCount = s.maps.length;
      const flagsFor = s.maps.reduce((sum, m) => sum + m.score_for, 0);
      const flagsAgainst = s.maps.reduce((sum, m) => sum + m.score_against, 0);
      let quality = 'OK';
      if (mapCount === 1) quality = 'WEAK';
      else if (mapCount > 3) quality = 'AMBIGUOUS';

      let outcome = `${mapsWon}-${mapsLost}`;
      if (quality === 'OK') {
        if (mapsWon >= 2 && mapsLost === 0) outcome = '2-0';
        else if (mapsWon >= 2 && mapsLost >= 1) outcome = '2-1';
        else if (mapsLost >= 2 && mapsWon <= 0) outcome = '0-2';
        else if (mapsLost >= 2 && mapsWon >= 1) outcome = '1-2';
      }

      return { ...s, mapsWon, mapsLost, mapCount, quality, outcome, flagsFor, flagsAgainst };
    });

    // Outcome counts (only OK quality)
    const okSeries = allSeries.filter((s) => s.quality === 'OK');
    const outcomes = { '2-0': 0, '2-1': 0, '1-2': 0, '0-2': 0 };
    for (const s of okSeries) {
      if (outcomes[s.outcome] !== undefined) outcomes[s.outcome]++;
    }
    const okTotal = okSeries.length;
    const weakCount = allSeries.filter((s) => s.quality === 'WEAK').length;
    const ambiguousCount = allSeries.filter((s) => s.quality === 'AMBIGUOUS').length;

    const totalMapsWon = allSeries.reduce((s, x) => s + x.mapsWon, 0);
    const totalMapsLost = allSeries.reduce((s, x) => s + x.mapsLost, 0);
    const seriesCount = allSeries.length;
    const avgMapsWon = seriesCount > 0 ? totalMapsWon / seriesCount : 0;
    const avgMapsLost = seriesCount > 0 ? totalMapsLost / seriesCount : 0;

    // Per-opponent series table
    const byOpp = {};
    for (const s of allSeries) {
      if (!byOpp[s.opponent]) {
        byOpp[s.opponent] = {
          opponent: s.opponent, series: 0, mapsWon: 0, mapsLost: 0,
          outcomes: { '2-0': 0, '2-1': 0, '1-2': 0, '0-2': 0 },
          okCount: 0, weakCount: 0, ambiguousCount: 0,
          flagsFor: 0, flagsAgainst: 0,
        };
      }
      const o = byOpp[s.opponent];
      o.series++;
      o.mapsWon += s.mapsWon;
      o.mapsLost += s.mapsLost;
      o.flagsFor += s.flagsFor;
      o.flagsAgainst += s.flagsAgainst;
      if (s.quality === 'OK' && o.outcomes[s.outcome] !== undefined) o.outcomes[s.outcome]++;
      if (s.quality === 'OK') o.okCount++;
      else if (s.quality === 'WEAK') o.weakCount++;
      else o.ambiguousCount++;
    }
    const oppSeriesRows = Object.values(byOpp)
      .map((o) => ({
        ...o,
        avgMapsWon: o.series > 0 ? o.mapsWon / o.series : 0,
        avgMapsLost: o.series > 0 ? o.mapsLost / o.series : 0,
      }))
      .sort((a, b) => b.series - a.series);

    return {
      allSeries, outcomes, okTotal, weakCount, ambiguousCount,
      seriesCount, avgMapsWon, avgMapsLost, oppSeriesRows,
    };
  }, [focusRows]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--color-accent)' }}
        >
          {focusTeam} Overview
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

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Metric label={<>Avg DPM <InfoTip text="Damage per minute. Measures combat output normalized by game length." /></>} value={avgDpm.toFixed(0)} />
          <Metric
            label="Avg Cap Diff"
            value={avgCapDiff >= 0 ? `+${avgCapDiff.toFixed(1)}` : avgCapDiff.toFixed(1)}
            color={avgCapDiff >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}
          />
          <Metric
            label={<>Flags Ratio <InfoTip text="Flags captured / flags conceded. Above 1.0 = capturing more than conceding. Used as a league tiebreaker." /></>}
            value={fmtRatio(globalFlagsFor, globalFlagsAgainst)}
            color={ratioColor(globalFlagsFor, globalFlagsAgainst)}
            subtitle={`${globalFlagsFor} for, ${globalFlagsAgainst} against`}
          />
          <Metric
            label={<>Close Games (±1) <InfoTip text="Match decided by ±1 cap difference." /></>}
            value={`${closeWins.length}W\u2013${closeLosses.length}L`}
            subtitle={`${closeGames.length} total`}
          />
          <Metric
            label={<>Dmg Concentration <InfoTip text="Damage concentration index. 0.25 = perfectly equal damage spread. Higher = one player doing most of the damage." /></>}
            value={avgHhi.toFixed(3)}
            subtitle="HHI (0.25 = equal)"
          />
        </div>
      </div>

      {/* Close Games Deep-Dive */}
      <CollapsibleCard
        title={<>Close Games Deep-Dive (±1 cap) <InfoTip text="Match decided by ±1 cap difference." /></>}
        right={
          <span
            className="stat-link text-xs"
            style={{ color: 'var(--color-accent)' }}
            onClick={(e) => { e.stopPropagation(); onNavigateMatchLog?.({ result: 'L', close: true }); }}
          >
            Review close losses &rarr;
          </span>
        }
        summary={`${closeWins.length}W\u2013${closeLosses.length}L`}
      >
        <CloseGamesAnalysis
          closeWinCount={closeWins.length}
          closeLossCount={closeLosses.length}
          avgNetDmgCloseW={avgNetDmgCloseW}
          avgNetDmgCloseL={avgNetDmgCloseL}
          avgHhiCloseW={avgHhiCloseW}
          avgHhiCloseL={avgHhiCloseL}
          closeMapRows={closeMapRows}
          closeOppRows={closeOppRows}
          onNavigateMatchLog={onNavigateMatchLog}
        />
      </CollapsibleCard>

      {/* Tempo Identity */}
      <CollapsibleCard
        title="Tempo Identity"
        summary={`${avgDuration.toFixed(0)}min avg \u00B7 ${blowoutWinRows.length}W\u2013${blowoutLossRows.length}L blowouts`}
      >
        <TempoIdentity
          avgDuration={avgDuration}
          avgDurWin={avgDurWin}
          avgDurLoss={avgDurLoss}
          blowoutWinRows={blowoutWinRows}
          blowoutLossRows={blowoutLossRows}
          blowoutWinMaps={blowoutWinMaps}
          blowoutLossMaps={blowoutLossMaps}
          scoreDistRows={scoreDistRows}
          h1={h1}
          h2={h2}
          midDate={midDate}
        />
      </CollapsibleCard>

      {/* Quick opponent breakdown */}
      <CollapsibleCard
        title="Record by Opponent"
        summary={`${new Set(focusRows.map((r) => r.opponent_team).filter(Boolean)).size} opponents`}
      >
        <OpponentBreakdown rows={focusRows} onNavigateMatchLog={onNavigateMatchLog} />
      </CollapsibleCard>

      {/* League Standings Metrics */}
      {seriesData.seriesCount > 0 && (
        <CollapsibleCard
          title={<>League Standings <InfoTip text="Series are detected by grouping matches on the same date vs the same opponent. This is a heuristic — not all groupings may represent actual BO3 series." /></>}
          summary={`${seriesData.seriesCount} series${leagueConfig ? ` \u00B7 ${leagueConfig.league_name}` : ''}`}
          right={
            <ExportButton
              data={seriesData.oppSeriesRows.map((o) => ({
                opponent: o.opponent,
                series: o.series,
                '2-0': o.outcomes['2-0'],
                '2-1': o.outcomes['2-1'],
                '1-2': o.outcomes['1-2'],
                '0-2': o.outcomes['0-2'],
                avg_maps_won: o.avgMapsWon.toFixed(2),
                avg_maps_lost: o.avgMapsLost.toFixed(2),
                flags_ratio: fmtRatio(o.flagsFor, o.flagsAgainst),
                ok: o.okCount,
                weak: o.weakCount,
                ambiguous: o.ambiguousCount,
              }))}
              filename="wb_series_by_opponent.csv"
            />
          }
        >
          {/* Series overview metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Avg Maps Won / Series</p>
              <p className="text-lg font-bold">{seriesData.avgMapsWon.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Avg Maps Lost / Series</p>
              <p className="text-lg font-bold">{seriesData.avgMapsLost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Series (OK quality)</p>
              <p className="text-lg font-bold">{seriesData.okTotal}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Quality Issues <InfoTip text="Weak = only 1 map found (possible incomplete data). Ambiguous = 4+ maps (may be multiple series merged)." />
              </p>
              <p className="text-sm font-bold">
                {seriesData.weakCount > 0 && <span style={{ color: 'var(--color-draw)' }}>{seriesData.weakCount} weak </span>}
                {seriesData.ambiguousCount > 0 && <span style={{ color: 'var(--color-loss)' }}>{seriesData.ambiguousCount} ambiguous</span>}
                {seriesData.weakCount === 0 && seriesData.ambiguousCount === 0 && <span style={{ color: 'var(--color-win)' }}>None</span>}
              </p>
            </div>
          </div>

          {/* Series outcome distribution (OK quality only) */}
          {seriesData.okTotal > 0 && (
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Series Outcomes (OK quality only)
              </p>
              <div className="grid grid-cols-4 gap-3">
                {['2-0', '2-1', '1-2', '0-2'].map((outcome) => {
                  const count = seriesData.outcomes[outcome];
                  const pct = seriesData.okTotal > 0 ? (count / seriesData.okTotal) * 100 : 0;
                  const isWin = outcome === '2-0' || outcome === '2-1';
                  return (
                    <div key={outcome} className="px-3 py-2 rounded text-center" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <p className="text-sm font-bold" style={{ color: isWin ? 'var(--color-win)' : 'var(--color-loss)' }}>
                        {outcome}
                      </p>
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{pct.toFixed(0)}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-opponent series table */}
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Series by Opponent
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Opponent', 'Series', '2-0', '2-1', '1-2', '0-2', 'Avg W', 'Avg L', 'Flags Ratio', 'Quality'].map((h) => (
                    <th
                      key={h}
                      className="text-left pb-2 border-b font-medium"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                    >
                      {h === 'Flags Ratio' ? <>{h} <InfoTip text="Flags captured / flags conceded across all maps in series vs this opponent." /></> : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seriesData.oppSeriesRows.map((o) => (
                  <tr key={o.opponent}>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>{o.opponent}</td>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>{o.series}</td>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: o.outcomes['2-0'] > 0 ? 'var(--color-win)' : undefined }}>{o.outcomes['2-0']}</td>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: o.outcomes['2-1'] > 0 ? 'var(--color-win)' : undefined }}>{o.outcomes['2-1']}</td>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: o.outcomes['1-2'] > 0 ? 'var(--color-loss)' : undefined }}>{o.outcomes['1-2']}</td>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: o.outcomes['0-2'] > 0 ? 'var(--color-loss)' : undefined }}>{o.outcomes['0-2']}</td>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>{o.avgMapsWon.toFixed(1)}</td>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>{o.avgMapsLost.toFixed(1)}</td>
                    <td className="py-1.5 border-b font-medium" style={{ borderColor: 'var(--color-border)', color: ratioColor(o.flagsFor, o.flagsAgainst) }}>
                      {fmtRatio(o.flagsFor, o.flagsAgainst)}
                    </td>
                    <td className="py-1.5 border-b text-xs" style={{ borderColor: 'var(--color-border)' }}>
                      {o.okCount > 0 && <span style={{ color: 'var(--color-win)' }}>{o.okCount} OK</span>}
                      {o.weakCount > 0 && <span className="ml-1" style={{ color: 'var(--color-draw)' }}>{o.weakCount} W</span>}
                      {o.ambiguousCount > 0 && <span className="ml-1" style={{ color: 'var(--color-loss)' }}>{o.ambiguousCount} A</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>
      )}

      {/* Formation breakdown (from annotated matches) */}
      {(formationStats.length > 0 || rotationStats.length > 0) && (
        <CollapsibleCard
          title={<>Formation Analysis <InfoTip text="Based on match notes with formation/rotation annotations. Small sample — patterns only." /></>}
          summary={`${annotatedCount} annotated`}
        >
          {formationStats.length > 0 && (
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
                By Formation
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {formationStats.map((f) => (
                  <div key={f.formation} className="px-3 py-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-accent)' }}>{f.formation}</p>
                    <p className="text-sm font-bold">
                      {f.wins}W{'\u2013'}{f.losses}L
                      <span className="ml-1" style={{ color: getStatColor(f.winPct, 'winPct') }}>
                        {f.winPct.toFixed(0)}%
                      </span>
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{f.games} games</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {rotationStats.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
                By Rotation Style
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {rotationStats.map((r) => (
                  <div key={r.style} className="px-3 py-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-accent)' }}>{r.style}</p>
                    <p className="text-sm font-bold">
                      {r.wins}W{'\u2013'}{r.losses}L
                      <span className="ml-1" style={{ color: getStatColor(r.winPct, 'winPct') }}>
                        {r.winPct.toFixed(0)}%
                      </span>
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{r.games} games</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CollapsibleCard>
      )}
    </div>
  );
}

function CloseGamesAnalysis({
  closeWinCount, closeLossCount,
  avgNetDmgCloseW, avgNetDmgCloseL,
  avgHhiCloseW, avgHhiCloseL,
  closeMapRows, closeOppRows,
  onNavigateMatchLog,
}) {
  if (closeWinCount + closeLossCount === 0) return null;

  return (
    <>
      {/* Comparison metrics: close wins vs close losses */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Net Dmg (close W)</p>
          <p className="text-lg font-bold" style={{ color: 'var(--color-win)' }}>
            {avgNetDmgCloseW >= 0 ? '+' : ''}{avgNetDmgCloseW.toFixed(0)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Net Dmg (close L)</p>
          <p className="text-lg font-bold" style={{ color: 'var(--color-loss)' }}>
            {avgNetDmgCloseL >= 0 ? '+' : ''}{avgNetDmgCloseL.toFixed(0)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>HHI (close W)</p>
          <p className="text-lg font-bold">{avgHhiCloseW.toFixed(3)}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>HHI (close L)</p>
          <p className="text-lg font-bold">{avgHhiCloseL.toFixed(3)}</p>
        </div>
      </div>

      {/* Per-map close game W-L */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {closeMapRows.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
              By Map
            </p>
            <div className="flex flex-wrap gap-2">
              {closeMapRows.map((m) => (
                <span key={m.map} className="text-sm px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>{m.map}</span>
                  {' '}
                  <span style={{ color: 'var(--color-win)' }}>{m.wins}W</span>
                  {'\u2013'}
                  {m.losses > 0 ? (
                    <span
                      className="stat-link"
                      style={{ color: 'var(--color-loss)' }}
                      onClick={() => onNavigateMatchLog?.({ map: m.map, result: 'L', close: true })}
                    >
                      {m.losses}L
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-loss)' }}>{m.losses}L</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
        {closeOppRows.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
              By Opponent
            </p>
            <div className="flex flex-wrap gap-2">
              {closeOppRows.map((o) => (
                <span key={o.opp} className="text-sm px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>{o.opp}</span>
                  {' '}
                  <span style={{ color: 'var(--color-win)' }}>{o.wins}W</span>
                  {'\u2013'}
                  <span style={{ color: 'var(--color-loss)' }}>{o.losses}L</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function TempoIdentity({
  avgDuration, avgDurWin, avgDurLoss,
  blowoutWinRows, blowoutLossRows,
  blowoutWinMaps, blowoutLossMaps,
  scoreDistRows, h1, h2, midDate,
}) {
  const topBlowoutWinMaps = Object.entries(blowoutWinMaps).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topBlowoutLossMaps = Object.entries(blowoutLossMaps).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <>
      {/* Duration + blowouts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Avg Duration</p>
          <p className="text-lg font-bold">{avgDuration.toFixed(1)} min</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Dur in Wins</p>
          <p className="text-lg font-bold" style={{ color: 'var(--color-win)' }}>{avgDurWin.toFixed(1)} min</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Dur in Losses</p>
          <p className="text-lg font-bold" style={{ color: 'var(--color-loss)' }}>{avgDurLoss.toFixed(1)} min</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Blowouts (3+)</p>
          <p className="text-lg font-bold">
            <span style={{ color: 'var(--color-win)' }}>{blowoutWinRows.length}W</span>
            {'\u2013'}
            <span style={{ color: 'var(--color-loss)' }}>{blowoutLossRows.length}L</span>
          </p>
        </div>
      </div>

      {/* Blowout maps */}
      {(topBlowoutWinMaps.length > 0 || topBlowoutLossMaps.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {topBlowoutWinMaps.length > 0 && (
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Blowout win maps</p>
              <p className="text-sm">
                {topBlowoutWinMaps.map(([m, c]) => `${m}(${c})`).join(', ')}
              </p>
            </div>
          )}
          {topBlowoutLossMaps.length > 0 && (
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Blowout loss maps</p>
              <p className="text-sm">
                {topBlowoutLossMaps.map(([m, c]) => `${m}(${c})`).join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Score distribution */}
      {scoreDistRows.length > 0 && (
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Score Distribution
          </p>
          <div className="flex flex-wrap gap-2">
            {scoreDistRows.map((s) => (
              <span key={s.score} className="text-sm px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{s.score}</span>
                {s.wins > 0 && <span style={{ color: 'var(--color-win)' }}> {s.wins}W</span>}
                {s.losses > 0 && <span style={{ color: 'var(--color-loss)' }}> {s.losses}L</span>}
                {s.draws > 0 && <span style={{ color: 'var(--color-draw)' }}> {s.draws}D</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Season halves trend */}
      {h1.games > 0 && h2.games > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Season Trend (split at {midDate})
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="px-3 py-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>First Half</p>
              <p className="text-sm font-bold">
                {h1.wins}W{'\u2013'}{h1.losses}L
                <span className="ml-1" style={{ color: h1.winPct >= 50 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                  ({h1.winPct.toFixed(0)}%)
                </span>
              </p>
            </div>
            <div className="px-3 py-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Second Half</p>
              <p className="text-sm font-bold">
                {h2.wins}W{'\u2013'}{h2.losses}L
                <span className="ml-1" style={{ color: h2.winPct >= 50 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                  ({h2.winPct.toFixed(0)}%)
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CollapsibleCard({ title, summary, right, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-lg mb-6 overflow-hidden"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer text-left"
        style={{ color: 'var(--color-text)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            {title}
          </span>
          {summary && (
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {summary}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {right}
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {open ? '\u25B2' : '\u25BC'}
          </span>
        </div>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
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
    if (!oppMap[opp]) oppMap[opp] = { games: 0, wins: 0, losses: 0, flagsFor: 0, flagsAgainst: 0 };
    oppMap[opp].games++;
    if (r.result === 'W') oppMap[opp].wins++;
    if (r.result === 'L') oppMap[opp].losses++;
    oppMap[opp].flagsFor += r.score_for;
    oppMap[opp].flagsAgainst += r.score_against;
  }

  const oppRows = Object.entries(oppMap)
    .map(([name, s]) => ({
      name,
      ...s,
      winPct: s.games > 0 ? (s.wins / s.games) * 100 : 0,
    }))
    .sort((a, b) => b.games - a.games);

  return (
    <table className="w-full text-sm">
        <thead>
          <tr>
            {['Opponent', 'G', 'W', 'L', 'Win%', 'Flags Ratio'].map((h) => (
              <th
                key={h}
                className="text-left pb-2 border-b font-medium"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                {h === 'Flags Ratio' ? <>{h} <InfoTip text="Flags captured / flags conceded vs this opponent." /></> : h}
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
                  color: getStatColor(o.winPct, 'winPct'),
                }}
              >
                {o.winPct.toFixed(0)}%
                {o.games < 3 && <span className="sample-warn" title={`Low sample size: only ${o.games} game${o.games !== 1 ? 's' : ''}. Patterns may not be reliable.`}>{'\u26A0'}</span>}
              </td>
              <td
                className="py-1.5 border-b font-medium"
                style={{
                  borderColor: 'var(--color-border)',
                  color: ratioColor(o.flagsFor, o.flagsAgainst),
                }}
              >
                {fmtRatio(o.flagsFor, o.flagsAgainst)}
                {o.games < 3 && <span className="sample-warn" title={`Low sample size: only ${o.games} game${o.games !== 1 ? 's' : ''}. Patterns may not be reliable.`}>{'\u26A0'}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
  );
}
