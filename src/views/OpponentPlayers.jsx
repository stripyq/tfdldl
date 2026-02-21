/**
 * Opponent Players view — per-enemy-player stats from matches against wAnnaBees.
 * Shows: individual stats, carry index, weapon splits, per-map breakdown.
 */

import { useState, useMemo } from 'react';
import ExportButton from '../components/ExportButton.jsx';
import InfoTip from '../components/InfoTip.jsx';
import { getStatColor } from '../utils/getStatColor.js';

const FOCUS = 'wAnnaBees';

export default function OpponentPlayers({ data, officialOnly, onNavigateMatchLog, initialOpponent }) {
  const { teamMatchRows, playerRows } = data;

  // All wB matches (loose)
  const wbRows = useMemo(() => {
    return teamMatchRows.filter((r) => r.team_name === FOCUS && r.qualifies_loose && (!officialOnly || r.match_type === 'official'));
  }, [teamMatchRows, officialOnly]);

  // Group playerRows by match_id for fast lookup
  const playersByMatch = useMemo(() => {
    const m = new Map();
    for (const p of playerRows) {
      if (!m.has(p.match_id)) m.set(p.match_id, []);
      m.get(p.match_id).push(p);
    }
    return m;
  }, [playerRows]);

  // Build per-opponent-player stats from wB matches
  const { oppTeamData, allTeams } = useMemo(() => {
    const players = {};

    for (const wbRow of wbRows) {
      const matchPlayers = playersByMatch.get(wbRow.match_id) || [];
      const oppSide = wbRow.side === 'red' ? 'blue' : 'red';
      const oppPlayers = matchPlayers.filter((p) => p.side === oppSide);
      const oppTeam = wbRow.opponent_team;
      if (!oppTeam || oppTeam === 'MIX') continue;

      const teamDmg = oppPlayers.reduce((s, p) => s + p.dmg_dealt, 0);
      const oppResult = wbRow.result === 'W' ? 'L' : wbRow.result === 'L' ? 'W' : 'D';
      const isClose = Math.abs(wbRow.cap_diff) <= 1 && wbRow.result !== 'D';
      const isBlowout = Math.abs(wbRow.cap_diff) >= 3;

      for (const p of oppPlayers) {
        const key = `${oppTeam}::${p.canonical}`;
        const share = teamDmg > 0 ? p.dmg_dealt / teamDmg : 0;

        if (!players[key]) {
          players[key] = {
            team: oppTeam, player: p.canonical,
            games: 0, wins: 0, losses: 0,
            totalDpm: 0, totalNetDmg: 0, totalKd: 0, totalShare: 0,
            totalRl: 0, totalRg: 0, totalSg: 0, totalLg: 0, totalPg: 0,
            closeWins: 0, closeLosses: 0, blowoutGames: 0,
            maps: {},
          };
        }
        const d = players[key];
        d.games++;
        if (oppResult === 'W') d.wins++;
        if (oppResult === 'L') d.losses++;
        d.totalDpm += p.dpm;
        d.totalNetDmg += p.net_damage;
        d.totalKd += p.kd_ratio;
        d.totalShare += share;
        d.totalRl += p.rl_share;
        d.totalRg += p.rg_share;
        d.totalSg += p.sg_share;
        d.totalLg += p.lg_share;
        d.totalPg += p.dmg_dealt > 0 ? p.pg / p.dmg_dealt : 0;

        if (isClose) {
          if (oppResult === 'W') d.closeWins++;
          if (oppResult === 'L') d.closeLosses++;
        }
        if (isBlowout) d.blowoutGames++;

        if (!d.maps[wbRow.map]) d.maps[wbRow.map] = { games: 0, wins: 0, losses: 0, totalDpm: 0, totalNetDmg: 0 };
        const mm = d.maps[wbRow.map];
        mm.games++;
        if (oppResult === 'W') mm.wins++;
        if (oppResult === 'L') mm.losses++;
        mm.totalDpm += p.dpm;
        mm.totalNetDmg += p.net_damage;
      }
    }

    // Finalize player stats
    const finalPlayers = Object.values(players).map((d) => {
      const avgShare = d.games > 0 ? (d.totalShare / d.games) * 100 : 0;
      return {
        team: d.team, player: d.player,
        games: d.games, wins: d.wins, losses: d.losses,
        winPct: d.games > 0 ? (d.wins / d.games) * 100 : 0,
        avgDpm: d.games > 0 ? d.totalDpm / d.games : 0,
        avgNetDmg: d.games > 0 ? d.totalNetDmg / d.games : 0,
        avgKd: d.games > 0 ? d.totalKd / d.games : 0,
        avgShare,
        carryIndex: avgShare - 25,
        avgRl: d.games > 0 ? (d.totalRl / d.games) * 100 : 0,
        avgRg: d.games > 0 ? (d.totalRg / d.games) * 100 : 0,
        avgSg: d.games > 0 ? (d.totalSg / d.games) * 100 : 0,
        avgLg: d.games > 0 ? (d.totalLg / d.games) * 100 : 0,
        avgPg: d.games > 0 ? (d.totalPg / d.games) * 100 : 0,
        closeWins: d.closeWins, closeLosses: d.closeLosses,
        closeGames: d.closeWins + d.closeLosses,
        blowoutRate: d.games > 0 ? (d.blowoutGames / d.games) * 100 : 0,
        maps: Object.entries(d.maps)
          .map(([map, m]) => ({
            map, games: m.games, wins: m.wins, losses: m.losses,
            winPct: m.games > 0 ? (m.wins / m.games) * 100 : 0,
            avgDpm: m.games > 0 ? m.totalDpm / m.games : 0,
            avgNetDmg: m.games > 0 ? m.totalNetDmg / m.games : 0,
          }))
          .sort((a, b) => b.games - a.games),
      };
    });

    // Group by team
    const byTeam = {};
    for (const p of finalPlayers) {
      if (!byTeam[p.team]) byTeam[p.team] = { team: p.team, players: [], totalGames: 0 };
      byTeam[p.team].players.push(p);
    }

    // Team-level assessments
    for (const ts of Object.values(byTeam)) {
      ts.players.sort((a, b) => b.games - a.games);
      const matchIds = new Set();
      for (const r of wbRows) {
        if (r.opponent_team === ts.team) matchIds.add(r.match_id);
      }
      ts.totalGames = matchIds.size;

      const core = ts.players.filter((p) => p.games >= 3);
      if (core.length >= 2) {
        const maxCarry = Math.max(...core.map((p) => p.carryIndex));
        const minCarry = Math.min(...core.map((p) => p.carryIndex));
        ts.structure = (maxCarry - minCarry) > 8 ? 'carry-dependent' : 'balanced';
        ts.highCarry = core.reduce((best, p) => p.carryIndex > best.carryIndex ? p : best);
      } else {
        ts.structure = 'unknown';
        ts.highCarry = null;
      }
    }

    const allTeams = Object.keys(byTeam).sort();
    return { oppTeamData: byTeam, allTeams };
  }, [wbRows, playersByMatch]);

  const [selectedTeam, setSelectedTeam] = useState(initialOpponent?.opponent || '');
  const team = selectedTeam || allTeams[0] || '';
  const teamData = oppTeamData[team];

  const [sortCol, setSortCol] = useState('games');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  const sortedPlayers = useMemo(() => {
    const teamPlayers = teamData?.players || [];
    const keyMap = {
      player: 'player', games: 'games', winPct: 'winPct',
      avgDpm: 'avgDpm', avgNetDmg: 'avgNetDmg', avgKd: 'avgKd',
      avgShare: 'avgShare', carryIndex: 'carryIndex',
    };
    const key = keyMap[sortCol] || 'games';
    return [...teamPlayers].sort((a, b) => {
      const va = a[key] ?? '';
      const vb = b[key] ?? '';
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });
  }, [teamData, sortCol, sortAsc]);

  function handleSort(col) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  }

  const exportData = sortedPlayers.map((p) => ({
    team: p.team, player: p.player, games: p.games,
    wins: p.wins, losses: p.losses, win_pct: p.winPct.toFixed(1),
    avg_dpm: p.avgDpm.toFixed(0), avg_net_dmg: p.avgNetDmg.toFixed(0),
    avg_kd: p.avgKd.toFixed(2), dmg_share_pct: p.avgShare.toFixed(1),
    carry_index: p.carryIndex.toFixed(1),
    rl_pct: p.avgRl.toFixed(1), rg_pct: p.avgRg.toFixed(1),
    sg_pct: p.avgSg.toFixed(1), lg_pct: p.avgLg.toFixed(1), pg_pct: p.avgPg.toFixed(1),
    close_w: p.closeWins, close_l: p.closeLosses,
    blowout_rate: p.blowoutRate.toFixed(0),
  }));

  const columns = [
    { key: 'player', label: 'Player' },
    { key: 'games', label: 'G' },
    { key: 'winPct', label: <>W-L (Win%) <InfoTip text="Record and win% against wB from this player's perspective." /></> },
    { key: 'avgDpm', label: 'DPM' },
    { key: 'avgNetDmg', label: 'Net Dmg' },
    { key: 'avgKd', label: 'K/D' },
    { key: 'avgShare', label: <>Dmg% <InfoTip text="Average share of team's total damage. 25% = equal contribution." /></> },
    { key: 'carryIndex', label: <>Carry <InfoTip text="Carry Index = player's avg damage share minus 25% (equal share). Positive = carry, negative = below team average." /></> },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>
          Opponent Players
        </h2>
        <ExportButton data={exportData} filename={`opp_players_${team.toLowerCase().replace(/\s+/g, '_')}.csv`} />
      </div>

      {/* Team selector */}
      <div className="mb-6">
        <label className="text-xs block mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Opponent Team
        </label>
        <select
          value={team}
          onChange={(e) => { setSelectedTeam(e.target.value); setExpandedPlayer(null); }}
          className="px-3 py-1.5 rounded text-sm cursor-pointer"
          style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
        >
          {allTeams.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {!teamData ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No opponent data available.</p>
      ) : (
        <>
          {/* Team structure badge */}
          <div
            className="rounded-lg p-4 mb-6"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="flex items-center gap-6 flex-wrap">
              <Stat label="Games vs wB" value={teamData.totalGames} />
              <Stat label="Players Used" value={teamData.players.length} />
              <Stat
                label={<>Structure <InfoTip text="Based on Carry Index spread among core players (3+ games). Carry-dependent = high variance in damage share." /></>}
                value={teamData.structure === 'carry-dependent' ? 'Carry-dependent' : teamData.structure === 'balanced' ? 'Balanced' : '\u2014'}
                color={teamData.structure === 'carry-dependent' ? 'var(--color-draw)' : teamData.structure === 'balanced' ? 'var(--color-win)' : undefined}
              />
              {teamData.highCarry && (
                <Stat
                  label="Top Carry"
                  value={`${teamData.highCarry.player} (+${teamData.highCarry.carryIndex.toFixed(1)}pp)`}
                  color="var(--color-accent)"
                />
              )}
            </div>
          </div>

          {/* Player stats table */}
          <div
            className="rounded-lg p-4 mb-6 overflow-x-auto"
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
                  <th className="text-left pb-2 border-b font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                    Weapons
                  </th>
                  <th className="text-left pb-2 border-b font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                    Close
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((p) => {
                  const isExpanded = expandedPlayer === p.player;
                  return (
                    <PlayerRow
                      key={p.player}
                      p={p}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedPlayer(isExpanded ? null : p.player)}
                      onNavigateMatchLog={onNavigateMatchLog}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function PlayerRow({ p, isExpanded, onToggle, onNavigateMatchLog }) {
  const lowSample = p.games < 5;

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer"
        style={{ backgroundColor: isExpanded ? 'var(--color-surface-hover)' : undefined }}
      >
        <td className="py-1.5 border-b font-semibold" style={{ borderColor: 'var(--color-border)' }}>
          {p.player}
          {lowSample && <SampleBadge games={p.games} />}
        </td>
        <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {p.games}
        </td>
        <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: getStatColor(p.winPct, 'winPct', true) }}>
          {p.wins}-{p.losses} ({p.winPct.toFixed(0)}%)
        </td>
        <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: getStatColor(p.avgDpm, 'dpm') }}>
          {p.avgDpm.toFixed(0)}
        </td>
        <td className="py-1.5 border-b" style={{
          borderColor: 'var(--color-border)',
          color: p.avgNetDmg > 0 ? 'var(--color-win)' : p.avgNetDmg < 0 ? 'var(--color-loss)' : undefined,
        }}>
          {p.avgNetDmg >= 0 ? '+' : ''}{p.avgNetDmg.toFixed(0)}
        </td>
        <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)', color: getStatColor(p.avgKd, 'kd') }}>
          {p.avgKd.toFixed(2)}
        </td>
        <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {p.avgShare.toFixed(1)}%
        </td>
        <td className="py-1.5 border-b font-semibold" style={{
          borderColor: 'var(--color-border)',
          color: p.carryIndex > 3 ? 'var(--color-accent)' : p.carryIndex < -3 ? 'var(--color-text-muted)' : undefined,
        }}>
          {p.carryIndex >= 0 ? '+' : ''}{p.carryIndex.toFixed(1)}
          {p.carryIndex > 5 && <span className="ml-1 text-[10px]" title="High carry dependency — this player does a disproportionate share of team damage">{'\u26A0'}</span>}
        </td>
        <td className="py-1.5 border-b text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          RL {p.avgRl.toFixed(0)} RG {p.avgRg.toFixed(0)} SG {p.avgSg.toFixed(0)} LG {p.avgLg.toFixed(0)}
        </td>
        <td className="py-1.5 border-b text-xs" style={{ borderColor: 'var(--color-border)' }}>
          {p.closeGames > 0 ? (
            <span>
              <span style={{ color: 'var(--color-win)' }}>{p.closeWins}W</span>
              {'\u2013'}
              <span style={{ color: 'var(--color-loss)' }}>{p.closeLosses}L</span>
            </span>
          ) : '\u2014'}
          {p.blowoutRate > 50 && (
            <span className="ml-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }} title={`${p.blowoutRate.toFixed(0)}% of games are blowouts (3+ cap diff)`}>
              {p.blowoutRate.toFixed(0)}% bo
            </span>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={10} style={{ backgroundColor: 'var(--color-bg)' }}>
            <div className="px-4 py-3">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Per-Map Breakdown
              </p>
              {p.maps.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No per-map data.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {['Map', 'G', 'W-L', 'Win%', 'DPM', 'Net Dmg'].map((h) => (
                        <th key={h} className="text-left pb-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.maps.map((m) => (
                      <tr key={m.map}>
                        <td className="py-0.5">
                          {m.map}
                          {m.games < 3 && <SampleBadge games={m.games} />}
                        </td>
                        <td className="py-0.5">
                          <span
                            className="stat-link"
                            onClick={(e) => { e.stopPropagation(); onNavigateMatchLog?.({ map: m.map, opponent: p.team }); }}
                          >
                            {m.games}
                          </span>
                        </td>
                        <td className="py-0.5">{m.wins}-{m.losses}</td>
                        <td className="py-0.5" style={{ color: getStatColor(m.winPct, 'winPct', true) }}>
                          {m.winPct.toFixed(0)}%
                        </td>
                        <td className="py-0.5" style={{ color: getStatColor(m.avgDpm, 'dpm') }}>{m.avgDpm.toFixed(0)}</td>
                        <td className="py-0.5" style={{
                          color: m.avgNetDmg > 0 ? 'var(--color-win)' : m.avgNetDmg < 0 ? 'var(--color-loss)' : undefined,
                        }}>
                          {m.avgNetDmg >= 0 ? '+' : ''}{m.avgNetDmg.toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Weapon profile detail */}
              <p className="text-xs uppercase tracking-wide mt-3 mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Weapon Profile
              </p>
              <div className="flex gap-3 text-xs">
                <WeaponBar label="RL" pct={p.avgRl} color="#e06c45" />
                <WeaponBar label="RG" pct={p.avgRg} color="#45e06c" />
                <WeaponBar label="SG" pct={p.avgSg} color="#e0c845" />
                <WeaponBar label="LG" pct={p.avgLg} color="#45b8e0" />
                <WeaponBar label="PG" pct={p.avgPg} color="#b845e0" />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function WeaponBar({ label, pct, color }) {
  return (
    <div className="flex items-center gap-1">
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <div className="w-16 h-2 rounded overflow-hidden" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
        <div className="h-full rounded" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
      <span style={{ color }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function SampleBadge({ games }) {
  return (
    <span
      className="ml-1.5 text-[10px] px-1 py-px rounded"
      style={{
        backgroundColor: 'rgba(249, 115, 22, 0.15)',
        color: 'rgb(249, 115, 22)',
      }}
      title={`Low sample size: only ${games} game${games !== 1 ? 's' : ''}. Patterns may not be reliable.`}
    >
      {'\u26A0'} {games}g
    </span>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p className="text-lg font-bold mt-0.5" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}
