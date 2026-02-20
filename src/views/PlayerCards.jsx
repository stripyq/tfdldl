/**
 * PlayerCards view — per-player stats, weapon profile, per-map breakdown.
 * Compare mode for side-by-side comparison of two players.
 */

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ExportButton from '../components/ExportButton.jsx';

const FOCUS = 'wAnnaBees';
const WEAPON_COLORS = {
  RL: '#e06c45',
  RG: '#45e06c',
  SG: '#e0c845',
  LG: '#45b8e0',
  PG: '#b845e0',
  Other: '#888888',
};

export default function PlayerCards({ data }) {
  const { playerRows, teamMatchRows, matches } = data;

  // Build match lookup
  const matchMap = useMemo(() => {
    const m = new Map();
    for (const match of matches) m.set(match.match_id, match);
    return m;
  }, [matches]);

  // Get all wB players in loose-qualifying matches
  const wbPlayers = useMemo(() => {
    const focusRows = teamMatchRows.filter(
      (r) => r.team_name === FOCUS && r.qualifies_loose
    );
    const matchIds = new Set(focusRows.map((r) => r.match_id));
    const focusSides = new Map();
    for (const r of focusRows) focusSides.set(r.match_id, r.side);

    const playerGames = {};
    for (const p of playerRows) {
      if (!matchIds.has(p.match_id)) continue;
      if (p.side !== focusSides.get(p.match_id)) continue;
      if (p.team_membership !== FOCUS) continue;
      playerGames[p.canonical] = (playerGames[p.canonical] || 0) + 1;
    }

    return Object.entries(playerGames)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [playerRows, teamMatchRows]);

  const [selectedA, setSelectedA] = useState('');
  const [selectedB, setSelectedB] = useState('');
  const [compareMode, setCompareMode] = useState(false);

  // Auto-select first player
  const playerA = selectedA || wbPlayers[0] || '';
  const playerB = selectedB || wbPlayers[1] || '';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--color-accent)' }}
        >
          Player Cards
        </h2>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
          <input
            type="checkbox"
            checked={compareMode}
            onChange={(e) => setCompareMode(e.target.checked)}
          />
          Compare
        </label>
      </div>

      <div className="flex gap-4 mb-6">
        <PlayerSelect
          label={compareMode ? 'Player A' : 'Player'}
          players={wbPlayers}
          value={playerA}
          onChange={setSelectedA}
        />
        {compareMode && (
          <PlayerSelect
            label="Player B"
            players={wbPlayers}
            value={playerB}
            onChange={setSelectedB}
          />
        )}
      </div>

      <div className={compareMode ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}>
        <PlayerCard
          name={playerA}
          playerRows={playerRows}
          teamMatchRows={teamMatchRows}
          matchMap={matchMap}
        />
        {compareMode && (
          <PlayerCard
            name={playerB}
            playerRows={playerRows}
            teamMatchRows={teamMatchRows}
            matchMap={matchMap}
          />
        )}
      </div>
    </div>
  );
}

function PlayerSelect({ label, players, value, onChange }) {
  return (
    <div>
      <label className="text-xs block mb-1" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1.5 rounded text-sm cursor-pointer"
        style={{
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
        }}
      >
        {players.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </div>
  );
}

function PlayerCard({ name, playerRows, teamMatchRows, matchMap }) {
  const stats = useMemo(() => {
    if (!name) return null;

    // Get focus team's loose-qualifying match IDs and sides
    const focusRows = teamMatchRows.filter(
      (r) => r.team_name === FOCUS && r.qualifies_loose
    );
    const matchIds = new Set(focusRows.map((r) => r.match_id));
    const focusSides = new Map();
    for (const r of focusRows) focusSides.set(r.match_id, r.side);

    // This player's rows in those matches, on the focus team's side
    const rows = playerRows.filter(
      (p) =>
        p.canonical === name &&
        matchIds.has(p.match_id) &&
        p.side === focusSides.get(p.match_id)
    );

    if (rows.length === 0) return null;

    const games = rows.length;
    let wins = 0;
    let losses = 0;
    let totalFrags = 0;
    let totalDeaths = 0;
    let totalDpm = 0;
    let totalNetDmg = 0;
    let totalCaps = 0;
    let totalDefends = 0;
    // Weapon damage totals
    let totalRl = 0, totalRg = 0, totalSg = 0, totalLg = 0, totalPg = 0, totalDmg = 0;

    // Per-map breakdown
    const mapData = {};

    for (const p of rows) {
      const match = matchMap.get(p.match_id);
      if (!match) continue;

      const isWin = (p.side === match.winner_side);
      const isLoss = (match.winner_side !== 'draw' && p.side !== match.winner_side);
      if (isWin) wins++;
      if (isLoss) losses++;

      totalFrags += p.frags;
      totalDeaths += p.deaths;
      totalDpm += p.dpm;
      totalNetDmg += p.net_damage;
      totalCaps += p.caps;
      totalDefends += p.defends;

      totalRl += p.rl;
      totalRg += p.rg;
      totalSg += p.sg;
      totalLg += p.lg;
      totalPg += p.pg;
      totalDmg += p.dmg_dealt;

      const map = match.map;
      if (!mapData[map]) mapData[map] = { games: 0, wins: 0, losses: 0, dpm: 0, frags: 0, deaths: 0 };
      mapData[map].games++;
      if (isWin) mapData[map].wins++;
      if (isLoss) mapData[map].losses++;
      mapData[map].dpm += p.dpm;
      mapData[map].frags += p.frags;
      mapData[map].deaths += p.deaths;
    }

    const otherDmg = totalDmg - totalRl - totalRg - totalSg - totalLg - totalPg;

    const weaponProfile = totalDmg > 0 ? [
      { weapon: 'RL', pct: (totalRl / totalDmg) * 100 },
      { weapon: 'RG', pct: (totalRg / totalDmg) * 100 },
      { weapon: 'SG', pct: (totalSg / totalDmg) * 100 },
      { weapon: 'LG', pct: (totalLg / totalDmg) * 100 },
      { weapon: 'PG', pct: (totalPg / totalDmg) * 100 },
      { weapon: 'Other', pct: (otherDmg / totalDmg) * 100 },
    ] : [];

    const mapBreakdown = Object.entries(mapData)
      .map(([map, d]) => ({
        map,
        games: d.games,
        wins: d.wins,
        losses: d.losses,
        winPct: d.games > 0 ? (d.wins / d.games) * 100 : 0,
        avgDpm: d.games > 0 ? d.dpm / d.games : 0,
        avgKd: d.deaths > 0 ? d.frags / d.deaths : d.frags,
      }))
      .sort((a, b) => b.games - a.games);

    return {
      games,
      wins,
      losses,
      draws: games - wins - losses,
      winPct: (wins / games) * 100,
      avgFrags: totalFrags / games,
      avgDeaths: totalDeaths / games,
      kd: totalDeaths > 0 ? totalFrags / totalDeaths : totalFrags,
      avgDpm: totalDpm / games,
      avgNetDmg: totalNetDmg / games,
      avgCaps: totalCaps / games,
      avgDefends: totalDefends / games,
      weaponProfile,
      mapBreakdown,
    };
  }, [name, playerRows, teamMatchRows, matchMap]);

  const exportData = stats ? stats.mapBreakdown.map((m) => ({
    player: name,
    map: m.map,
    games: m.games,
    wins: m.wins,
    losses: m.losses,
    win_pct: m.winPct.toFixed(1),
    avg_dpm: m.avgDpm.toFixed(0),
    avg_kd: m.avgKd.toFixed(2),
  })) : [];

  if (!stats) {
    return (
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>No data for {name}</p>
      </div>
    );
  }

  // Stacked bar chart data (single bar)
  const weaponBarData = stats.weaponProfile.length > 0
    ? [stats.weaponProfile.reduce((acc, w) => { acc[w.weapon] = w.pct; return acc; }, { name: name })]
    : [];

  return (
    <div>
      {/* Header + export */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">{name}</h3>
        <ExportButton data={exportData} filename={`wb_player_${name.toLowerCase()}.csv`} />
      </div>

      {/* Stat grid */}
      <div
        className="rounded-lg p-4 mb-4"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Stat label="Games" value={stats.games} />
          <Stat
            label="Record"
            value={`${stats.wins}W\u2013${stats.losses}L`}
          />
          <Stat
            label="Win%"
            value={`${stats.winPct.toFixed(0)}%`}
            color={stats.winPct > 55 ? 'var(--color-win)' : stats.winPct < 45 ? 'var(--color-loss)' : undefined}
          />
          <Stat label="K/D" value={stats.kd.toFixed(2)} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Avg Frags" value={stats.avgFrags.toFixed(1)} />
          <Stat label="Avg Deaths" value={stats.avgDeaths.toFixed(1)} />
          <Stat label="DPM" value={stats.avgDpm.toFixed(0)} />
          <Stat
            label="Net Dmg"
            value={stats.avgNetDmg >= 0 ? `+${stats.avgNetDmg.toFixed(0)}` : stats.avgNetDmg.toFixed(0)}
            color={stats.avgNetDmg > 0 ? 'var(--color-win)' : stats.avgNetDmg < 0 ? 'var(--color-loss)' : undefined}
          />
        </div>
      </div>

      {/* Weapon profile */}
      {weaponBarData.length > 0 && (
        <div
          className="rounded-lg p-4 mb-4"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <p
            className="text-xs uppercase tracking-wide mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Weapon Profile (% of damage)
          </p>
          <ResponsiveContainer width="100%" height={40}>
            <BarChart data={weaponBarData} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis type="category" dataKey="name" hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  color: 'var(--color-text)',
                }}
                formatter={(v) => `${v.toFixed(1)}%`}
              />
              {stats.weaponProfile.map((w) => (
                <Bar
                  key={w.weapon}
                  dataKey={w.weapon}
                  stackId="weapons"
                  fill={WEAPON_COLORS[w.weapon]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-2 flex-wrap">
            {stats.weaponProfile.filter((w) => w.pct >= 1).map((w) => (
              <span key={w.weapon} className="text-xs" style={{ color: WEAPON_COLORS[w.weapon] }}>
                {w.weapon} {w.pct.toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Per-map breakdown */}
      <div
        className="rounded-lg p-4"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <p
          className="text-xs uppercase tracking-wide mb-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Per-Map Breakdown
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr>
              {['Map', 'G', 'W-L', 'Win%', 'DPM', 'K/D'].map((h) => (
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
            {stats.mapBreakdown.map((m) => (
              <tr key={m.map}>
                <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  {m.map}
                </td>
                <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  {m.games}
                </td>
                <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  {m.wins}-{m.losses}
                </td>
                <td
                  className="py-1.5 border-b font-medium"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: m.winPct > 60 ? 'var(--color-win)' : m.winPct < 40 ? 'var(--color-loss)' : undefined,
                  }}
                >
                  {m.winPct.toFixed(0)}%
                </td>
                <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  {m.avgDpm.toFixed(0)}
                </td>
                <td className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  {m.avgKd.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p className="text-xl font-bold mt-0.5" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}
