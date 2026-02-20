/**
 * Nick normalization — strips clan tags from in-game nicks before alias lookup.
 *
 * Uses clan_tag_patterns from team_config.json. Each pattern is a regex string.
 * Patterns starting with ^ strip a prefix. The pipe pattern \\| just deletes the
 * pipe character (e.g. ph0en|X → ph0enX).
 */

/**
 * Build a normalizer function from clan_tag_patterns.
 * @param {string[]} patterns - regex pattern strings from team_config.json
 * @returns {function(string): string} normalizer
 */
export function buildNickNormalizer(patterns) {
  if (!patterns || patterns.length === 0) {
    return (nick) => nick;
  }

  // Pre-compile the regexes
  const compiled = patterns.map((p) => new RegExp(p, 'i'));

  return function normalizeNick(nick) {
    let result = nick;

    for (const re of compiled) {
      const src = re.source;

      // Apply the pattern — works for both prefix patterns and the pipe pattern.
      // Prefix patterns (^CUBA etc.) strip the matched prefix.
      // Pipe pattern (\\|) deletes the pipe character: ph0en|X → ph0enX.
      result = result.replace(re, '');
    }

    return result.trim();
  };
}
