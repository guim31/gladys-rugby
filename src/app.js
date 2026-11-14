// -----------------------------------------------------------------------------
// Registers every SDK handler on a GladysIntegration (or the SDK's fake Gladys
// in the tests) and returns the service, so index.js stays a few lines and the
// tests drive the very same wiring.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { competitionName } from './competitions.js';
import { normalizeConfig } from './config.js';
import { CHECK_TEXT, INIT_FAILED, ORDINAL } from './i18n.js';
import { createEspn } from './espn.js';
import { teamRank } from './matches.js';
import { SCENE_ACTIONS, teamSummary } from './scenes.js';
import { RugbyService } from './service.js';
import { createStore } from './store.js';
import { WIDGETS } from './widgets.js';

const logger = createLogger({ name: 'rugby-app' });

export const CHECK_ACTION = 'check';

/**
 * @param {object} gladys GladysIntegration instance
 * @param {object} [options] test seams: store, api, now, timeZone, timers
 */
export function registerHandlers(gladys, options = {}) {
  const service = new RugbyService({
    gladys,
    store: options.store ?? createStore(),
    api: options.api ?? createEspn(),
    now: options.now,
    timeZone: options.timeZone,
    timers: options.timers ?? true,
  });

  // Resolved once the service has started; every handler waits for it.
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let started = false;
  const whenReady =
    (fn) =>
    async (...args) => {
      await ready;
      return fn(...args);
    };

  gladys.on('connected', async () => {
    try {
      const config = normalizeConfig(await gladys.getConfig());
      if (started) {
        await service.resync(config);
        return;
      }
      started = true;
      await service.start(config);
    } catch (err) {
      logger.error('Initialization failed', err);
      // The handlers keep answering, with the defaults if need be.
      service.config ??= normalizeConfig({});
      await gladys.setConnectionStatus(false, INIT_FAILED).catch(() => {});
      // The next status report replaces this one.
      service.statusKey = null;
    } finally {
      resolveReady();
    }
  });

  gladys.onScanRequest(whenReady(() => service.serial(() => service.publishDevices())));

  gladys.onDeviceCreated(whenReady(() => service.deviceCreated()));
  gladys.onDeviceUpdated(whenReady(() => service.deviceChanged()));
  gladys.onDeviceDeleted(whenReady(() => service.deviceChanged()));

  gladys.onConfigUpdated(whenReady((config) => service.reconfigure(normalizeConfig(config))));

  gladys.onAction(
    CHECK_ACTION,
    whenReady(async () => {
      logger.info('Action "check": reading ESPN again');
      await service.check();
      return checkMessage(service);
    }),
  );

  for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
    gladys.onSceneAction(
      key,
      whenReady((fields) => handler(service, { fields })),
    );
  }

  for (const [key, widget] of Object.entries(WIDGETS)) {
    gladys.onWidgetGet(
      key,
      whenReady((request) => widget.get(service, request)),
    );
  }

  return { service, ready, stop: () => service.stop() };
}

/** The report of "Check", one text per language. */
export function checkMessage(service) {
  return Object.fromEntries(
    Object.entries(CHECK_TEXT).map(([language, text]) => [
      language,
      checkReport(service, text, language),
    ]),
  );
}

function checkReport(service, text, language) {
  const lines = [];
  const summary = service.summary();
  if (summary.length === 0) {
    lines.push(text.noCompetition);
  }
  for (const entry of summary) {
    lines.push(text.competition(competitionName(entry.key, language), entry.matches, entry.teams));
  }
  const followed = service.followedTeams();
  if (followed.length === 0) {
    lines.push('', text.noTeam);
  }
  for (const teamId of followed) {
    const team = teamSummary(service, teamId, language);
    const rank = teamRank(service.data, service.config.competitions, teamId);
    lines.push('', team.live || team.next, team.last);
    if (rank) {
      lines.push(
        text.rank(ORDINAL[language](rank.rank), competitionName(rank.competition, language)),
      );
    }
  }
  lines.push('', service.apiError ? text.stale(service.apiError) : text.fresh);
  return lines.join('\n');
}
