import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import { sanitizeMessage } from "@/lib/security";

type RpcResponse = { id?: number; result?: unknown; error?: { code?: number; message?: string } };
type Notification = { method: string; params?: unknown };

export class JsonRpcError extends Error {
  constructor(public readonly code: number | undefined, message: string) {
    super(message);
    this.name = "JsonRpcError";
  }
}

export class CodexRpcClient {
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private nextId = 1;
  private readonly process: ChildProcessWithoutNullStreams;
  private readonly notifications = new Set<(notification: Notification) => void>();
  private readonly lineReader: readline.Interface;

  constructor(command: string, codexHome: string) {
    this.process = spawn(command, ["app-server", "--stdio"], {
      env: { ...process.env, CODEX_HOME: codexHome, CODEX_ANALYTICS_ENABLED: "false" },
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });
    this.lineReader = readline.createInterface({ input: this.process.stdout });
    this.lineReader.on("line", (line) => this.handleLine(line));
    this.process.on("exit", () => {
      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`Codex App Server exited while request ${id} was pending`));
      }
      this.pending.clear();
    });
  }

  onNotification(handler: (notification: Notification) => void) {
    this.notifications.add(handler);
    return () => this.notifications.delete(handler);
  }

  async request<T>(method: string, params?: unknown, timeoutMs = 20_000): Promise<T> {
    const id = this.nextId++;
    const payload = JSON.stringify({ method, id, ...(params === undefined ? {} : { params }) });
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      this.process.stdin.write(`${payload}\n`);
    });
  }

  async initialize() {
    await this.request("initialize", {
      clientInfo: { name: "codex-usage-manager", title: "Codex Usage Manager", version: "0.1.0" },
      capabilities: {},
    });
    this.process.stdin.write(`${JSON.stringify({ method: "initialized", params: {} })}\n`);
  }

  async close() {
    this.lineReader.close();
    if (!this.process.killed) this.process.kill();
  }

  private handleLine(line: string) {
    if (!line.trim()) return;
    let message: RpcResponse | Notification;
    try {
      message = JSON.parse(line) as RpcResponse | Notification;
    } catch {
      return;
    }
    if (typeof (message as RpcResponse).id === "number") {
      const response = message as RpcResponse;
      const pending = this.pending.get(response.id!);
      if (!pending) return;
      this.pending.delete(response.id!);
      clearTimeout(pending.timer);
      if (response.error) pending.reject(new JsonRpcError(response.error.code, sanitizeMessage(response.error.message)));
      else pending.resolve(response.result);
      return;
    }
    const notification = message as Notification;
    if (notification.method) for (const handler of this.notifications) handler(notification);
  }
}

