import { useState, useRef } from 'react';

export default function FileUpload({ onDataLoaded, isLoading }) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  function handleFile(file) {
    if (!file) return;
    setError(null);

    if (!file.name.endsWith('.json')) {
      setError('Please upload a .json file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) {
          setError('Expected a JSON array of match objects');
          return;
        }
        onDataLoaded(data);
      } catch {
        setError('Invalid JSON file');
      }
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }

  function onDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave() {
    setDragOver(false);
  }

  function onInputChange(e) {
    handleFile(e.target.files[0]);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-accent)' }}>
        wB CTF Analytics
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
        Upload your qllr match export to get started
      </p>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className="w-full max-w-md p-12 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors"
        style={{
          borderColor: dragOver ? 'var(--color-accent)' : 'var(--color-border)',
          backgroundColor: dragOver ? 'rgba(255, 215, 0, 0.05)' : 'var(--color-surface)',
        }}
      >
        {isLoading ? (
          <p style={{ color: 'var(--color-text-muted)' }}>Processing...</p>
        ) : (
          <>
            <p className="text-lg mb-2">Drop JSON file here</p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              or click to browse
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={onInputChange}
          className="hidden"
        />
      </div>

      {error && (
        <p className="mt-4 text-sm" style={{ color: 'var(--color-loss)' }}>
          {error}
        </p>
      )}

      <p className="mt-8 text-xs max-w-md text-center" style={{ color: 'var(--color-text-muted)' }}>
        Expects ctf_matches_full.json from qllr export. All processing happens
        locally in your browser — no data is sent anywhere.
      </p>
    </div>
  );
}
