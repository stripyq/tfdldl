/**
 * Close Game Decomposition view — standalone analysis of ±1 cap differential matches.
 * Shows: conversion gap headline, avg stats comparison, per-map/lineup/opponent breakdowns.
 */

import { useMemo } from 'react';
import ExportButton from '../components/ExportButton.jsx';
import InfoTip from '../components/InfoTip.jsx';
import { getStatColor } from '../utils/getStatColor.js';

export default function CloseGames({ data, officialOnly, onNavigateMatchLog }) {
  const { teamMatchRows, focusTeam } = data;

  // All focus team matches (loose)
  const focusRows = useMemo(() => {
    return teamMatchRows.filter((r) => r.team_name === focusTeam && r.qualifies_loose && (!officialOnly || r.match_type === 'official'));
  }, [teamMatchRows, focusTeam, officialOnly]);

  // Close games: ±1 cap, excluding draws
  const closeGames = useMemo(() => {
    return focusRows.filter((r) => Math.abs(r.cap_diff) <= 1 && r.result !== 'D');
  }, [focusRows]);

  const closeWins = useMemo(() => closeGames.filter((r) => r.result === 'W'), [closeGames]);
  const closeLosses = useMemo(() => closeGames.filter((r) => r.result === 'L'), [closeGames]);

  // --- Headline stats ---
  const stats = useMemo(() => {
    function avgOf(rows, fn) {
      if (rows.length === 0) return 0;
      return rows.reduce((s, r) => s + fn(r), 0) / rows.length;
    }

    // * 4: avg_net_damage is per-player average, multiply by 4 for team total in 4v4
    const avgNetDmgW = avgOf(closeWins, (r) => r.avg_net_damage * 4);
    const avgNetDmgL = avgOf(closeLosses, (r) => r.avg_net_damage * 4);
    const durWinRows = closeWins.filter((r) => r.duration_min != null);
    const durLossRows = closeLosses.filter((r) => r.duration_min != null);
    const avgDurW = avgOf(durWinRows, (r) => r.duration_min);
    const avgDurL = avgOf(durLossRows, (r) => r.duration_min);
    const avgHhiW = avgOf(closeWins, (r) => r.damage_hhi);
    const avgHhiL = avgOf(closeLosses, (r) => r.damage_hhi);
    const conversionGap = avgNetDmgL - avgNetDmgW;

    return { avgNetDmgW, avgNetDmgL, avgDurW, avgDurL, avgHhiW, avgHhiL, conversionGap };
  }, [closeWins, closeLosses]);

  // --- Per-map breakdown ---
  const mapRows = useMemo(() => {
    const maps = {};
    for (const r of closeGames) {
      if (!maps[r.map]) maps[r.map] = { map: r.map, wins: 0, losses: 0, totalNetDmgW: 0, totalNetDmgL: 0, wCount: 0, lCount: 0 };
      const m = maps[r.map];
      if (r.result === 'W') {
        m.wins++;
        m.totalNetDmgW += r.avg_net_damage * 4;
        m.wCount++;
      } else {
        m.losses++;
        m.totalNetDmgL += r.avg_net_damage * 4;
        m.lCount++;
      }
    }
    return Object.values(maps)
      .map((m) => {
        const avgNetDmgW = m.wCount > 0 ? m.totalNetDmgW / m.wCount : 0;
        const avgNetDmgL = m.lCount > 0 ? m.totalNetDmgL / m.lCount : 0;
        return {
          map: m.map,
          wins: m.wins, losses: m.losses,
          total: m.wins + m.losses,
          winPct: (m.wins + m.losses) > 0 ? (m.wins / (m.wins + m.losses)) * 100 : 0,
          conversionGap: (m.wCount > 0 && m.lCount > 0) ? avgNetDmgL - avgNetDmgW : null,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [closeGames]);

  // --- Per-lineup breakdown ---
  const lineupRows = useMemo(() => {
    const lineups = {};
    for (const r of closeGames) {
      const key = r.lineup_key;
      if (!lineups[key]) lineups[key] = { key, players: r.player_names, wins: 0, losses: 0 };
      if (r.result === 'W') lineups[key].wins++;
      if (r.result === 'L') lineups[key].losses++;
    }
    return Object.values(lineups)
      .map((l) => ({
        ...l,
        total: l.wins + l.losses,
        winPct: (l.wins + l.losses) > 0 ? (l.wins / (l.wins + l.losses)) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [closeGames]);

  // --- Per-opponent breakdown ---
  const oppRows = useMemo(() => {
    const opps = {};
    for (const r of closeGames) {
      const opp = r.opponent_team || 'Unknown';
      if (!opps[opp]) opps[opp] = { opp, wins: 0, losses: 0 };
      if (r.result === 'W') opps[opp].wins++;
      if (r.result === 'L') opps[opp].losses++;
    }
    return Object.values(opps)
      .map((o) => ({
        ...o,
        total: o.wins + o.losses,
        winPct: (o.wins + o.losses) > 0 ? (o.wins / (o.wins + o.losses)) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [closeGames]);

  // --- Export ---
  const exportData = [
    ...mapRows.map((m) => ({
      section: 'map', map: m.map,
      close_wins: m.wins, close_losses: m.losses, close_win_pct: m.winPct.toFixed(1),
      conversion_gap: m.conversionGap !== null ? m.conversionGap.toFixed(0) : '',
    })),
    ...lineupRows.map((l) => ({
      section: 'lineup', lineup: l.players.join(' + '),
      close_wins: l.wins, close_losses: l.losses, close_win_pct: l.winPct.toFixed(1),
    })),
    ...oppRows.map((o) => ({
      section: 'opponent', opponent: o.opp,
      close_wins: o.wins, close_losses: o.losses, close_win_pct: o.winPct.toFixed(1),
    })),
  ];

  const total = closeGames.length;
  const totalWins = closeWins.length;
  const totalLosses = closeLosses.length;
  const overallWinPct = total > 0 ? (totalWins / total) * 100 : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>
          Close Game Decomposition
        </h2>
        <ExportButton data={exportData} filename="wb_close_games.csv" />
      </div>

      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Close games: &plusmn;1 cap differential (excludes draws) &middot; Loose dataset &middot; {total} games
      </p>

      {total === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No close games in the dataset.</p>
      ) : (
        <>
          {/* Headline: Record + Conversion Gap */}
          <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: 'var(--color-surface)' }}>
            <div className="flex items-baseline gap-4 mb-4">
              <span className="text-3xl font-bold">
                {totalWins}W{'\u2013'}{totalLosses}L
              </span>
              <span
                className="text-xl font-semibold"
                style={{ color: getStatColor(overallWinPct, 'winPct') }}
              >
                {overallWinPct.toFixed(0)}%
              </span>
              <span
                className="stat-link text-xs"
                style={{ color: 'var(--color-accent)' }}
                onClick={() => onNavigateMatchLog?.({ close: true })}
              >
                View all close games &rarr;
              </span>
            </div>

            {/* Conversion Gap headline */}
            <div className="rounded p-4 mb-4" style={{ backgroundColor: 'var(--color-bg)' }}>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                  Conversion Gap
                </p>
                <InfoTip text="Positive means you're winning fights but losing caps. This suggests a rotation/conversion problem, not a firepower problem." />
              </div>
              <p className="text-3xl font-bold" style={{
                color: stats.conversionGap > 50 ? 'var(--color-draw)' : stats.conversionGap < -50 ? 'var(--color-loss)' : undefined,
              }}>
                {stats.conversionGap >= 0 ? '+' : ''}{stats.conversionGap.toFixed(0)}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Team net damage difference: close losses vs close wins
              </p>
            </div>

            {/* Comparison grid: Close Wins vs Close Losses */}
            <div className="grid grid-cols-3 gap-4">
              <div />
              <p className="text-xs uppercase tracking-wide font-medium text-center" style={{ color: 'var(--color-win)' }}>
                Close Wins ({totalWins})
              </p>
              <p className="text-xs uppercase tracking-wide font-medium text-center" style={{ color: 'var(--color-loss)' }}>
                Close Losses ({totalLosses})
              </p>

              <p className="text-xs py-2" style={{ color: 'var(--color-text-muted)' }}>
                Team Net Damage <InfoTip text="Sum of all 4 players' net damage per match, averaged across matches." />
              </p>
              <p className="text-lg font-bold text-center py-2" style={{ color: 'var(--color-win)' }}>
                {stats.avgNetDmgW >= 0 ? '+' : ''}{stats.avgNetDmgW.toFixed(0)}
              </p>
              <p className="text-lg font-bold text-center py-2" style={{ color: 'var(--color-loss)' }}>
                {stats.avgNetDmgL >= 0 ? '+' : ''}{stats.avgNetDmgL.toFixed(0)}
              </p>

              <p className="text-xs py-2" style={{ color: 'var(--color-text-muted)' }}>Avg Duration</p>
              <p className="text-lg font-bold text-center py-2">{stats.avgDurW.toFixed(1)} min</p>
              <p className="text-lg font-bold text-center py-2">{stats.avgDurL.toFixed(1)} min</p>

              <p className="text-xs py-2" style={{ color: 'var(--color-text-muted)' }}>
                Avg HHI <InfoTip text="Damage concentration. 0.25 = equal spread. Higher = one player doing most damage." />
              </p>
              <p className="text-lg font-bold text-center py-2">{stats.avgHhiW.toFixed(3)}</p>
              <p className="text-lg font-bold text-center py-2">{stats.avgHhiL.toFixed(3)}</p>
            </div>
          </div>

          {/* Per-Map */}
          <Section title="Close Game Record by Map">
            {mapRows.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No data.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['Map', 'G', 'W-L', 'Win%', 'Conv. Gap'].map((h) => (
                      <th key={h} className="text-left pb-2 border-b font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                        {h === 'Conv. Gap' ? <>{h} <InfoTip text="Conversion Gap per map. Positive = out-damaging but losing." /></> : h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mapRows.map((m) => (
                    <tr key={m.map}>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        {m.map}
                        {m.total < 3 && <SampleBadge />}
                      </td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <span
                          className="stat-link"
                          onClick={() => onNavigateMatchLog?.({ map: m.map, close: true })}
                        >
                          {m.total}
                        </span>
                      </td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
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
                      </td>
                      <td className="py-1.5 border-b font-semibold" style={{ borderColor: 'var(--color-border)', color: getStatColor(m.winPct, 'winPct') }}>
                        {m.winPct.toFixed(0)}%
                      </td>
                      <td className="py-1.5 border-b" style={{
                        borderColor: 'var(--color-border)',
                        color: m.conversionGap !== null
                          ? (m.conversionGap > 50 ? 'var(--color-draw)' : m.conversionGap < -50 ? 'var(--color-loss)' : undefined)
                          : 'var(--color-text-muted)',
                      }}>
                        {m.conversionGap !== null
                          ? `${m.conversionGap >= 0 ? '+' : ''}${m.conversionGap.toFixed(0)}`
                          : '\u2014'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Per-Lineup */}
          <Section title="Close Game Record by Lineup">
            {lineupRows.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No data.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['Lineup', 'G', 'W-L', 'Win%'].map((h) => (
                      <th key={h} className="text-left pb-2 border-b font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineupRows.map((l) => (
                    <tr key={l.key}>
                      <td className="py-1.5 border-b text-xs" style={{ borderColor: 'var(--color-border)' }}>
                        {l.players.join(' \u00B7 ')}
                      </td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <span
                          className="stat-link"
                          onClick={() => onNavigateMatchLog?.({ lineup: l.key, close: true })}
                        >
                          {l.total}
                        </span>
                      </td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <span style={{ color: 'var(--color-win)' }}>{l.wins}W</span>
                        {'\u2013'}
                        <span style={{ color: 'var(--color-loss)' }}>{l.losses}L</span>
                      </td>
                      <td className="py-1.5 border-b font-semibold" style={{ borderColor: 'var(--color-border)', color: getStatColor(l.winPct, 'winPct') }}>
                        {l.winPct.toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Per-Opponent */}
          <Section title="Close Game Record by Opponent">
            {oppRows.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No data.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['Opponent', 'G', 'W-L', 'Win%'].map((h) => (
                      <th key={h} className="text-left pb-2 border-b font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {oppRows.map((o) => (
                    <tr key={o.opp}>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        {o.opp}
                      </td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <span
                          className="stat-link"
                          onClick={() => onNavigateMatchLog?.({ opponent: o.opp, close: true })}
                        >
                          {o.total}
                        </span>
                      </td>
                      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <span style={{ color: 'var(--color-win)' }}>{o.wins}W</span>
                        {'\u2013'}
                        <span style={{ color: 'var(--color-loss)' }}>{o.losses}L</span>
                      </td>
                      <td className="py-1.5 border-b font-semibold" style={{ borderColor: 'var(--color-border)', color: getStatColor(o.winPct, 'winPct') }}>
                        {o.winPct.toFixed(0)}%
                        {o.total < 3 && <SampleBadge />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: 'var(--color-surface)' }}>
      <p className="text-xs uppercase tracking-wide mb-3 font-semibold" style={{ color: 'var(--color-text-muted)' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function SampleBadge() {
  return (
    <span
      className="ml-1.5 text-[10px] px-1 py-px rounded"
      style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)', color: 'rgb(249, 115, 22)' }}
      title="Low sample size"
    >
      {'\u26A0'} Low sample
    </span>
  );
}
