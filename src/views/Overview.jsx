/**
 * Overview view — team identity card for the focus team (wAnnaBees).
 * Shows overall record, close games deep-dive, tempo identity, opponent breakdown.
 * Uses scopedLoose predicate by default.
 */

import { useState, useMemo } from 'react';
import ExportButton from '../components/ExportButton.jsx';
import InfoTip from '../components/InfoTip.jsx';
import { getStatColor } from '../utils/getStatColor.js';

export default function Overview({ data, onNavigateMatchLog, matchNotes }) {
  const { teamMatchRows } = data;

  // Focus team rows with loose qualification
  const focusRows = teamMatchRows.filter(
    (r) => r.team_name === 'wAnnaBees' && r.qualifies_loose
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--color-accent)' }}
        >
          wAnnaBees Overview
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label={<>Avg DPM <InfoTip text="Damage Per Minute. Measures combat output normalized by game length." /></>} value={avgDpm.toFixed(0)} />
          <Metric
            label="Avg Cap Diff"
            value={avgCapDiff >= 0 ? `+${avgCapDiff.toFixed(1)}` : avgCapDiff.toFixed(1)}
            color={avgCapDiff >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}
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
    if (!oppMap[opp]) oppMap[opp] = { games: 0, wins: 0, losses: 0 };
    oppMap[opp].games++;
    if (r.result === 'W') oppMap[opp].wins++;
    if (r.result === 'L') oppMap[opp].losses++;
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
            {['Opponent', 'G', 'W', 'L', 'Win%'].map((h) => (
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
                {o.games < 3 && <span className="sample-warn" title="Small sample size">{'\u26A0'}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
  );
}
