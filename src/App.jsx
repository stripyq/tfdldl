import { useState, useEffect, useCallback, useMemo } from 'react';
import FileUpload from './components/FileUpload.jsx';
import Overview from './views/Overview.jsx';
import MapStrength from './views/MapStrength.jsx';
import OpponentMatrix from './views/OpponentMatrix.jsx';
import Lineups from './views/Lineups.jsx';
import PlayerCards from './views/PlayerCards.jsx';
import MatchLog from './views/MatchLog.jsx';
import DataHealth from './views/DataHealth.jsx';
import OpponentScouting from './views/OpponentScouting.jsx';
import RoleAnalysis from './views/RoleAnalysis.jsx';
import OpponentPlayers from './views/OpponentPlayers.jsx';
import CloseGames from './views/CloseGames.jsx';
import { processData } from './etl/index.js';

const VIEW_GROUPS = [
  {
    label: 'OUR TEAM',
    views: [
      { id: 'overview', label: 'Overview' },
      { id: 'maps', label: 'Map Strength' },
      { id: 'lineups', label: 'Lineups' },
      { id: 'players', label: 'Player Cards' },
      { id: 'roles', label: 'Roles' },
      { id: 'close-games', label: 'Close Games' },
    ],
  },
  {
    label: 'OPPOSITION',
    views: [
      { id: 'opponents', label: 'Draft Helper' },
      { id: 'scouting', label: 'Opp. Teams' },
      { id: 'opp-players', label: 'Opp. Players' },
    ],
  },
  {
    label: 'DATA',
    views: [
      { id: 'matches', label: 'Match Log' },
      { id: 'health', label: 'Data Health' },
    ],
  },
];

export default function App() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [configs, setConfigs] = useState(null);
  const [activeView, setActiveView] = useState('overview');
  const [matchLogFilters, setMatchLogFilters] = useState(null);
  const [opponentFilter, setOpponentFilter] = useState(null);

  // Match notes: loaded from file + added in-session
  const [loadedNotes, setLoadedNotes] = useState([]);
  const [sessionNotes, setSessionNotes] = useState(new Map());

  // Merged notes: loaded overwritten by session edits, keyed by match_id
  const mergedNotes = useMemo(() => {
    const map = new Map();
    for (const n of loadedNotes) map.set(n.match_id, n);
    for (const [id, n] of sessionNotes) map.set(id, n);
    return map;
  }, [loadedNotes, sessionNotes]);

  const unsavedCount = sessionNotes.size;

  const handleSaveNote = useCallback((note) => {
    setSessionNotes((prev) => {
      const next = new Map(prev);
      next.set(note.match_id, note);
      return next;
    });
  }, []);

  const handleDownloadNotes = useCallback(() => {
    const allNotes = [...mergedNotes.values()];
    const json = JSON.stringify(allNotes, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'match_notes.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [mergedNotes]);

  const [clipboardCopied, setClipboardCopied] = useState(false);
  const handleCopyNotesDiscord = useCallback(() => {
    const notes = [...sessionNotes.values()];
    if (notes.length === 0) return;
    const lines = notes.map((n) => {
      const parts = [`\uD83D\uDCDD Match Notes`];
      parts.push(`${n.date_local || '?'} | ${n.map || '?'}`);
      if (n.formation) parts.push(`Formation: ${n.formation}`);
      if (n.rotation_style) parts.push(`Rotation: ${n.rotation_style}`);
      if (n.comment) parts.push(`Comment: ${n.comment}`);
      if (n.enemy_notes) parts.push(`Enemy: ${n.enemy_notes}`);
      if (n.our_adjustments) parts.push(`Adjustments: ${n.our_adjustments}`);
      if (n.tags && n.tags.length > 0) parts.push(`Tags: ${n.tags.join(', ')}`);
      return parts.join('\n');
    });
    const text = lines.join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setClipboardCopied(true);
      setTimeout(() => setClipboardCopied(false), 2000);
    });
  }, [sessionNotes]);

  function navigateToMatchLog(filters) {
    setMatchLogFilters({ ...filters, _ts: Date.now() });
    setActiveView('matches');
  }

  function navigateToOpponent(viewId, opponent) {
    setOpponentFilter({ opponent, _ts: Date.now() });
    setActiveView(viewId);
  }

  // Load config files on mount, then try auto-loading default match data
  useEffect(() => {
    async function loadConfigs() {
      try {
        const base = import.meta.env.BASE_URL;
        const [registryRes, teamConfigRes, rolesRes, notesRes, leagueRes, manualMatchesRes] = await Promise.all([
          fetch(`${base}data/player_registry.json`),
          fetch(`${base}data/team_config.json`),
          fetch(`${base}data/manual_roles.json`),
          fetch(`${base}data/match_notes.json`),
          fetch(`${base}data/league_config.json`),
          fetch(`${base}data/manual_matches.json`),
        ]);
        const playerRegistry = await registryRes.json();
        const teamConfig = await teamConfigRes.json();
        const manualRoles = await rolesRes.json();
        const matchNotes = await notesRes.json();
        const leagueConfig = leagueRes.ok ? await leagueRes.json() : null;
        const manualMatches = manualMatchesRes.ok ? await manualMatchesRes.json() : [];
        const loadedConfigs = { playerRegistry, teamConfig, manualRoles, leagueConfig, manualMatches };
        setConfigs(loadedConfigs);
        setLoadedNotes(Array.isArray(matchNotes) ? matchNotes : []);

        // Try auto-loading baked-in default match data
        try {
          const defaultRes = await fetch(`${base}data/matches_default.json`);
          if (defaultRes.ok) {
            const rawJson = await defaultRes.json();
            if (Array.isArray(rawJson) && rawJson.length > 0) {
              const result = processData(rawJson, loadedConfigs.playerRegistry, loadedConfigs.teamConfig, loadedConfigs.manualRoles, loadedConfigs.manualMatches);
              setData(result);
            }
          }
        } catch {
          // No default data file — show upload screen as before
        }
      } catch (err) {
        setError(`Failed to load config files: ${err.message}`);
      }
    }
    loadConfigs();
  }, []);

  function handleDataLoaded(rawJson) {
    if (!configs) {
      setError('Config files not loaded yet');
      return;
    }
    setIsLoading(true);
    setError(null);

    // Use setTimeout to let the UI update before processing
    setTimeout(() => {
      try {
        const result = processData(
          rawJson,
          configs.playerRegistry,
          configs.teamConfig,
          configs.manualRoles,
          configs.manualMatches
        );
        setData(result);
      } catch (err) {
        setError(`Pipeline error: ${err.message}`);
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }, 0);
  }

  function handleReset() {
    setData(null);
    setError(null);
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <p className="text-lg mb-4" style={{ color: 'var(--color-loss)' }}>
          {error}
        </p>
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded cursor-pointer"
          style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <FileUpload
        onDataLoaded={handleDataLoaded}
        isLoading={isLoading || !configs}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-6 py-3 border-b shrink-0"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <h1 className="font-bold" style={{ color: 'var(--color-accent)' }}>
          wB CTF Analytics
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {data.matches.length} matches loaded
          </span>
          {data.dataHash && (
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)' }}
              title="Data version hash — identifies this specific dataset"
            >
              {data.dataHash}
            </span>
          )}
          {unsavedCount > 0 && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}
              title={`${unsavedCount} note(s) added this session`}
            >
              {unsavedCount} unsaved
            </span>
          )}
          {mergedNotes.size > 0 && (
            <button
              onClick={handleDownloadNotes}
              className="text-xs px-3 py-1 rounded cursor-pointer"
              style={{
                backgroundColor: 'var(--color-surface-hover)',
                color: 'var(--color-accent)',
                border: '1px solid var(--color-border)',
              }}
              title="Download all match notes as JSON"
            >
              Download match_notes.json
            </button>
          )}
          {unsavedCount > 0 && (
            <button
              onClick={handleCopyNotesDiscord}
              className="text-xs px-3 py-1 rounded cursor-pointer"
              style={{
                backgroundColor: 'var(--color-surface-hover)',
                color: clipboardCopied ? 'var(--color-win)' : 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
              }}
              title="Copy session notes as Discord-friendly text"
            >
              {clipboardCopied ? 'Copied!' : 'Copy for Discord'}
            </button>
          )}
          <button
            onClick={handleReset}
            className="text-sm px-3 py-1 rounded cursor-pointer"
            style={{
              backgroundColor: 'var(--color-surface-hover)',
              color: 'var(--color-text)',
            }}
          >
            Upload New
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <nav
          className="w-48 shrink-0 border-r py-4 flex flex-col"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          {VIEW_GROUPS.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && (
                <div
                  className="mx-4 my-2 border-t"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              )}
              <p
                className="text-xs font-semibold tracking-wider px-5 pt-2 pb-1"
                style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}
              >
                {group.label}
              </p>
              {group.views.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setActiveView(v.id)}
                  className="text-left text-sm px-5 py-2 cursor-pointer w-full"
                  style={{
                    backgroundColor: activeView === v.id ? 'var(--color-surface-hover)' : 'transparent',
                    color: activeView === v.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    fontWeight: activeView === v.id ? 600 : 400,
                    borderLeft: activeView === v.id ? '3px solid var(--color-accent)' : '3px solid transparent',
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {activeView === 'overview' && <Overview data={data} onNavigateMatchLog={navigateToMatchLog} onNavigateOpponent={navigateToOpponent} matchNotes={mergedNotes} leagueConfig={configs?.leagueConfig} />}
          {activeView === 'maps' && <MapStrength data={data} onNavigateMatchLog={navigateToMatchLog} matchNotes={mergedNotes} />}
          {activeView === 'opponents' && <OpponentMatrix data={data} onNavigateMatchLog={navigateToMatchLog} initialOpponent={opponentFilter} key={`opp-${opponentFilter?._ts || 'default'}`} />}
          {activeView === 'scouting' && <OpponentScouting data={data} initialOpponent={opponentFilter} key={`scout-${opponentFilter?._ts || 'default'}`} />}
          {activeView === 'opp-players' && <OpponentPlayers data={data} onNavigateMatchLog={navigateToMatchLog} initialOpponent={opponentFilter} key={`opppl-${opponentFilter?._ts || 'default'}`} />}
          {activeView === 'close-games' && <CloseGames data={data} onNavigateMatchLog={navigateToMatchLog} />}
          {activeView === 'lineups' && <Lineups data={data} onNavigateMatchLog={navigateToMatchLog} />}
          {activeView === 'players' && <PlayerCards data={data} onNavigateMatchLog={navigateToMatchLog} matchNotes={mergedNotes} />}
          {activeView === 'roles' && <RoleAnalysis data={data} />}
          {activeView === 'matches' && (
            <MatchLog
              data={data}
              initialFilters={matchLogFilters}
              key={matchLogFilters?._ts || 'default'}
              matchNotes={mergedNotes}
              onSaveNote={handleSaveNote}
            />
          )}
          {activeView === 'health' && <DataHealth data={data} />}
        </main>
      </div>
    </div>
  );
}
