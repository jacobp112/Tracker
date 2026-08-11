export interface CodeRecord {
  hash: string;
  expiresAt: number;
  attempts: number;
}

export interface CodeStore {
  set(email: string, rec: CodeRecord): Promise<void>;
  get(email: string): Promise<CodeRecord | null>;
  delete(email: string): Promise<void>;
}

/** In-memory store for tests and local dev. Not for production (per-instance). */
export class MemoryCodeStore implements CodeStore {
  private map = new Map<string, CodeRecord>();
  async set(email: string, rec: CodeRecord) { this.map.set(email, rec); }
  async get(email: string) { return this.map.get(email) ?? null; }
  async delete(email: string) { this.map.delete(email); }
}
