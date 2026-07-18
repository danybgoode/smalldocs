/**
 * report-registry.js unit tests: slug validation, object-path mapping, bucket resolution — the pure
 * parts, no network. (The live GET /api/report/:slug + /r/:slug route behavior is covered in
 * test-http.js against a local fixture server via REPORT_REGISTRY_STORAGE_BASE_URL.)
 */
const path = require('path');

module.exports = function (harness) {
  const { assert, test } = harness;

  console.log('\n── report-registry: pure logic ──────────────────\n');

  const {
    DEFAULT_BUCKET,
    isValidSlug,
    objectPathForSlug,
    resolveBucket,
    resolveStorageBaseUrl,
    buildObjectUrl,
  } = require(path.join(__dirname, '..', 'report-registry'));

  test('DEFAULT_BUCKET is the canonical prod bucket (matches infra/gcp/provision-report-registry.sh)', () => {
    assert.strictEqual(DEFAULT_BUCKET, 'miyagi-pmo-reports');
  });

  test('isValidSlug accepts real slug shapes', () => {
    assert.ok(isValidSlug('daily-story-2026-07-17-ab12cd'));
    assert.ok(isValidSlug('pmo-weekly-2026-07-17'));
    assert.ok(isValidSlug('pmo-monthly-2026-07-17'));
    assert.ok(isValidSlug('pmo-sheet-2026-07-17'));
  });

  test('isValidSlug rejects path traversal / unsafe characters', () => {
    assert.strictEqual(isValidSlug('../secret'), false);
    assert.strictEqual(isValidSlug('a/b'), false);
    assert.strictEqual(isValidSlug('a b'), false);
    assert.strictEqual(isValidSlug('a<script>'), false);
    assert.strictEqual(isValidSlug(''), false);
  });

  test('isValidSlug rejects non-string input without throwing', () => {
    assert.strictEqual(isValidSlug(undefined), false);
    assert.strictEqual(isValidSlug(null), false);
    assert.strictEqual(isValidSlug(42), false);
  });

  test('objectPathForSlug: daily-* slugs map under daily/ (90d TTL)', () => {
    assert.strictEqual(objectPathForSlug('daily-story-2026-07-17-ab12cd'), 'daily/daily-story-2026-07-17-ab12cd.md');
  });

  test('objectPathForSlug: everything else maps under packets/ (kept forever)', () => {
    assert.strictEqual(objectPathForSlug('pmo-weekly-2026-07-17'), 'packets/pmo-weekly-2026-07-17.md');
    assert.strictEqual(objectPathForSlug('pmo-monthly-2026-07-17'), 'packets/pmo-monthly-2026-07-17.md');
    assert.strictEqual(objectPathForSlug('pmo-sheet-2026-07-17'), 'packets/pmo-sheet-2026-07-17.md');
  });

  test('resolveBucket defaults to prod; REPORT_REGISTRY_BUCKET overrides', () => {
    assert.strictEqual(resolveBucket({}), 'miyagi-pmo-reports');
    assert.strictEqual(resolveBucket({ REPORT_REGISTRY_BUCKET: 'miyagi-pmo-reports-staging' }), 'miyagi-pmo-reports-staging');
  });

  test('resolveStorageBaseUrl defaults to storage.googleapis.com; test-only override works', () => {
    assert.strictEqual(resolveStorageBaseUrl({}), 'https://storage.googleapis.com');
    assert.strictEqual(
      resolveStorageBaseUrl({ REPORT_REGISTRY_STORAGE_BASE_URL: 'http://localhost:9999' }),
      'http://localhost:9999'
    );
  });

  test('buildObjectUrl composes base + bucket + object path', () => {
    assert.strictEqual(
      buildObjectUrl({ slug: 'daily-story-2026-07-17-ab12cd', env: {} }),
      'https://storage.googleapis.com/miyagi-pmo-reports/daily/daily-story-2026-07-17-ab12cd.md'
    );
    assert.strictEqual(
      buildObjectUrl({
        slug: 'pmo-weekly-2026-07-17',
        env: { REPORT_REGISTRY_BUCKET: 'miyagi-pmo-reports-staging' },
      }),
      'https://storage.googleapis.com/miyagi-pmo-reports-staging/packets/pmo-weekly-2026-07-17.md'
    );
  });
};
