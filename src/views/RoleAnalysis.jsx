/**
 * Role Analysis view — cross-references manual roles with weapon profiles and performance.
 * Section 1: Role × Weapon Profile
 * Section 2: Player × Role Performance
 * Section 3: Role Rotation Impact
 */

import { useState, useMemo } from 'react';
import ExportButton from '../components/ExportButton.jsx';
import InfoTip from '../components/InfoTip.jsx';
import { getStatColor } from '../utils/getStatColor.js';

const FOCUS = 'wAnnaBees';

export default function RoleAnalysis({ data }) {
  const { playerRows, matches, teamMatchRows } = data;

  // Build matchMap for win/loss lookups
  const matchMap = useMemo(() => {
    const map = new Map();
    for (const m of matches) map.set(m.match_id, m);
    return map;
  }, [matches]);

  // Filter to rows with role data + focus team
  const enrichedRows = useMemo(() => {
    return playerRows.filter((r) => {
      if (!r.role_parsed) return false;
      // Focus team only — check via teamMatchRows membership
      const match = matchMap.get(r.match_id);
      if (!match) return false;
      const teamOnSide = r.side === 'red' ? match.team_red : match.team_blue;
      return teamOnSide === FOCUS;
    });
  }, [playerRows, matchMap]);

  // --- Section 1: Role × Weapon Profile ---
  const roleWeaponStats = useMemo(() => {
    const roles = {};
    for (const r of enrichedRows) {
      const role = r.role_parsed;
      if (!roles[role]) {
        roles[role] = {
          role, games: 0, totalRlShare: 0, totalRgShare: 0, totalSgShare: 0,
          totalLgShare: 0, totalPgShare: 0, totalDpm: 0, totalNetDmg: 0,
          totalKd: 0,
        };
      }
      const d = roles[role];
      d.games++;
      d.totalRlShare += r.rl_share;
      d.totalRgShare += r.rg_share;
      d.totalSgShare += r.sg_share;
      d.totalLgShare += r.lg_share;
      const pgShare = r.dmg_dealt > 0 ? r.pg / r.dmg_dealt : 0;
      d.totalPgShare += pgShare;
      d.totalDpm += r.dpm;
      d.totalNetDmg += r.net_damage;
      d.totalKd += r.kd_ratio;
    }
    return Object.values(roles)
      .map((d) => ({
        role: d.role,
        games: d.games,
        avgRl: d.games > 0 ? (d.totalRlShare / d.games) * 100 : 0,
        avgRg: d.games > 0 ? (d.totalRgShare / d.games) * 100 : 0,
        avgSg: d.games > 0 ? (d.totalSgShare / d.games) * 100 : 0,
        avgLg: d.games > 0 ? (d.totalLgShare / d.games) * 100 : 0,
        avgPg: d.games > 0 ? (d.totalPgShare / d.games) * 100 : 0,
        avgDpm: d.games > 0 ? d.totalDpm / d.games : 0,
        avgNetDmg: d.games > 0 ? d.totalNetDmg / d.games : 0,
        avgKd: d.games > 0 ? d.totalKd / d.games : 0,
      }))
      .sort((a, b) => b.games - a.games);
  }, [enrichedRows]);

  // Find max weapon% per column for color-coding
  const weaponMaxes = useMemo(() => {
    const keys = ['avgRl', 'avgRg', 'avgSg', 'avgLg', 'avgPg'];
    const maxes = {};
    for (const k of keys) {
      maxes[k] = Math.max(...roleWeaponStats.map((r) => r[k]), 0);
    }
    return maxes;
  }, [roleWeaponStats]);

  // --- Section 2: Player × Role Performance ---
  const playerRoleStats = useMemo(() => {
    // First, compute per-player overall averages
    const playerOverall = {};
    for (const r of enrichedRows) {
      if (!playerOverall[r.canonical]) {
        playerOverall[r.canonical] = { totalDpm: 0, totalKd: 0, wins: 0, games: 0 };
      }
      const o = playerOverall[r.canonical];
      o.games++;
      o.totalDpm += r.dpm;
      o.totalKd += r.kd_ratio;
      const res = rowResult(r, matchMap);
      if (res === 'W') o.wins++;
    }

    // Per player × role
    const combos = {};
    for (const r of enrichedRows) {
      const key = `${r.canonical}::${r.role_parsed}`;
      if (!combos[key]) {
        combos[key] = {
          player: r.canonical, role: r.role_parsed,
          games: 0, wins: 0, totalDpm: 0, totalNetDmg: 0, totalKd: 0,
        };
      }
      const c = combos[key];
      c.games++;
      const res = rowResult(r, matchMap);
      if (res === 'W') c.wins++;
      c.totalDpm += r.dpm;
      c.totalNetDmg += r.net_damage;
      c.totalKd += r.kd_ratio;
    }

    return Object.values(combos)
      .map((c) => {
        const avgDpm = c.games > 0 ? c.totalDpm / c.games : 0;
        const avgKd = c.games > 0 ? c.totalKd / c.games : 0;
        const winPct = c.games > 0 ? (c.wins / c.games) * 100 : 0;
        const overall = playerOverall[c.player];
        const overallDpm = overall && overall.games > 0 ? overall.totalDpm / overall.games : 0;
        const overallWinPct = overall && overall.games > 0 ? (overall.wins / overall.games) * 100 : 0;

        // Flag if DPM or win% drops significantly vs overall
        const dpmDrop = overallDpm > 0 ? ((avgDpm - overallDpm) / overallDpm) * 100 : 0;
        const winDrop = overallWinPct - winPct;

        return {
          player: c.player,
          role: c.role,
          games: c.games,
          winPct,
          avgDpm,
          avgNetDmg: c.games > 0 ? c.totalNetDmg / c.games : 0,
          avgKd,
          dpmFlag: dpmDrop < -15, // DPM drops >15%
          winFlag: winDrop > 20,  // Win% drops >20pp
          dpmDelta: dpmDrop,
          winDelta: -winDrop,
        };
      })
      .sort((a, b) => a.player.localeCompare(b.player) || b.games - a.games);
  }, [enrichedRows, matchMap]);

  // --- Section 3: Role Rotation Impact ---
  const rotationImpact = useMemo(() => {
    // Get match IDs that have at least one ROTATION player
    const rotationMatchIds = new Set();
    for (const r of enrichedRows) {
      if (r.role_parsed === 'ROTATION') rotationMatchIds.add(r.match_id);
    }

    // Get all focus team match rows for matches that have role data
    const roleMatchIds = new Set(enrichedRows.map((r) => r.match_id));
    const focusTeamRows = teamMatchRows.filter(
      (r) => r.team_name === FOCUS && roleMatchIds.has(r.match_id)
    );

    const withRotation = focusTeamRows.filter((r) => rotationMatchIds.has(r.match_id));
    const withoutRotation = focusTeamRows.filter((r) => !rotationMatchIds.has(r.match_id));

    function summarize(rows) {
      const games = rows.length;
      const wins = rows.filter((r) => r.result === 'W').length;
      const losses = rows.filter((r) => r.result === 'L').length;
      const totalCapDiff = rows.reduce((s, r) => s + r.cap_diff, 0);
      const totalHhi = rows.reduce((s, r) => s + r.damage_hhi, 0);
      return {
        games,
        wins,
        losses,
        winPct: games > 0 ? (wins / games) * 100 : 0,
        avgCapDiff: games > 0 ? totalCapDiff / games : 0,
        avgHhi: games > 0 ? totalHhi / games : 0,
      };
    }

    return {
      withRotation: summarize(withRotation),
      withoutRotation: summarize(withoutRotation),
    };
  }, [enrichedRows, teamMatchRows]);

  // --- Section 4: Role × Map Breakdown ---
  const roleMapStats = useMemo(() => {
    const combos = {};
    for (const r of enrichedRows) {
      const role = r.role_parsed;
      const map = matchMap.get(r.match_id)?.map;
      if (!map) continue;
      const key = `${role}::${map}`;
      if (!combos[key]) {
        combos[key] = {
          role, map, games: 0, wins: 0,
          totalDpm: 0, totalNetDmg: 0,
          totalRl: 0, totalRg: 0, totalSg: 0, totalLg: 0, totalPg: 0,
        };
      }
      const c = combos[key];
      c.games++;
      const res = rowResult(r, matchMap);
      if (res === 'W') c.wins++;
      c.totalDpm += r.dpm;
      c.totalNetDmg += r.net_damage;
      c.totalRl += r.rl_share;
      c.totalRg += r.rg_share;
      c.totalSg += r.sg_share;
      c.totalLg += r.lg_share;
      c.totalPg += r.dmg_dealt > 0 ? r.pg / r.dmg_dealt : 0;
    }
    // Group by role
    const byRole = {};
    for (const c of Object.values(combos)) {
      if (!byRole[c.role]) byRole[c.role] = [];
      byRole[c.role].push({
        map: c.map,
        games: c.games,
        winPct: c.games > 0 ? (c.wins / c.games) * 100 : 0,
        avgDpm: c.games > 0 ? c.totalDpm / c.games : 0,
        avgNetDmg: c.games > 0 ? c.totalNetDmg / c.games : 0,
        avgRl: c.games > 0 ? (c.totalRl / c.games) * 100 : 0,
        avgRg: c.games > 0 ? (c.totalRg / c.games) * 100 : 0,
        avgSg: c.games > 0 ? (c.totalSg / c.games) * 100 : 0,
        avgLg: c.games > 0 ? (c.totalLg / c.games) * 100 : 0,
        avgPg: c.games > 0 ? (c.totalPg / c.games) * 100 : 0,
      });
    }
    // Sort each role's maps by games
    for (const role of Object.keys(byRole)) {
      byRole[role].sort((a, b) => b.games - a.games);
    }
    return byRole;
  }, [enrichedRows, matchMap]);

  // --- Section 5: Role Swap Impact ---
  const roleSwapStats = useMemo(() => {
    // For each player-map combo, find their most common role (primary)
    const playerMapRoles = {};
    for (const r of enrichedRows) {
      const match = matchMap.get(r.match_id);
      if (!match) continue;
      const key = `${r.canonical}::${match.map}`;
      if (!playerMapRoles[key]) playerMapRoles[key] = {};
      const role = r.role_parsed;
      playerMapRoles[key][role] = (playerMapRoles[key][role] || 0) + 1;
    }

    // Determine primary role per player-map
    const primaryRole = {};
    for (const [key, roles] of Object.entries(playerMapRoles)) {
      const sorted = Object.entries(roles).sort((a, b) => b[1] - a[1]);
      primaryRole[key] = sorted[0][0];
    }

    // Now compute swap impact: primary vs non-primary on each map
    const swapMap = {};
    for (const r of enrichedRows) {
      const match = matchMap.get(r.match_id);
      if (!match) continue;
      const pmKey = `${r.canonical}::${match.map}`;
      const primary = primaryRole[pmKey];
      const isPrimary = r.role_parsed === primary;
      const res = rowResult(r, matchMap);
      const sKey = `${r.canonical}::${match.map}`;

      if (!swapMap[sKey]) {
        swapMap[sKey] = {
          player: r.canonical, map: match.map, primaryRole: primary,
          primaryGames: 0, primaryWins: 0,
          swapGames: 0, swapWins: 0,
        };
      }
      const s = swapMap[sKey];
      if (isPrimary) {
        s.primaryGames++;
        if (res === 'W') s.primaryWins++;
      } else {
        s.swapGames++;
        if (res === 'W') s.swapWins++;
      }
    }

    return Object.values(swapMap)
      .filter((s) => s.swapGames >= 1 && s.primaryGames >= 2) // need enough data
      .map((s) => ({
        ...s,
        primaryWinPct: s.primaryGames > 0 ? (s.primaryWins / s.primaryGames) * 100 : 0,
        swapWinPct: s.swapGames > 0 ? (s.swapWins / s.swapGames) * 100 : 0,
      }))
      .sort((a, b) => a.player.localeCompare(b.player) || b.primaryGames - a.primaryGames);
  }, [enrichedRows, matchMap]);

  // --- Export ---
  const exportData = [
    ...roleWeaponStats.map((r) => ({
      section: 'role_weapon',
      role: r.role, games: r.games,
      avg_rl_pct: r.avgRl.toFixed(1), avg_rg_pct: r.avgRg.toFixed(1),
      avg_sg_pct: r.avgSg.toFixed(1), avg_lg_pct: r.avgLg.toFixed(1),
      avg_pg_pct: r.avgPg.toFixed(1),
      avg_dpm: r.avgDpm.toFixed(0), avg_net_dmg: r.avgNetDmg.toFixed(0),
      avg_kd: r.avgKd.toFixed(2),
    })),
    ...playerRoleStats.map((c) => ({
      section: 'player_role',
      player: c.player, role: c.role, games: c.games,
      win_pct: c.winPct.toFixed(1), avg_dpm: c.avgDpm.toFixed(0),
      avg_net_dmg: c.avgNetDmg.toFixed(0), avg_kd: c.avgKd.toFixed(2),
    })),
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>
          Role Analysis
        </h2>
        <ExportButton data={exportData} filename="wb_role_analysis.csv" />
      </div>

      <p className="text-sm mb-6 px-3 py-2 rounded" style={{
        backgroundColor: 'rgba(255, 215, 0, 0.08)',
        color: 'var(--color-accent)',
        border: '1px solid rgba(255, 215, 0, 0.2)',
      }}>
        Small sample ({enrichedRows.length} enriched rows) — patterns only, not conclusions. Game counts shown on everything.
      </p>

      {/* Section 1: Role × Weapon Profile */}
      <Section title="Role \u00D7 Weapon Profile">
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Does def correlate with higher RG%? Does off correlate with higher RL%?
          Dominant weapon% per role highlighted.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr>
              {['Role', 'G', 'RL%', 'RG%', 'SG%', 'LG%', 'PG%', 'DPM', 'Net Dmg', 'K/D'].map((h) => (
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
            {roleWeaponStats.map((r) => (
              <tr key={r.role}>
                <td className="py-1.5 border-b font-semibold" style={{ borderColor: 'var(--color-border)' }}>
                  {r.role}
                </td>
                <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  {r.games}
                </td>
                <WeaponCell value={r.avgRl} max={weaponMaxes.avgRl} />
                <WeaponCell value={r.avgRg} max={weaponMaxes.avgRg} />
                <WeaponCell value={r.avgSg} max={weaponMaxes.avgSg} />
                <WeaponCell value={r.avgLg} max={weaponMaxes.avgLg} />
                <WeaponCell value={r.avgPg} max={weaponMaxes.avgPg} />
                <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: getStatColor(r.avgDpm, 'dpm') }}>
                  {r.avgDpm.toFixed(0)}
                </td>
                <td
                  className="py-1.5 border-b"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: getStatColor(r.avgNetDmg, 'netDmg'),
                  }}
                >
                  {r.avgNetDmg >= 0 ? '+' : ''}{r.avgNetDmg.toFixed(0)}
                </td>
                <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: getStatColor(r.avgKd, 'kd') }}>
                  {r.avgKd.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Section 2: Player × Role Performance */}
      <Section title="Player \u00D7 Role Performance">
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
          How each wB player performs per role. Flagged cells indicate DPM drops &gt;15% or win% drops &gt;20pp vs their overall average.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr>
              {['Player', 'Role', 'G', 'Win%', 'DPM', 'Net Dmg', 'K/D'].map((h) => (
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
            {playerRoleStats.map((c) => (
              <tr key={`${c.player}::${c.role}`}>
                <td className="py-1.5 border-b font-semibold" style={{ borderColor: 'var(--color-border)' }}>
                  {c.player}
                </td>
                <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  {c.role}
                </td>
                <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  {c.games}
                </td>
                <td
                  className="py-1.5 border-b font-semibold"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: c.winFlag ? 'var(--color-loss)' : getStatColor(c.winPct, 'winPct'),
                  }}
                >
                  {c.winPct.toFixed(0)}%
                  {c.winFlag && (
                    <span className="ml-1 text-[10px]" title={`${c.winDelta.toFixed(0)}pp vs overall`}>
                      {'\u26A0'}
                    </span>
                  )}
                </td>
                <td
                  className="py-1.5 border-b"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: c.dpmFlag ? 'var(--color-loss)' : undefined,
                  }}
                >
                  {c.avgDpm.toFixed(0)}
                  {c.dpmFlag && (
                    <span className="ml-1 text-[10px]" title={`${c.dpmDelta.toFixed(0)}% vs overall`}>
                      {'\u26A0'}
                    </span>
                  )}
                </td>
                <td
                  className="py-1.5 border-b"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: getStatColor(c.avgNetDmg, 'netDmg'),
                  }}
                >
                  {c.avgNetDmg >= 0 ? '+' : ''}{c.avgNetDmg.toFixed(0)}
                </td>
                <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: getStatColor(c.avgKd, 'kd') }}>
                  {c.avgKd.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Section 3: Role Rotation Impact */}
      <Section title="Role Rotation Impact">
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Comparing games with mid-game role switching (ROTATION tag) vs fixed roles.
          Does rotation help or hurt?
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr>
              {['', 'Games', 'W-L', 'Win%', 'Avg Cap Diff', 'Avg HHI'].map((h) => (
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
            <RotationRow label="With Rotation" data={rotationImpact.withRotation} />
            <RotationRow label="Without Rotation" data={rotationImpact.withoutRotation} />
          </tbody>
        </table>
      </Section>

      {/* Section 4: Role × Map Breakdown */}
      <Section title={<>Role \u00D7 Map Breakdown <InfoTip text="Per-map stats for each role. Expand a role to see map-level performance and weapon splits." /></>}>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
          How each role performs on different maps. Click a role to expand per-map details.
        </p>
        {Object.keys(roleMapStats).length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No per-map role data available.</p>
        ) : (
          <RoleMapTable roleMapStats={roleMapStats} roleWeaponStats={roleWeaponStats} />
        )}
      </Section>

      {/* Section 5: Role Swap Impact */}
      {roleSwapStats.length > 0 && (
        <Section title={<>Role Swap Impact <InfoTip text="Compares win% when a player plays their primary (most common) role on a map vs a different role. Shows the effect of role swaps." /></>}>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Win% comparison: primary role vs non-primary role per player per map.
            Requires at least 2 games in primary role and 1 game in swapped role.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Player', 'Map', 'Primary Role', 'Primary Win%', 'Swap Win%', 'Delta'].map((h) => (
                  <th key={h} className="text-left pb-2 border-b font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roleSwapStats.map((s) => {
                const delta = s.swapWinPct - s.primaryWinPct;
                return (
                  <tr key={`${s.player}::${s.map}`}>
                    <td className="py-1.5 border-b font-semibold" style={{ borderColor: 'var(--color-border)' }}>{s.player}</td>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>{s.map}</td>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>{s.primaryRole} ({s.primaryGames}g)</td>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: getStatColor(s.primaryWinPct, 'winPct') }}>
                      {s.primaryWinPct.toFixed(0)}%
                    </td>
                    <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: getStatColor(s.swapWinPct, 'winPct') }}>
                      {s.swapWinPct.toFixed(0)}% ({s.swapGames}g)
                      {s.swapGames < 3 && (
                        <span className="ml-1 text-[10px] px-1 py-px rounded" style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)', color: 'rgb(249, 115, 22)' }}
                          title="Low sample">{'\u26A0'}</span>
                      )}
                    </td>
                    <td className="py-1.5 border-b font-semibold" style={{
                      borderColor: 'var(--color-border)',
                      color: delta > 10 ? 'var(--color-win)' : delta < -10 ? 'var(--color-loss)' : undefined,
                    }}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(0)}pp
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div
      className="rounded-lg p-4 mb-6"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <p
        className="text-xs uppercase tracking-wide mb-3 font-semibold"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function WeaponCell({ value, max }) {
  const isMax = max > 0 && Math.abs(value - max) < 0.5;
  return (
    <td
      className="py-1.5 border-b font-semibold"
      style={{
        borderColor: 'var(--color-border)',
        color: isMax ? 'var(--color-accent)' : undefined,
        backgroundColor: isMax ? 'rgba(255, 215, 0, 0.08)' : undefined,
      }}
    >
      {value.toFixed(1)}
    </td>
  );
}

function rowResult(row, matchMap) {
  const match = matchMap.get(row.match_id);
  if (!match) return null;
  if (match.winner_side === 'draw') return 'D';
  return row.side === match.winner_side ? 'W' : 'L';
}

function RoleMapTable({ roleMapStats, roleWeaponStats }) {
  const [expandedRole, setExpandedRole] = useState(null);
  const roles = roleWeaponStats.map((r) => r.role);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          {['Role', 'Maps Played', 'Total G'].map((h) => (
            <th key={h} className="text-left pb-2 border-b font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {roles.map((role) => {
          const maps = roleMapStats[role] || [];
          const totalGames = maps.reduce((s, m) => s + m.games, 0);
          const isExpanded = expandedRole === role;
          return (
            <RoleMapRow
              key={role}
              role={role}
              maps={maps}
              totalGames={totalGames}
              isExpanded={isExpanded}
              onToggle={() => setExpandedRole(isExpanded ? null : role)}
            />
          );
        })}
      </tbody>
    </table>
  );
}

function RoleMapRow({ role, maps, totalGames, isExpanded, onToggle }) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer" style={{ backgroundColor: isExpanded ? 'var(--color-surface-hover)' : undefined }}>
        <td className="py-1.5 border-b font-semibold" style={{ borderColor: 'var(--color-border)' }}>
          {role} {isExpanded ? '\u25B2' : '\u25BC'}
        </td>
        <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {maps.length}
        </td>
        <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {totalGames}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={3} style={{ backgroundColor: 'var(--color-bg)' }}>
            <div className="px-4 py-2">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {['Map', 'G', 'Win%', 'DPM', 'Net Dmg', 'RL%', 'RG%', 'SG%', 'LG%', 'PG%'].map((h) => (
                      <th key={h} className="text-left pb-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {maps.map((m) => (
                    <tr key={m.map}>
                      <td className="py-0.5">
                        {m.map}
                        {m.games < 3 && (
                          <span className="ml-1 text-[10px] px-1 py-px rounded"
                            style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)', color: 'rgb(249, 115, 22)' }}
                            title="Low sample">{'\u26A0'}</span>
                        )}
                      </td>
                      <td className="py-0.5">{m.games}</td>
                      <td className="py-0.5" style={{ color: getStatColor(m.winPct, 'winPct') }}>{m.winPct.toFixed(0)}%</td>
                      <td className="py-0.5" style={{ color: getStatColor(m.avgDpm, 'dpm') }}>{m.avgDpm.toFixed(0)}</td>
                      <td className="py-0.5" style={{ color: getStatColor(m.avgNetDmg, 'netDmg') }}>
                        {m.avgNetDmg >= 0 ? '+' : ''}{m.avgNetDmg.toFixed(0)}
                      </td>
                      <td className="py-0.5">{m.avgRl.toFixed(0)}</td>
                      <td className="py-0.5">{m.avgRg.toFixed(0)}</td>
                      <td className="py-0.5">{m.avgSg.toFixed(0)}</td>
                      <td className="py-0.5">{m.avgLg.toFixed(0)}</td>
                      <td className="py-0.5">{m.avgPg.toFixed(0)}</td>
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

function RotationRow({ label, data }) {
  return (
    <tr>
      <td className="py-1.5 border-b font-semibold" style={{ borderColor: 'var(--color-border)' }}>
        {label}
      </td>
      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {data.games}
      </td>
      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {data.wins}-{data.losses}
      </td>
      <td
        className="py-1.5 border-b font-semibold"
        style={{
          borderColor: 'var(--color-border)',
          color: getStatColor(data.winPct, 'winPct'),
        }}
      >
        {data.games > 0 ? `${data.winPct.toFixed(0)}%` : '\u2014'}
      </td>
      <td
        className="py-1.5 border-b"
        style={{
          borderColor: 'var(--color-border)',
          color: getStatColor(data.avgCapDiff, 'capDiff'),
        }}
      >
        {data.games > 0 ? `${data.avgCapDiff >= 0 ? '+' : ''}${data.avgCapDiff.toFixed(1)}` : '\u2014'}
      </td>
      <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {data.games > 0 ? data.avgHhi.toFixed(3) : '\u2014'}
      </td>
    </tr>
  );
}
