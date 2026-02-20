/**
 * Nick normalization — strips clan tags from in-game nicks before alias lookup.
 *
 * Uses clan_tag_patterns from team_config.json. Each pattern is a regex string.
 * Patterns starting with ^ strip a prefix. The pipe pattern \\| strips everything
 * up to and including the last pipe character.
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

      // Pipe pattern: strip everything before and including the last |
      if (src === '\\|') {
        const pipeIdx = result.lastIndexOf('|');
        if (pipeIdx !== -1) {
          result = result.slice(pipeIdx + 1);
        }
        continue;
      }

      // Prefix pattern (^...): strip the matching prefix
      result = result.replace(re, '');
    }

    return result.trim();
  };
}
