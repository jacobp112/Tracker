import assert from 'assert';

// 1. Mock localStorage for Node.js environment
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => {
    return store.has(key) ? store.get(key) : null;
  },
  setItem: (key, val) => {
    // Standard localStorage converts everything to string
    store.set(key, String(val));
  },
  removeItem: (key) => {
    store.delete(key);
  },
  clear: () => {
    store.clear();
  }
};

// Import modules to test
import { storageGet, storageSet, storageDelete } from './storage.js';
import { listTrackers, createTracker, archiveTracker, deleteTracker } from './trackerRegistry.js';
import { validateSchema, validateEntry } from './schema.js';
import { generateSlug, generateTemplate, generateAIPrompt, validateImport, applyImport } from './importPipeline.js';

console.log('Running Multi-Tracker Dashboard unit tests...');

function resetStorage() {
  store.clear();
}

// -------------------------------------------------------------
// 1. Storage Tests
// -------------------------------------------------------------
console.log('\n--- Running Storage Tests ---');

// Test basic get/set
resetStorage();
assert.ok(storageSet('test:key', { foo: 'bar' }));
assert.deepStrictEqual(storageGet('test:key', {}), { foo: 'bar' });
assert.strictEqual(store.get('test:key'), '{"foo":"bar"}');

// Test backup creation
assert.ok(storageSet('test:key', { foo: 'baz' }));
assert.strictEqual(store.get('test:key'), '{"foo":"baz"}');
assert.strictEqual(store.get('test:key:prev'), '{"foo":"bar"}');

// Test corruption recovery (primary corrupt, fallback to prev)
store.set('test:key', 'invalid json string here');
const retrieved = storageGet('test:key', { fallback: true });
// Should recover from prev
assert.deepStrictEqual(retrieved, { foo: 'bar' });
// Primary should be restored to the recovered value
assert.strictEqual(store.get('test:key'), '{"foo":"bar"}');
// Corrupt primary should be quarantined
assert.strictEqual(store.get('test:key:corrupt'), 'invalid json string here');

// Test double corruption fallback (both main and prev corrupt)
resetStorage();
storageSet('test:key', { version: 1 });
storageSet('test:key', { version: 2 });
store.set('test:key', '{corrupt}');
store.set('test:key:prev', '{corrupt}');
const doubleCorruptVal = storageGet('test:key', { default: true });
assert.deepStrictEqual(doubleCorruptVal, { default: true });
assert.strictEqual(store.get('test:key:corrupt'), '{corrupt}');
assert.strictEqual(store.get('test:key:prev:corrupt'), '{corrupt}');

// Test delete
resetStorage();
storageSet('test:key', { val: 1 });
storageDelete('test:key');
assert.strictEqual(store.has('test:key'), false);
assert.strictEqual(store.has('test:key:prev'), false);

console.log('✔ Storage tests passed!');

// -------------------------------------------------------------
// 2. Tracker Registry Tests
// -------------------------------------------------------------
console.log('\n--- Running Tracker Registry Tests ---');

resetStorage();
const trackers = listTrackers();
assert.deepStrictEqual(trackers, []);

// Create a tracker
const schema = [{ key: 'km', label: 'Kilometers', kind: 'number' }];
const created = createTracker('Running Log', 'log', schema);
assert.ok(created.id.startsWith('tr-'));
assert.strictEqual(created.name, 'Running Log');
assert.strictEqual(created.type, 'log');
assert.deepStrictEqual(created.schema, schema);
assert.strictEqual(created.archived, false);

// Check storage entries were created
assert.deepStrictEqual(storageGet(`tracker:${created.id}:meta`, null), created);
assert.deepStrictEqual(storageGet(`tracker:${created.id}:entries`, null), []);

// Check index was updated
const index = listTrackers();
assert.strictEqual(index.length, 1);
assert.strictEqual(index[0].id, created.id);
assert.strictEqual(index[0].name, 'Running Log');
assert.strictEqual(index[0].archived, false);

// Archive tracker
archiveTracker(created.id, true);
assert.strictEqual(storageGet(`tracker:${created.id}:meta`, null).archived, true);
assert.strictEqual(listTrackers()[0].archived, true);

// Delete tracker
deleteTracker(created.id);
assert.deepStrictEqual(listTrackers(), []);
assert.strictEqual(storageGet(`tracker:${created.id}:meta`, null), null);
assert.strictEqual(storageGet(`tracker:${created.id}:entries`, null), null);

console.log('✔ Tracker Registry tests passed!');

// -------------------------------------------------------------
// 3. Schema Tests
// -------------------------------------------------------------
console.log('\n--- Running Schema Validation Tests ---');

// Validate schema definitions
const validSchema = [
  { key: 'dist', label: 'Distance', kind: 'number', unit: 'km' },
  { key: 'date', label: 'Date Run', kind: 'date' },
  { key: 'feel', label: 'Feeling', kind: 'select', options: ['Great', 'Good', 'Tired'] }
];
assert.strictEqual(validateSchema(validSchema).ok, true);

const invalidSchema = [
  { key: '123badkey', label: 'Bad Key', kind: 'number' },
  { key: 'feel', label: 'Feeling', kind: 'select', options: [] } // empty options
];
const schemaRes = validateSchema(invalidSchema);
assert.strictEqual(schemaRes.ok, false);
assert.strictEqual(schemaRes.errors.length, 2);

// Validate entries
const schemaConfig = [
  { key: 'dist', label: 'Distance', kind: 'number' },
  { key: 'date', label: 'Date', kind: 'date' },
  { key: 'feeling', label: 'Feeling', kind: 'select', options: ['happy', 'neutral', 'sad'] }
];

// Valid entry
const validEntry = { dist: 5.4, date: '2026-07-16', feeling: 'happy' };
const v1 = validateEntry(validEntry, schemaConfig);
assert.strictEqual(v1.ok, true);
assert.strictEqual(v1.errors.length, 0);

// Invalid entries
const invalidEntry1 = { dist: 'not a number', date: '2026-13-45', feeling: 'invalid_option' };
const v2 = validateEntry(invalidEntry1, schemaConfig);
assert.strictEqual(v2.ok, false);
assert.strictEqual(v2.errors.length, 3); // 3 type mismatches

// Warnings (unrecognized keys)
const warningEntry = { dist: 5, extra_key: 'hello' };
const v3 = validateEntry(warningEntry, schemaConfig);
assert.strictEqual(v3.ok, true);
assert.strictEqual(v3.warnings.length, 1);
assert.ok(v3.warnings[0].includes('extra_key'));

console.log('✔ Schema tests passed!');

// -------------------------------------------------------------
// 4. Import Pipeline Tests
// -------------------------------------------------------------
console.log('\n--- Running Import Pipeline Tests ---');

resetStorage();
const mockTracker = createTracker('Running Log', 'log', [
  { key: 'dist', label: 'Distance', kind: 'number' },
  { key: 'date', label: 'Date', kind: 'date' }
]);

// Test prompt & template output structure
const prompt = generateAIPrompt('Running Log', 'log', mockTracker.schema);
assert.ok(prompt.includes('dist'));
assert.ok(prompt.includes('date'));

// Test validateImport log success
const logJsonStr = JSON.stringify([
  { dist: 10, date: '2026-07-16' },
  { dist: 12.5, date: '2026-07-17' }
]);
const valLog = validateImport(logJsonStr, mockTracker);
assert.strictEqual(valLog.ok, true);
assert.strictEqual(valLog.data.entries.length, 2);

// Test validateImport course success
const mockCourseTracker = createTracker('AAT L3', 'course', []);
const courseJsonStr = JSON.stringify([
  { section: 'Sec A', name: 'Topic 1', reference: 'P.1' },
  { section: 'Sec A', name: 'Topic 2' }
]);
const valCourse = validateImport(courseJsonStr, mockCourseTracker);
assert.strictEqual(valCourse.ok, true);
assert.strictEqual(valCourse.data.topics.length, 2);
assert.strictEqual(valCourse.data.topics[0].reference, 'P.1');
assert.strictEqual(valCourse.data.topics[1].reference, '');

// Test applyImport for course
applyImport(mockCourseTracker.id, mockCourseTracker, valCourse.data);
const storedTopics = storageGet(`tracker:${mockCourseTracker.id}:entries`, []);
assert.strictEqual(storedTopics.length, 2);
assert.strictEqual(storedTopics[0].name, 'Topic 1');
assert.strictEqual(storedTopics[0].status, 'Not Started');

// Test applyImport course merging (re-import with same topic keeps state)
storedTopics[0].status = 'Learning';
storedTopics[0].conf = '3';
storageSet(`tracker:${mockCourseTracker.id}:entries`, storedTopics);

// Re-import (e.g. updating reference or adding new ones)
const updatedCourseJson = JSON.stringify([
  { section: 'Sec A', name: 'Topic 1', reference: 'P.1 Revised' },
  { section: 'Sec A', name: 'Topic 2' },
  { section: 'Sec B', name: 'Topic 3' }
]);
const valCourse2 = validateImport(updatedCourseJson, mockCourseTracker);
applyImport(mockCourseTracker.id, mockCourseTracker, valCourse2.data);
const storedTopics2 = storageGet(`tracker:${mockCourseTracker.id}:entries`, []);

assert.strictEqual(storedTopics2.length, 3);
assert.strictEqual(storedTopics2[0].name, 'Topic 1');
assert.strictEqual(storedTopics2[0].reference, 'P.1 Revised');
assert.strictEqual(storedTopics2[0].status, 'Learning'); // preserved!
assert.strictEqual(storedTopics2[0].conf, '3');          // preserved!
assert.strictEqual(storedTopics2[2].name, 'Topic 3');
assert.strictEqual(storedTopics2[2].status, 'Not Started');

console.log('✔ Import Pipeline tests passed!');
console.log('\nALL TESTS PASSED SUCCESSFULLY! 🎉\n');
