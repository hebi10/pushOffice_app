/** Late native completions may update UI only for the same source, request and foreground visit. */
export class ForegroundRequest {
    private revision = 0;
    private source = '';
    private active = false;
    setSource(source: string) { if (source !== this.source) { this.source = source; this.revision++; } }
    setActive(active: boolean) { this.active = active; this.revision++; }
    begin() { const revision = ++this.revision; return () => this.active && revision === this.revision; }
}
export async function runForegroundRequest<T>(valid: () => boolean, request: () => Promise<T>, handlers: { result(value: T): void; error(error: unknown): void; finish(): void }) {
    try { const value = await request(); if (valid()) handlers.result(value); }
    catch (error) { if (valid()) handlers.error(error); }
    finally { if (valid()) handlers.finish(); }
}
