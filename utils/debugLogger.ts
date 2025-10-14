
interface LogEntry {
  timestamp: Date;
  type: string;
  payload: any;
}

class DebugLogger {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  log(type: string, payload: any) {
    if (this.logs.length > 50) {
        this.logs.shift(); // Keep log size manageable
    }
    const entry = { timestamp: new Date(), type, payload };
    this.logs.push(entry);
    console.log(`[DebugLogger] ${type}:`, payload); // Also log to browser console
    this.listeners.forEach(l => l([...this.logs]));
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
    this.listeners.forEach(l => l([]));
  }

  subscribe(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.push(listener);
    // Return an unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const logger = new DebugLogger();
