import type { AssessmentAttempt, AssessmentDefinition } from '@/domain/assessment';

/**
 * Assessment-domain persistence — design §O. Lives in IndexedDB so bulky
 * definitions/attempts stay OFF the synchronous localStorage hot path (retention/
 * health/recommendations never touch this module). Async by nature; every write
 * is a transaction, and bulk `restore` is a SINGLE transaction so a failure aborts
 * the whole batch rather than leaving the store half-written.
 *
 * A `MemoryAssessmentRepo` mirrors the contract for tests and for graceful
 * degradation where IndexedDB is unavailable (e.g. a locked-down private window) —
 * the app stays local-first and never crashes for lack of it.
 */

export interface AssessmentSnapshot {
  assessments: AssessmentDefinition[];
  attempts: AssessmentAttempt[];
}

export interface AssessmentRepo {
  putDefinition(def: AssessmentDefinition): Promise<void>;
  getDefinition(id: string): Promise<AssessmentDefinition | undefined>;
  allDefinitions(): Promise<AssessmentDefinition[]>;
  deleteDefinition(id: string): Promise<void>;
  putAttempt(attempt: AssessmentAttempt): Promise<void>;
  getAttempt(id: string): Promise<AssessmentAttempt | undefined>;
  attemptsFor(assessmentId: string): Promise<AssessmentAttempt[]>;
  allAttempts(): Promise<AssessmentAttempt[]>;
  /** Read the whole domain — for backup. */
  dump(): Promise<AssessmentSnapshot>;
  /** Atomically REPLACE the whole domain — for restore. All-or-nothing. */
  restore(snapshot: AssessmentSnapshot): Promise<void>;
  clear(): Promise<void>;
}

const DEFS = 'definitions';
const ATTEMPTS = 'attempts';
const BY_ASSESSMENT = 'by_assessment';

export class IndexedDbAssessmentRepo implements AssessmentRepo {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly dbName = 'cairn-assessments') {}

  private db(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const open = indexedDB.open(this.dbName, 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(DEFS)) db.createObjectStore(DEFS, { keyPath: 'assessment_id' });
        if (!db.objectStoreNames.contains(ATTEMPTS)) {
          const store = db.createObjectStore(ATTEMPTS, { keyPath: 'attempt_id' });
          store.createIndex(BY_ASSESSMENT, 'assessment_id', { unique: false });
        }
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('Could not open the assessment store.'));
    });
    return this.dbPromise;
  }

  private async run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      req.onsuccess = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  }

  putDefinition(def: AssessmentDefinition) { return this.run(DEFS, 'readwrite', (s) => s.put(def)).then(() => undefined); }
  getDefinition(id: string) { return this.run<AssessmentDefinition | undefined>(DEFS, 'readonly', (s) => s.get(id) as IDBRequest<AssessmentDefinition | undefined>); }
  allDefinitions() { return this.run<AssessmentDefinition[]>(DEFS, 'readonly', (s) => s.getAll() as IDBRequest<AssessmentDefinition[]>); }
  deleteDefinition(id: string) { return this.run(DEFS, 'readwrite', (s) => s.delete(id)).then(() => undefined); }

  putAttempt(a: AssessmentAttempt) { return this.run(ATTEMPTS, 'readwrite', (s) => s.put(a)).then(() => undefined); }
  getAttempt(id: string) { return this.run<AssessmentAttempt | undefined>(ATTEMPTS, 'readonly', (s) => s.get(id) as IDBRequest<AssessmentAttempt | undefined>); }
  allAttempts() { return this.run<AssessmentAttempt[]>(ATTEMPTS, 'readonly', (s) => s.getAll() as IDBRequest<AssessmentAttempt[]>); }

  async attemptsFor(assessmentId: string) {
    const db = await this.db();
    return new Promise<AssessmentAttempt[]>((resolve, reject) => {
      const tx = db.transaction(ATTEMPTS, 'readonly');
      const req = tx.objectStore(ATTEMPTS).index(BY_ASSESSMENT).getAll(assessmentId) as IDBRequest<AssessmentAttempt[]>;
      req.onsuccess = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    });
  }

  async dump(): Promise<AssessmentSnapshot> {
    const [assessments, attempts] = await Promise.all([this.allDefinitions(), this.allAttempts()]);
    return { assessments, attempts };
  }

  async restore(snapshot: AssessmentSnapshot): Promise<void> {
    const db = await this.db();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([DEFS, ATTEMPTS], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Restore failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('Restore aborted — no changes were written.'));
      try {
        const defs = tx.objectStore(DEFS);
        const atts = tx.objectStore(ATTEMPTS);
        defs.clear();
        atts.clear();
        for (const d of snapshot.assessments) defs.put(d);
        for (const a of snapshot.attempts) atts.put(a);
      } catch (e) {
        // A synchronous put failure (e.g. a record missing its key) must abort the
        // whole transaction so the clears above roll back too — no partial write.
        try { tx.abort(); } catch { /* already aborting */ }
        reject(e instanceof Error ? e : new Error('Restore failed.'));
      }
    });
  }

  clear(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db().then((db) => {
        const tx = db.transaction([DEFS, ATTEMPTS], 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Clear failed'));
        tx.objectStore(DEFS).clear();
        tx.objectStore(ATTEMPTS).clear();
      }, reject);
    });
  }
}

/** In-memory mirror — tests and graceful degradation. Same all-or-nothing
 *  semantics: `restore` swaps a freshly-built state in only on success. */
export class MemoryAssessmentRepo implements AssessmentRepo {
  private defs = new Map<string, AssessmentDefinition>();
  private attempts = new Map<string, AssessmentAttempt>();

  async putDefinition(def: AssessmentDefinition) { this.defs.set(def.assessment_id, structuredClone(def)); }
  async getDefinition(id: string) { const d = this.defs.get(id); return d ? structuredClone(d) : undefined; }
  async allDefinitions() { return [...this.defs.values()].map((d) => structuredClone(d)); }
  async deleteDefinition(id: string) { this.defs.delete(id); }
  async putAttempt(a: AssessmentAttempt) { this.attempts.set(a.attempt_id, structuredClone(a)); }
  async getAttempt(id: string) { const a = this.attempts.get(id); return a ? structuredClone(a) : undefined; }
  async allAttempts() { return [...this.attempts.values()].map((a) => structuredClone(a)); }
  async attemptsFor(assessmentId: string) { return (await this.allAttempts()).filter((a) => a.assessment_id === assessmentId); }
  async dump() { return { assessments: await this.allDefinitions(), attempts: await this.allAttempts() }; }

  async restore(snapshot: AssessmentSnapshot) {
    const defs = new Map<string, AssessmentDefinition>();
    const attempts = new Map<string, AssessmentAttempt>();
    for (const d of snapshot.assessments) {
      if (!d.assessment_id) throw new Error('Definition is missing its id.');
      defs.set(d.assessment_id, structuredClone(d));
    }
    for (const a of snapshot.attempts) {
      if (!a.attempt_id) throw new Error('Attempt is missing its id.');
      attempts.set(a.attempt_id, structuredClone(a));
    }
    this.defs = defs; // swap only after both built successfully
    this.attempts = attempts;
  }

  async clear() { this.defs.clear(); this.attempts.clear(); }
}

let singleton: AssessmentRepo | null = null;

/** The app-wide repo: IndexedDB where available, in-memory otherwise (local-first
 *  never crashes for lack of IndexedDB — the assessment domain just won't persist
 *  across reloads in that degraded environment). */
export function getAssessmentRepo(): AssessmentRepo {
  if (singleton) return singleton;
  singleton = typeof indexedDB !== 'undefined' ? new IndexedDbAssessmentRepo() : new MemoryAssessmentRepo();
  return singleton;
}
