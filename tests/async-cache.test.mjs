import test from 'node:test';
import assert from 'node:assert/strict';
import { createAsyncCache } from '../lib/async-cache.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('concurrent consumers share one request and its result', async () => {
  const cache = createAsyncCache({ ttl: 1000 });
  const request = deferred();
  let calls = 0;
  const loader = () => { calls += 1; return request.promise; };
  const first = cache.get('repos', loader);
  const second = cache.get('repos', loader);

  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  const repos = [{ name: 'cloverslove' }];
  request.resolve(repos);
  assert.equal(await first, repos);
  assert.equal(await second, repos);
  assert.equal(await cache.get('repos', loader), repos);
  assert.equal(calls, 1);
});

test('a long-lived page revalidates after TTL instead of retaining a settled promise', async () => {
  let time = 0;
  let calls = 0;
  const cache = createAsyncCache({ ttl: 600_000, now: () => time });
  const loader = () => ++calls;

  assert.equal(await cache.get('repos', loader), 1);
  time = 599_999;
  assert.equal(await cache.get('repos', loader), 1);
  time = 600_000;
  assert.equal(await cache.get('repos', loader), 2);
  time = 1_200_000;
  assert.equal(await cache.get('repos', loader), 3);
});

test('TTL starts when loading completes, allowing slow responses a full cache lifetime', async () => {
  let time = 0;
  const request = deferred();
  const cache = createAsyncCache({ ttl: 100, now: () => time });
  const pending = cache.get('history', () => request.promise);
  time = 500;
  request.resolve('loaded');
  assert.equal(await pending, 'loaded');
  time = 599;
  assert.equal(await cache.get('history', () => 'refreshed'), 'loaded');
  time = 600;
  assert.equal(await cache.get('history', () => 'refreshed'), 'refreshed');
});

test('a failed request is retried instead of being cached as missing content', async () => {
  const cache = createAsyncCache({ ttl: 1000 });
  let calls = 0;
  const loader = () => {
    calls += 1;
    if (calls === 1) return Promise.reject(new Error('temporary network failure'));
    return '# Readme';
  };
  await assert.rejects(cache.get('readme/main', loader), /temporary network failure/);
  assert.equal(await cache.get('readme/main', loader), '# Readme');
  assert.equal(calls, 2);
});

test('a synchronous loader error also leaves the key retryable', async () => {
  const cache = createAsyncCache();
  await assert.rejects(cache.get('repos', () => { throw new Error('invalid response'); }), /invalid response/);
  assert.equal(await cache.get('repos', () => 'recovered'), 'recovered');
});

test('an explicit null result is cached until expiry', async () => {
  let time = 0;
  let calls = 0;
  const cache = createAsyncCache({ ttl: 30, now: () => time });
  const loader = () => { calls += 1; return null; };
  assert.equal(await cache.get('missing-readme', loader), null);
  time = 29;
  assert.equal(await cache.get('missing-readme', loader), null);
  assert.equal(calls, 1);
  time = 30;
  assert.equal(await cache.get('missing-readme', loader), null);
  assert.equal(calls, 2);
});

test('an invalidated in-flight result cannot replace newer data', async () => {
  const cache = createAsyncCache();
  const staleRequest = deferred();
  const stale = cache.get('repos', () => staleRequest.promise);
  cache.invalidate('repos');
  assert.equal(await cache.get('repos', () => 'new'), 'new');
  staleRequest.resolve('old');
  assert.equal(await stale, 'old');
  assert.equal(await cache.get('repos', () => 'unexpected reload'), 'new');
});

test('failure from an invalidated request cannot evict newer cached data', async () => {
  const cache = createAsyncCache();
  const staleRequest = deferred();
  const stale = cache.get('repos', () => staleRequest.promise);
  const rejected = assert.rejects(stale, /old request failed/);
  cache.invalidate('repos');
  assert.equal(await cache.get('repos', () => 'new'), 'new');
  staleRequest.reject(new Error('old request failed'));
  await rejected;
  assert.equal(await cache.get('repos', () => 'unexpected reload'), 'new');
});

test('clear evicts cached values for every key', async () => {
  const cache = createAsyncCache();
  await cache.get('one', () => 1);
  await cache.get('two', () => 2);
  cache.clear();
  assert.equal(await cache.get('one', () => 3), 3);
  assert.equal(await cache.get('two', () => 4), 4);
});
