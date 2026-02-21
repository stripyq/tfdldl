/**
 * MatchLog view — filterable, sortable match table with expandable per-player detail.
 * Supports external filter presets via initialFilters prop (for cross-view navigation).
 * Supports match annotations: inline note form, note icon, tag filter.
 * Team filter: 'All' shows every match (Red/Blue columns), specific team shows perspective view.
 */

import { useState, useMemo } from 'react';
import ExportButton from '../components/ExportButton.jsx';
import InfoTip from '../components/InfoTip.jsx';
import PlayerNames from '../components/PlayerNames.jsx';

const FORMATION_OPTIONS = ['', '1def-3off', '2def-2off', '1def-2off-1mid', 'custom'];
const ROTATION_OPTIONS = ['', 'Rigid', 'Dynamic', 'Mixed'];

export default function MatchLog({ data, initialFilters, matchNotes, onSaveNote }) {
  const { matches, teamMatchRows, playerRows, focusTeam } = data;

  // Build lookup maps
  const matchMap = useMemo(() => {
    const m = new Map();
    for (const match of matches) m.set(match.match_id, match);
    return m;
  }, [matches]);

  const playersByMatch = useMemo(() => {
    const m = new Map();
    for (const p of playerRows) {
      if (!m.has(p.match_id)) m.set(p.match_id, []);
      m.get(p.match_id).push(p);
    }
    return m;
  }, [playerRows]);

  // All unique team names (for Team filter dropdown)
  const teamOptions = useMemo(() => {
    const teams = new Set();
    for (const r of teamMatchRows) teams.add(r.team_name);
    return [...teams].sort();
  }, [teamMatchRows]);

  // Team filter state
  const [filterTeam, setFilterTeam] = useState(initialFilters?.team || focusTeam);
  const isAllTeams = filterTeam === 'all';

  // Build team members for sub badges (for the selected team perspective)
  const teamMembers = useMemo(() => {
    const set = new Set();
    if (isAllTeams) return set;
    for (const p of playerRows) {
      if (p.team_membership === filterTeam) set.add(p.canonical);
    }
    return set;
  }, [playerRows, filterTeam, isAllTeams]);

  // Build rows based on team filter
  const allRows = useMemo(() => {
    if (isAllTeams) {
      // One row per match, showing both sides
      return matches.map((m) => ({
        match_id: m.match_id,
        date_local: m.date_local,
        datetime_local: m.datetime_local || '',
        map: m.map,
        team_red: m.team_red || 'MIX',
        team_blue: m.team_blue || 'MIX',
        score_red: m.score_red,
        score_blue: m.score_blue,
        class_red: m.class_red,
        class_blue: m.class_blue,
        url: m.url || '',
        manual: !!m.manual,
        qualifies_loose: m.qualifies_loose,
        qualifies_strict: m.qualifies_strict,
        qualifies_h2h: m.qualifies_h2h,
      })).sort((a, b) =>
        (b.date_local || '').localeCompare(a.date_local || '') ||
        (b.datetime_local || '').localeCompare(a.datetime_local || '')
      );
    }

    // Specific team perspective
    const teamRows = teamMatchRows.filter((r) => r.team_name === filterTeam);
    return teamRows.map((r) => {
      const match = matchMap.get(r.match_id);
      const oppSide = r.side === 'red' ? 'blue' : 'red';
      const oppClass = match
        ? (oppSide === 'red' ? match.class_red : match.class_blue)
        : null;
      return {
        ...r,
        url: match?.url || '',
        manual: !!match?.manual,
        opp_class: oppClass,
        datetime_local: match?.datetime_local || '',
      };
    }).sort((a, b) =>
      (b.date_local || '').localeCompare(a.date_local || '') ||
      (b.datetime_local || '').localeCompare(a.datetime_local || '')
    );
  }, [isAllTeams, matches, teamMatchRows, filterTeam, matchMap]);

  // Collect all unique tags from notes
  const allTags = useMemo(() => {
    if (!matchNotes || matchNotes.size === 0) return [];
    const tags = new Set();
    for (const note of matchNotes.values()) {
      if (note.tags && Array.isArray(note.tags)) {
        for (const t of note.tags) {
          if (t.trim()) tags.add(t.trim());
        }
      }
    }
    return [...tags].sort();
  }, [matchNotes]);

  // Extract filter options from current rows
  const mapOptions = useMemo(
    () => [...new Set(allRows.map((r) => r.map))].sort(),
    [allRows]
  );
  const oppOptions = useMemo(() => {
    if (isAllTeams) return [];
    return [...new Set(allRows.map((r) => r.opponent_team).filter(Boolean))].sort();
  }, [allRows, isAllTeams]);

  // Filter state — initialized from external filter presets (component is re-keyed on change)
  const [filterMap, setFilterMap] = useState(initialFilters?.map || 'all');
  const [filterOpp, setFilterOpp] = useState(initialFilters?.opponent || 'all');
  const [filterResult, setFilterResult] = useState(initialFilters?.result || 'all');
  const [filterDataset, setFilterDataset] = useState(initialFilters?.dataset || (initialFilters ? 'all' : 'loose'));
  const [filterLineup, setFilterLineup] = useState(initialFilters?.lineup || null);
  const [filterPlayer, setFilterPlayer] = useState(initialFilters?.player || null);
  const [filterClose, setFilterClose] = useState(initialFilters?.close || false);
  const [filterTag, setFilterTag] = useState('all');
  const [sortCol, setSortCol] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [noteFormId, setNoteFormId] = useState(null);

  function handleTeamChange(team) {
    setFilterTeam(team);
    setFilterMap('all');
    setFilterOpp('all');
    setFilterResult('all');
    setFilterLineup(null);
    setFilterPlayer(null);
    setFilterClose(false);
    setFilterTag('all');
    setSortCol('date');
    setSortAsc(false);
    setExpandedId(null);
  }

  // Apply filters
  const filtered = useMemo(() => {
    return allRows.filter((r) => {
      if (filterMap !== 'all' && r.map !== filterMap) return false;
      if (filterDataset === 'loose' && !r.qualifies_loose) return false;
      if (filterDataset === 'strict' && !r.qualifies_strict) return false;
      if (filterDataset === 'h2h' && !r.qualifies_h2h) return false;

      if (isAllTeams) {
        if (filterClose && Math.abs(r.score_red - r.score_blue) > 1) return false;
      } else {
        if (filterOpp !== 'all' && r.opponent_team !== filterOpp) return false;
        if (filterResult !== 'all' && r.result !== filterResult) return false;
        if (filterClose && Math.abs(r.cap_diff) > 1) return false;
        if (filterLineup && r.lineup_key !== filterLineup) return false;
        if (filterPlayer && !r.player_names.includes(filterPlayer)) return false;
      }

      if (filterTag !== 'all') {
        const note = matchNotes?.get(r.match_id);
        if (!note) return false;
        const tags = Array.isArray(note.tags) ? note.tags.map((t) => t.trim()) : [];
        if (!tags.includes(filterTag)) return false;
      }
      return true;
    });
  }, [allRows, filterMap, filterOpp, filterResult, filterDataset, filterClose, filterLineup, filterPlayer, filterTag, matchNotes, isAllTeams]);

  // Apply sorting
  const sorted = useMemo(() => {
    const keyMap = isAllTeams
      ? { date: 'date_local', map: 'map', score_red: 'score_red', score_blue: 'score_blue', team_red: 'team_red', team_blue: 'team_blue' }
      : { date: 'date_local', map: 'map', score_for: 'score_for', score_against: 'score_against', result: 'result', opponent: 'opponent_team', opp_class: 'opp_class' };
    const key = keyMap[sortCol] || 'date_local';

    return [...filtered].sort((a, b) => {
      let va = a[key] ?? '';
      let vb = b[key] ?? '';
      // Secondary sort by datetime for date column
      if (key === 'date_local' && va === vb) {
        va = a.datetime_local || '';
        vb = b.datetime_local || '';
      }
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });
  }, [filtered, sortCol, sortAsc, isAllTeams]);

  function handleSort(col) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  }

  function clearSpecialFilters() {
    setFilterLineup(null);
    setFilterPlayer(null);
    setFilterClose(false);
  }

  // Export data
  const exportData = isAllTeams
    ? sorted.map((r) => ({
        date: r.date_local,
        map: r.map,
        red_team: r.team_red,
        red_score: r.score_red,
        blue_score: r.score_blue,
        blue_team: r.team_blue,
        url: r.url,
      }))
    : sorted.map((r) => ({
        date: r.date_local,
        map: r.map,
        team_score: r.score_for,
        opp_score: r.score_against,
        result: r.result,
        opponent: r.opponent_team || '',
        opp_class: r.opp_class || '',
        players: r.player_names.join(', '),
        url: r.url,
      }));

  const exportFilename = isAllTeams
    ? 'all_match_log.csv'
    : `${filterTeam.toLowerCase().replace(/\s+/g, '_')}_match_log.csv`;

  // Summary
  const wins = isAllTeams ? 0 : filtered.filter((r) => r.result === 'W').length;
  const losses = isAllTeams ? 0 : filtered.filter((r) => r.result === 'L').length;

  // Columns adapt to mode
  const columns = isAllTeams
    ? [
        { key: 'date', label: 'Date' },
        { key: 'map', label: 'Map' },
        { key: 'team_red', label: 'Red Team' },
        { key: 'score_red', label: 'Red' },
        { key: 'score_blue', label: 'Blue' },
        { key: 'team_blue', label: 'Blue Team' },
      ]
    : [
        { key: 'date', label: 'Date' },
        { key: 'map', label: 'Map' },
        { key: 'score_for', label: filterTeam === focusTeam ? 'wB' : filterTeam },
        { key: 'score_against', label: 'Opp' },
        { key: 'result', label: 'Result' },
        { key: 'opponent', label: 'Opponent' },
        { key: 'opp_class', label: <>Class <InfoTip text="FULL_TEAM = all 4 same team. Stack = 3 of 4 same team. Mix = no dominant team." /></> },
      ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--color-accent)' }}
        >
          Match Log
        </h2>
        <ExportButton data={exportData} filename={exportFilename} />
      </div>

      {/* Filters */}
      <div
        className="rounded-lg p-4 mb-4 flex flex-wrap gap-4 items-end"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <FilterSelect label="Team" value={filterTeam} onChange={handleTeamChange}
          options={[
            { value: 'all', label: 'All Teams' },
            ...teamOptions.map((t) => ({ value: t, label: t })),
          ]}
        />
        <FilterSelect label="Dataset" value={filterDataset} onChange={setFilterDataset}
          options={[
            { value: 'all', label: 'All' },
            { value: 'loose', label: 'Loose' },
            { value: 'strict', label: 'Strict' },
            { value: 'h2h', label: 'H2H' },
          ]}
        />
        <FilterSelect label="Map" value={filterMap} onChange={setFilterMap}
          options={[{ value: 'all', label: 'All Maps' }, ...mapOptions.map((m) => ({ value: m, label: m }))]}
        />
        {!isAllTeams && (
          <FilterSelect label="Opponent" value={filterOpp} onChange={setFilterOpp}
            options={[{ value: 'all', label: 'All Opponents' }, ...oppOptions.map((o) => ({ value: o, label: o }))]}
          />
        )}
        {!isAllTeams && (
          <FilterSelect label="Result" value={filterResult} onChange={setFilterResult}
            options={[
              { value: 'all', label: 'All' },
              { value: 'W', label: 'Wins' },
              { value: 'L', label: 'Losses' },
              { value: 'D', label: 'Draws' },
            ]}
          />
        )}
        {allTags.length > 0 && (
          <FilterSelect label="Tag" value={filterTag} onChange={setFilterTag}
            options={[
              { value: 'all', label: 'All Tags' },
              ...allTags.map((t) => ({ value: t, label: t })),
            ]}
          />
        )}
      </div>

      {/* Active special filter badges */}
      {(filterLineup || filterPlayer || filterClose) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {filterClose && (
            <FilterBadge
              label="Close games (\u00B11 cap)"
              onClear={() => setFilterClose(false)}
            />
          )}
          {filterPlayer && (
            <FilterBadge
              label={`Player: ${filterPlayer}`}
              onClear={() => setFilterPlayer(null)}
            />
          )}
          {filterLineup && (
            <FilterBadge
              label={`Lineup: ${filterLineup.split('+').join(' \u00B7 ')}`}
              onClear={() => setFilterLineup(null)}
            />
          )}
          <button
            onClick={clearSpecialFilters}
            className="text-xs px-2 py-1 rounded cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Clear all
          </button>
        </div>
      )}

      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
        {filtered.length} matches
        {!isAllTeams && (
          <> &middot; {wins}W&ndash;{losses}L
            {filtered.length > 0 && ` \u00B7 ${((wins / filtered.length) * 100).toFixed(0)}%`}
          </>
        )}
      </p>

      {sorted.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No matches match the current filters.</p>
      ) : (
        <div
          className="rounded-lg overflow-x-auto"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => handleSort(c.key)}
                    className="text-left px-3 py-2 border-b font-medium cursor-pointer select-none"
                    style={{
                      borderColor: 'var(--color-border)',
                      color: sortCol === c.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    }}
                  >
                    {c.label}
                    {sortCol === c.key && (sortAsc ? ' \u25B2' : ' \u25BC')}
                  </th>
                ))}
                {!isAllTeams && (
                  <th
                    className="text-left px-3 py-2 border-b font-medium"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                  >
                    Players
                  </th>
                )}
                <th
                  className="text-left px-3 py-2 border-b font-medium"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const isExpanded = expandedId === r.match_id;
                return (
                  <MatchRow
                    key={r.match_id}
                    row={r}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedId(isExpanded ? null : r.match_id)}
                    playersByMatch={playersByMatch}
                    matchMap={matchMap}
                    colCount={columns.length + (isAllTeams ? 1 : 2)}
                    matchNotes={matchNotes}
                    onSaveNote={onSaveNote}
                    noteFormId={noteFormId}
                    setNoteFormId={setNoteFormId}
                    teamMembers={teamMembers}
                    isAllTeams={isAllTeams}
                    filterTeam={filterTeam}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MatchRow({ row, isExpanded, onToggle, playersByMatch, matchMap, colCount, matchNotes, onSaveNote, noteFormId, setNoteFormId, teamMembers, isAllTeams, filterTeam }) {
  const r = row;
  const hasNote = matchNotes?.has(r.match_id);
  const showNoteForm = noteFormId === r.match_id;

  if (isAllTeams) {
    const redWon = r.score_red > r.score_blue;
    const blueWon = r.score_blue > r.score_red;
    const isDraw = r.score_red === r.score_blue;

    return (
      <>
        <tr
          onClick={onToggle}
          className="cursor-pointer"
          style={{ backgroundColor: isExpanded ? 'var(--color-surface-hover)' : undefined }}
        >
          <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
            {hasNote && <span title="Has notes">{'\uD83D\uDCDD'} </span>}
            {r.date_local}
          </td>
          <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
            {r.map}
          </td>
          <td
            className="px-3 py-1.5 border-b"
            style={{ borderColor: 'var(--color-border)', fontWeight: redWon ? 600 : 400 }}
          >
            {r.team_red}
          </td>
          <td
            className="px-3 py-1.5 border-b font-semibold"
            style={{
              borderColor: 'var(--color-border)',
              color: redWon ? 'var(--color-win)' : blueWon ? 'var(--color-loss)' : isDraw ? 'var(--color-draw)' : undefined,
            }}
          >
            {r.score_red}
          </td>
          <td
            className="px-3 py-1.5 border-b font-semibold"
            style={{
              borderColor: 'var(--color-border)',
              color: blueWon ? 'var(--color-win)' : redWon ? 'var(--color-loss)' : isDraw ? 'var(--color-draw)' : undefined,
            }}
          >
            {r.score_blue}
          </td>
          <td
            className="px-3 py-1.5 border-b"
            style={{ borderColor: 'var(--color-border)', fontWeight: blueWon ? 600 : 400 }}
          >
            {r.team_blue}
          </td>
          <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <MatchSource url={r.url} manual={r.manual} />
          </td>
        </tr>
        {isExpanded && (
          <tr>
            <td colSpan={colCount} style={{ backgroundColor: 'var(--color-bg)' }}>
              <ExpandedDetail
                matchId={r.match_id}
                playersByMatch={playersByMatch}
                match={matchMap.get(r.match_id)}
                isAllTeams
              />
              <div className="px-4 pb-3">
                {hasNote && !showNoteForm && (
                  <NoteDisplay note={matchNotes.get(r.match_id)} />
                )}
                {showNoteForm ? (
                  <NoteForm
                    matchId={r.match_id}
                    dateLocal={r.date_local}
                    map={r.map}
                    existingNote={matchNotes?.get(r.match_id)}
                    onSave={(note) => {
                      onSaveNote(note);
                      setNoteFormId(null);
                    }}
                    onCancel={() => setNoteFormId(null)}
                  />
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setNoteFormId(r.match_id); }}
                    className="text-xs px-3 py-1 rounded cursor-pointer mt-1"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-accent)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {hasNote ? 'Edit Note' : 'Add Note'}
                  </button>
                )}
              </div>
            </td>
          </tr>
        )}
      </>
    );
  }

  // Team-specific perspective view
  const resultColor = r.result === 'W' ? 'var(--color-win)' : r.result === 'L' ? 'var(--color-loss)' : 'var(--color-draw)';

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer"
        style={{ backgroundColor: isExpanded ? 'var(--color-surface-hover)' : undefined }}
      >
        <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {hasNote && <span title="Has notes">{'\uD83D\uDCDD'} </span>}
          {r.date_local}
        </td>
        <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {r.map}
        </td>
        <td className="px-3 py-1.5 border-b font-semibold" style={{ borderColor: 'var(--color-border)' }}>
          {r.score_for}
        </td>
        <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {r.score_against}
        </td>
        <td
          className="px-3 py-1.5 border-b font-bold"
          style={{ borderColor: 'var(--color-border)', color: resultColor }}
        >
          {r.result}
          {Math.abs(r.cap_diff) <= 1 && r.result !== 'D' && (
            <span
              className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                color: 'rgb(234, 179, 8)',
              }}
              title={`Close game: ${r.score_for}\u2013${r.score_against}`}
            >
              CLOSE
            </span>
          )}
        </td>
        <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {r.opponent_team || 'MIX'}
        </td>
        <td className="px-3 py-1.5 border-b text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          {formatClass(r.opp_class)}
        </td>
        <td className="px-3 py-1.5 border-b text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          <PlayerNames names={r.player_names} teamMembers={teamMembers} separator=", " />
        </td>
        <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <MatchSource url={r.url} manual={r.manual} />
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={colCount} style={{ backgroundColor: 'var(--color-bg)' }}>
            <ExpandedDetail
              matchId={r.match_id}
              side={r.side}
              playersByMatch={playersByMatch}
              match={matchMap.get(r.match_id)}
              teamName={filterTeam}
            />
            <div className="px-4 pb-3">
              {/* Existing note display */}
              {hasNote && !showNoteForm && (
                <NoteDisplay note={matchNotes.get(r.match_id)} />
              )}
              {/* Note form */}
              {showNoteForm ? (
                <NoteForm
                  matchId={r.match_id}
                  dateLocal={r.date_local}
                  map={r.map}
                  existingNote={matchNotes?.get(r.match_id)}
                  onSave={(note) => {
                    onSaveNote(note);
                    setNoteFormId(null);
                  }}
                  onCancel={() => setNoteFormId(null)}
                />
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setNoteFormId(r.match_id); }}
                  className="text-xs px-3 py-1 rounded cursor-pointer mt-1"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-accent)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {hasNote ? 'Edit Note' : 'Add Note'}
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function NoteDisplay({ note }) {
  return (
    <div
      className="rounded p-3 mb-2 text-xs"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {(note.formation || note.rotation_style) && (
        <div className="mb-1 flex gap-3">
          {note.formation && (
            <span>
              <span style={{ color: 'var(--color-text-muted)' }}>Formation: </span>
              <span style={{ color: 'var(--color-accent)' }}>{note.formation}</span>
            </span>
          )}
          {note.rotation_style && (
            <span>
              <span style={{ color: 'var(--color-text-muted)' }}>Rotation: </span>
              <span style={{ color: 'var(--color-accent)' }}>{note.rotation_style}</span>
            </span>
          )}
        </div>
      )}
      {note.comment && (
        <div className="mb-1">
          <span style={{ color: 'var(--color-text-muted)' }}>Comment: </span>
          {note.comment}
        </div>
      )}
      {note.enemy_notes && (
        <div className="mb-1">
          <span style={{ color: 'var(--color-text-muted)' }}>Enemy notes: </span>
          {note.enemy_notes}
        </div>
      )}
      {note.our_adjustments && (
        <div className="mb-1">
          <span style={{ color: 'var(--color-text-muted)' }}>Our adjustments: </span>
          {note.our_adjustments}
        </div>
      )}
      {note.tags && note.tags.length > 0 && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {note.tags.map((t) => (
            <span
              key={t}
              className="px-1.5 py-0.5 rounded text-[10px]"
              style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-accent)' }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function NoteForm({ matchId, dateLocal, map, existingNote, onSave, onCancel }) {
  const [comment, setComment] = useState(existingNote?.comment || '');
  const [enemyNotes, setEnemyNotes] = useState(existingNote?.enemy_notes || '');
  const [ourAdj, setOurAdj] = useState(existingNote?.our_adjustments || '');
  const [formation, setFormation] = useState(existingNote?.formation || '');
  const [rotationStyle, setRotationStyle] = useState(existingNote?.rotation_style || '');
  const [tagsStr, setTagsStr] = useState(
    existingNote?.tags ? existingNote.tags.join(', ') : ''
  );

  function handleSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    const tags = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({
      match_id: matchId,
      date_local: dateLocal,
      map,
      comment,
      enemy_notes: enemyNotes,
      our_adjustments: ourAdj,
      formation: formation || undefined,
      rotation_style: rotationStyle || undefined,
      tags,
    });
  }

  const inputStyle = {
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
  };

  return (
    <form
      onClick={(e) => e.stopPropagation()}
      onSubmit={handleSubmit}
      className="rounded p-3 mt-2"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-accent)' }}>
        Match Note &mdash; {dateLocal} {map}
      </p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-[10px] block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Formation
          </label>
          <select
            value={formation}
            onChange={(e) => setFormation(e.target.value)}
            className="w-full rounded px-2 py-1 text-xs cursor-pointer"
            style={inputStyle}
          >
            {FORMATION_OPTIONS.map((f) => (
              <option key={f} value={f}>{f || '\u2014 none \u2014'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Rotation Style
          </label>
          <select
            value={rotationStyle}
            onChange={(e) => setRotationStyle(e.target.value)}
            className="w-full rounded px-2 py-1 text-xs cursor-pointer"
            style={inputStyle}
          >
            {ROTATION_OPTIONS.map((r) => (
              <option key={r} value={r}>{r || '\u2014 none \u2014'}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 mb-2">
        <div>
          <label className="text-[10px] block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Comment
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full rounded px-2 py-1 text-xs"
            style={inputStyle}
            placeholder="General game note..."
          />
        </div>
        <div>
          <label className="text-[10px] block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Enemy notes
          </label>
          <textarea
            value={enemyNotes}
            onChange={(e) => setEnemyNotes(e.target.value)}
            rows={2}
            className="w-full rounded px-2 py-1 text-xs"
            style={inputStyle}
            placeholder="What the opponent did..."
          />
        </div>
        <div>
          <label className="text-[10px] block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Our adjustments
          </label>
          <textarea
            value={ourAdj}
            onChange={(e) => setOurAdj(e.target.value)}
            rows={2}
            className="w-full rounded px-2 py-1 text-xs"
            style={inputStyle}
            placeholder="What we should do differently..."
          />
        </div>
        <div>
          <label className="text-[10px] block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            className="w-full rounded px-2 py-1 text-xs"
            style={inputStyle}
            placeholder="e.g. comeback, choke, strat-change"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="text-xs px-3 py-1 rounded cursor-pointer font-medium"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-bg)',
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1 rounded cursor-pointer"
          style={{
            backgroundColor: 'var(--color-surface-hover)',
            color: 'var(--color-text-muted)',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ExpandedDetail({ matchId, side, playersByMatch, match, isAllTeams, teamName }) {
  const allPlayers = playersByMatch.get(matchId) || [];

  const headers = ['Player', 'Frags', 'Deaths', 'K/D', 'Caps', 'Def', 'DPM', 'Net Dmg'];

  function renderTable(players, label, expectedTeam) {
    if (players.length === 0) return null;
    const sorted = [...players].sort((a, b) => b.dmg_dealt - a.dmg_dealt);
    return (
      <div className="mb-3">
        <p className="text-xs font-medium mb-1 px-4" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-1 font-medium"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const isSub = expectedTeam && expectedTeam !== 'MIX' &&
                p.team_membership !== expectedTeam;
              return (
                <tr key={p.canonical + p.side} className={isSub ? 'player-sub' : ''}>
                  <td className="px-4 py-0.5 font-medium">
                    {p.canonical}
                    {isSub && (
                      <span
                        className="ml-1.5 text-[10px] font-normal px-1 py-px rounded"
                        style={{
                          backgroundColor: 'var(--color-surface-hover)',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        sub
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-0.5">{p.frags}</td>
                  <td className="px-4 py-0.5">{p.deaths}</td>
                  <td className="px-4 py-0.5">{p.kd_ratio.toFixed(2)}</td>
                  <td className="px-4 py-0.5">{p.caps}</td>
                  <td className="px-4 py-0.5">{p.defends}</td>
                  <td className="px-4 py-0.5">{p.dpm != null ? p.dpm.toFixed(0) : '\u2014'}</td>
                  <td
                    className="px-4 py-0.5"
                    style={{
                      color: p.net_damage > 0 ? 'var(--color-win)' : p.net_damage < 0 ? 'var(--color-loss)' : undefined,
                    }}
                  >
                    {p.net_damage >= 0 ? '+' : ''}{p.net_damage.toFixed(0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (isAllTeams) {
    const redPlayers = allPlayers.filter((p) => p.side === 'red');
    const bluePlayers = allPlayers.filter((p) => p.side === 'blue');
    const redTeam = match?.team_red || 'Red';
    const blueTeam = match?.team_blue || 'Blue';

    return (
      <div className="py-2">
        {renderTable(redPlayers, redTeam, redTeam)}
        {renderTable(bluePlayers, blueTeam, blueTeam)}
      </div>
    );
  }

  const wbPlayers = allPlayers.filter((p) => p.side === side);
  const oppPlayers = allPlayers.filter((p) => p.side !== side);

  const ownTeam = match
    ? (side === 'red' ? match.team_red : match.team_blue)
    : null;
  const oppTeam = match
    ? (side === 'red' ? match.team_blue : match.team_red)
    : null;

  return (
    <div className="py-2">
      {renderTable(wbPlayers, teamName || 'Team', ownTeam)}
      {renderTable(oppPlayers, 'Opponent', oppTeam)}
    </div>
  );
}

function FilterBadge({ label, onClear }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
      style={{
        backgroundColor: 'var(--color-surface-hover)',
        color: 'var(--color-accent)',
        border: '1px solid var(--color-border)',
      }}
    >
      {label}
      <button
        onClick={onClear}
        className="cursor-pointer hover:opacity-70"
        style={{ color: 'var(--color-text-muted)' }}
      >
        &times;
      </button>
    </span>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs block mb-1" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1.5 rounded text-sm cursor-pointer"
        style={{
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function MatchSource({ url, manual }) {
  if (manual) {
    return (
      <span className="text-xs" title="Manual entry (screenshot)" style={{ color: 'var(--color-text-muted)' }}>
        {'\uD83D\uDCCB'}
      </span>
    );
  }
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-xs underline"
        style={{ color: 'var(--color-accent)' }}
      >
        qllr
      </a>
    );
  }
  return <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>&ndash;</span>;
}

function formatClass(cls) {
  if (cls === 'FULL_TEAM') return 'Full';
  if (cls === 'STACK_3PLUS') return 'Stack';
  if (cls === 'MIX') return 'Mix';
  return cls || '';
}
