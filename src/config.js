// -----------------------------------------------------------------------------
// Configuration: DEFAULT_CONFIG mirrors the manifest defaults (tied by
// test/manifest.test.js), and normalizeConfig() turns whatever Gladys sends
// (a field never saved is absent) into a complete, valid object. Nothing here
// throws.
// -----------------------------------------------------------------------------

import { COMPETITION_KEYS } from './competitions.js';

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const DEFAULT_CONFIG = {
  language: 'fr',
  competitions: ['top14', 'champions_cup', 'six_nations', 'nations_championship'],
};

/**
 * @param {object} [raw] the configuration sent by Gladys
 * @returns {object} DEFAULT_CONFIG's keys with valid values
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
    competitions: competitions(source.competitions),
  };
}

/**
 * The competitions read, in the order of the list (the first one holding a
 * team gives its rank). A multi_select is stored as an array; a string is
 * accepted too (comma separated). An absent field keeps the defaults, an
 * explicitly empty one reads nothing.
 */
function competitions(value) {
  if (value === undefined || value === null) {
    return [...DEFAULT_CONFIG.competitions];
  }
  const chosen = new Set(
    (Array.isArray(value) ? value : String(value).split(',')).map((key) => String(key).trim()),
  );
  return COMPETITION_KEYS.filter((key) => chosen.has(key));
}
