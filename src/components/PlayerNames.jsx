/**
 * PlayerNames — renders a list of player names with sub badges for non-team members.
 * @param {string[]} names - Player names to render
 * @param {Set<string>} [teamMembers] - Set of canonical names belonging to the team
 * @param {string} [separator=' \u00B7 '] - Separator between names
 */
export default function PlayerNames({ names, teamMembers, separator = ' \u00B7 ' }) {
  if (!teamMembers) {
    return names.join(separator);
  }

  return names.map((name, i) => {
    const isSub = !teamMembers.has(name);
    return (
      <span key={name}>
        {i > 0 && separator}
        <span className={isSub ? 'italic' : ''}>
          {name}
        </span>
        {isSub && (
          <span
            className="ml-1 text-[10px] font-normal px-1 py-px rounded"
            style={{
              backgroundColor: 'var(--color-surface-hover)',
              color: 'var(--color-text-muted)',
              fontStyle: 'normal',
            }}
          >
            sub
          </span>
        )}
      </span>
    );
  });
}
