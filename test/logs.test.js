// -----------------------------------------------------------------------------
// The integration runs on its own clock (Gladys never polls the devices), and
// its logs stay quiet: nothing at info on a match day; a repeated failure
// logged once, its end logged once.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LYON_TOULOUSE, createWorld, fakeEspn, play } from './helpers/world.js';

/** Captures the lines of the SDK logger (console.log / console.error). */
function captureLogs(t) {
  const previous = process.env.LOG_LEVEL;
  delete process.env.LOG_LEVEL; // the default level: info
  t.after(() => {
    if (previous !== undefined) {
      process.env.LOG_LEVEL = previous;
    }
  });
  const lines = [];
  const keep = (prefix, ...args) => lines.push([prefix, ...args].map(String).join(' '));
  t.mock.method(console, 'log', keep);
  t.mock.method(console, 'error', keep);
  return {
    lines,
    at: (level) => lines.filter((line) => line.includes(`[${level}]`)),
    clear: () => lines.splice(0),
  };
}

const flush = async () => {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

test('the devices are never polled: the own timer reads live and fires the triggers', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-11-28T19:28:10Z') });
  const world = await createWorld({ timers: true });
  t.after(() => world.app.stop());
  for (const device of world.gladys.fake.discoveredDevices) {
    assert.equal(device.should_poll, false, 'Gladys 5.2.0 polls only should_poll devices');
    assert.equal(device.poll_frequency, undefined);
  }
  for (let minute = 0; minute < 3; minute += 1) {
    t.mock.timers.tick(60_000);
    await flush();
  }
  assert.deepEqual(
    world.gladys.fake.sceneEvents.map((event) => event.data.minutes_before),
    ['30'],
  );
});

test('a match day writes nothing at info: ticks, readings, triggers', async (t) => {
  const logs = captureLogs(t);
  const api = fakeEspn();
  const world = await createWorld({ api, at: '2026-11-28T08:00:00Z' });
  t.after(() => world.app.stop());
  logs.clear();
  await world.runUntil('2026-11-28T20:02:00Z');
  api.patch(LYON_TOULOUSE, (game) => play(game, { state: 'in', home: 0, away: 5 }));
  await world.runUntil('2026-11-28T21:00:00Z');
  api.patch(LYON_TOULOUSE, (game) => play(game, { state: 'post', home: 0, away: 5 }));
  await world.runUntil('2026-11-29T02:00:00Z');
  assert.equal(world.gladys.fake.sceneEvents.length, 6);
  assert.deepEqual(logs.lines, []);
});

test('repeated failures are logged once, their end once', async (t) => {
  const logs = captureLogs(t);
  const api = fakeEspn();
  const world = await createWorld({ api, at: '2026-11-28T19:00:00Z' });
  t.after(() => world.app.stop());
  // ESPN rate-limits us, and Gladys refuses states, statuses and scene
  // events, for an hour.
  api.status = 429;
  const down = async () => {
    throw new Error('Gladys is restarting');
  };
  const mocks = ['publishChangedStates', 'setConnectionStatus', 'publishSceneEvent'].map((name) =>
    t.mock.method(world.gladys, name, down),
  );
  await world.runUntil('2026-11-28T20:01:00Z');
  const warnings = logs.at('WARN');
  for (const pattern of [
    /Could not read ESPN: ESPN answered HTTP 429 \(rate limited\)/,
    /Could not report the status/,
    /Could not fire match_starting/,
  ]) {
    assert.equal(warnings.filter((line) => pattern.test(line)).length, 1, String(pattern));
  }
  assert.ok(warnings.length <= 4, warnings.join('\n'));
  assert.deepEqual(logs.at('INFO'), []);

  // Everything is back: one line per recovery, then silence.
  for (const mock of mocks) {
    mock.mock.restore();
  }
  api.status = 200;
  logs.clear();
  await world.runUntil('2026-11-28T20:15:00Z');
  assert.equal(logs.at('INFO').filter((line) => /ESPN read again/.test(line)).length, 1);
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
  logs.clear();
  await world.runUntil('2026-11-28T20:40:00Z');
  assert.deepEqual(logs.lines, []);
});
