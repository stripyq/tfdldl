import { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload.jsx';
import Overview from './views/Overview.jsx';
import MapStrength from './views/MapStrength.jsx';
import DataHealth from './views/DataHealth.jsx';
import { processData } from './etl/index.js';

const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'maps', label: 'Map Strength' },
  { id: 'health', label: 'Data Health' },
];

export default function App() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [configs, setConfigs] = useState(null);
  const [activeView, setActiveView] = useState('overview');

  // Load config files on mount
  useEffect(() => {
    async function loadConfigs() {
      try {
        const base = import.meta.env.BASE_URL;
        const [registryRes, teamConfigRes, rolesRes] = await Promise.all([
          fetch(`${base}data/player_registry.json`),
          fetch(`${base}data/team_config.json`),
          fetch(`${base}data/manual_roles.json`),
        ]);
        const playerRegistry = await registryRes.json();
        const teamConfig = await teamConfigRes.json();
        const manualRoles = await rolesRes.json();
        setConfigs({ playerRegistry, teamConfig, manualRoles });
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
          configs.manualRoles
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
          className="w-48 shrink-0 border-r py-4 flex flex-col gap-1"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className="text-left text-sm px-5 py-2 cursor-pointer"
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
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {activeView === 'overview' && <Overview data={data} />}
          {activeView === 'maps' && <MapStrength data={data} />}
          {activeView === 'health' && <DataHealth data={data} />}
        </main>
      </div>
    </div>
  );
}
