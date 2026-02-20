import { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload.jsx';
import DataHealth from './views/DataHealth.jsx';
import { processData } from './etl/index.js';

export default function App() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [configs, setConfigs] = useState(null);

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
          className="px-4 py-2 rounded"
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
    <div className="min-h-screen">
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-6 py-3 border-b"
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
            className="text-sm px-3 py-1 rounded"
            style={{
              backgroundColor: 'var(--color-surface-hover)',
              color: 'var(--color-text)',
            }}
          >
            Upload New
          </button>
        </div>
      </header>

      {/* DataHealth view */}
      <DataHealth data={data} />
    </div>
  );
}
