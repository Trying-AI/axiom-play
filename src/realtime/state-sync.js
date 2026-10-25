const sameBoard = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => value === b[i]);
const copy = state => state ? { ...state, board: [...state.board] } : null;

// Networking is serialized here, independently of game rendering. A transaction
// is acknowledged before the next revision is sent. Fast input is coalesced into
// one pending snapshot; the server's moves counter counts saved snapshots.
export class StateSync {
  constructor({ save, read, progress, change = () => {}, notice = () => {} }) {
    this.save = save; this.read = read; this.progress = progress; this.change = change; this.notice = notice;
    this.canonical = null; this.board = null; this.queued = null; this.flight = null;
    this.connected = false; this.playable = false; this.reconciling = false; this.disposed = false; this.summarySaved = true;
  }
  get pending() { return Boolean(this.flight || this.queued); }
  get editable() { return !this.disposed && this.connected && this.playable && !this.reconciling && Boolean(this.canonical); }
  emit() {
    if (!this.disposed) this.change({ board: this.board ? [...this.board] : null, canonical: copy(this.canonical), pending: this.pending, editable: this.editable, reconciling: this.reconciling, summarySaved: this.summarySaved });
  }
  receive(state) {
    if (this.disposed || !state || !Array.isArray(state.board)) return;
    if (!this.canonical) { this.canonical = copy(state); this.board = [...state.board]; this.emit(); return; }
    if (state.revision <= this.canonical.revision) return;
    const isOurWrite = this.flight && state.revision === this.flight.expected.revision + 1 && sameBoard(state.board, this.flight.board);
    this.canonical = copy(state);
    if (isOurWrite) {
      if (!this.queued) this.board = [...state.board];
    } else {
      this.queued = null; this.board = [...state.board];
      if (this.flight) this.reconciling = true;
      this.notice('Another tab updated this board. Its saved revision has been restored.');
    }
    this.emit();
  }
  setPlayable(value) { this.playable = Boolean(value); if (!this.playable) this.queued = null; this.emit(); }
  async setConnected(value) {
    if (this.disposed) return;
    this.connected = Boolean(value);
    if (!value) { this.queued = null; this.emit(); return; }
    this.reconciling = true; this.emit();
    try {
      const state = await this.read();
      if (this.disposed || !this.connected) return;
      if (state) this.receive(state);
      // A disconnected transaction may still be waiting for its acknowledgement.
      if (!this.flight && this.canonical) { this.queued = null; this.board = [...this.canonical.board]; }
    } catch (error) { if (!this.disposed) { this.connected = false; this.notice(error.message || 'Could not restore the saved board.'); } }
    finally { if (!this.disposed) { this.reconciling = Boolean(this.flight); this.emit(); } }
  }
  edit(board) {
    if (!this.editable || sameBoard(board, this.board)) return false;
    this.board = [...board]; this.queued = [...board]; this.emit(); void this.flush(); return true;
  }
  async flush() {
    if (this.disposed || this.flight || !this.queued || !this.editable) return;
    const request = { board: this.queued, expected: copy(this.canonical) };
    this.queued = null; this.flight = request; this.emit();
    try {
      const { state, summarySaved = true } = await this.save(request.board, request.expected, this.progress(request.board));
      if (this.disposed) return;
      this.summarySaved = summarySaved;
      if (state.revision >= this.canonical.revision) this.canonical = copy(state);
      if (!this.queued || !this.connected || !this.playable || this.reconciling) {
        this.queued = null; this.board = [...this.canonical.board];
      }
    } catch (error) {
      if (this.disposed) return;
      this.queued = null; this.reconciling = true; this.emit();
      try {
        const state = await this.read();
        if (!this.disposed && state && state.revision >= (this.canonical?.revision || 0)) this.canonical = copy(state);
      } catch { /* Keep the last acknowledged state when offline. */ }
      if (this.disposed) return;
      this.board = this.canonical ? [...this.canonical.board] : null;
      this.notice(error.name === 'RevisionConflict' ? error.message : 'This move was not saved. The last acknowledged board has been restored.');
    } finally {
      if (!this.disposed) {
        this.flight = null; this.reconciling = false; this.emit();
        if (this.connected && this.playable) void this.flush();
      }
    }
  }
  destroy() { this.disposed = true; this.queued = null; this.change = () => {}; this.notice = () => {}; }
}
