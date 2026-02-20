/**
 * ExportButton — downloads an array of objects as CSV.
 */
export default function ExportButton({ data, filename = 'export.csv', label = 'Export CSV' }) {
  function handleExport() {
    if (!data || data.length === 0) return;

    const keys = Object.keys(data[0]);
    const header = keys.join(',');
    const rows = data.map((row) =>
      keys
        .map((k) => {
          const val = row[k];
          if (val == null) return '';
          if (Array.isArray(val)) return `"${val.join('; ')}"`;
          const str = String(val);
          // Quote if contains comma, newline, or quote
          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="text-xs px-3 py-1.5 rounded cursor-pointer"
      style={{
        backgroundColor: 'var(--color-surface-hover)',
        color: 'var(--color-text-muted)',
      }}
    >
      {label}
    </button>
  );
}
