// sdk/src/client.ts
export interface DexyClientOptions {
  apiKey: string;
  baseURL?: string;
  debug?: boolean;
  fetchImpl?: typeof fetch;
}

export interface RunOptions {
  prompt: string;
  meta?: Record<string, any>;
  stream?: boolean;
}

export interface SearchOptions {
  prompt: string;
  meta?: Record<string, any>;
}

export interface ExecuteOptions {
  agentId: string;
  input: any;
  meta?: Record<string, any>;
  stream?: boolean;
}

export interface SearchResult {
  agentId: string;
  confidence: number;
  raw?: any;
}

export interface Usage {
  tokens: number;
  cost: number;
  latencyMs: number;
}

export interface ExecuteResult {
  output: string;
  usage: Usage;
  agent?: { id?: string; name?: string | null };
  stream?: AsyncIterable<string>;
}

type SearchApiResponse = {
  ok?: boolean;
  results?: Array<Record<string, any>>;
  mode?: string;
  message?: string;
  error?: unknown;
};

type ExecuteApiResponse = {
  ok?: boolean;
  result?: { output?: string; summary?: string; formatted?: string };
  usage?: Usage;
  agent?: { id?: string; name?: string | null };
  normalized?: { output?: string; usage?: Usage };
  output?: string;
  error?: unknown;
};

type RunApiResponse = {
  output?: string;
  agent?: { id?: string; score?: number };
  usage?: Usage;
  cached?: boolean;
  error?: unknown;
};

export class DexyError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(
    message: string,
    options?: { code?: string; status?: number; details?: unknown }
  ) {
    super(message);
    this.name = "DexyError";
    this.code = options?.code ?? "UNKNOWN";
    this.status = options?.status ?? 500;
    this.details = options?.details;
  }

  static fromResponse(res: Response, payload?: any) {
    const status = res.status || 500;
    const code =
      payload?.error?.code ||
      payload?.code ||
      (typeof payload?.error === "string" ? payload.error : undefined) ||
      `HTTP_${status}`;
    const message =
      payload?.error?.message ||
      (typeof payload?.error === "string" ? payload.error : undefined) ||
      res.statusText ||
      "Request failed";

    return new DexyError(message, { code, status, details: payload });
  }
}

export class DexyClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly debug: boolean;

  private readonly fetch: typeof fetch;

  constructor(options: DexyClientOptions) {
    if (!options?.apiKey) {
      throw new DexyError("apiKey is required", {
        code: "API_KEY_REQUIRED",
        status: 400,
      });
    }

    this.apiKey = options.apiKey;
    this.baseURL = (options.baseURL ?? "https://api.dexy.run").replace(
      /\/$/,
      ""
    );
    this.debug = Boolean(options.debug);

    this.fetch =
      options.fetchImpl ??
      (globalThis.fetch
        ? globalThis.fetch.bind(globalThis)
        : (() => {
            throw new DexyError("global fetch is not available", {
              code: "FETCH_UNAVAILABLE",
              status: 500,
            });
          })());
  }

  async run(options: RunOptions): Promise<ExecuteResult> {
    if (!options?.prompt) {
      throw new DexyError("prompt is required", {
        code: "PROMPT_REQUIRED",
        status: 400,
      });
    }

    this._log("run:start", { stream: options.stream });

    const search = await this.search({
      prompt: options.prompt,
      meta: options.meta,
    });

    const exec = await this.execute({
      agentId: search.agentId,
      input: options.prompt,
      meta: options.meta,
      stream: options.stream,
    });

    this._log("run:done", { agentId: search.agentId });
    return exec;
  }

  async search(options: SearchOptions): Promise<SearchResult> {
    if (!options?.prompt) {
      throw new DexyError("prompt is required", {
        code: "PROMPT_REQUIRED",
        status: 400,
      });
    }

    this._log("search:start", {
      promptPreview: options.prompt.slice(0, 120),
      metaKeys: options.meta ? Object.keys(options.meta) : [],
    });

    const payload = await this._post<SearchApiResponse>("/api/search", {
      query: options.prompt,
      meta: options.meta,
    });

    const results = Array.isArray(payload?.results) ? payload.results : [];
    const best = results[0];

    const agentId = best ? this._pickAgentId(best) : "";

    if (!best || !agentId) {
      throw new DexyError("No suitable agent found", {
        code: "AGENT_NOT_FOUND",
        status: 404,
        details: payload,
      });
    }

    const result: SearchResult = {
      agentId,
      confidence:
        typeof best.fitness_score === "number"
          ? best.fitness_score
          : typeof best.similarity === "number"
          ? best.similarity
          : typeof best.confidence === "number"
          ? best.confidence
          : 0,
      raw: best,
    };

    this._log("search:result", {
      agentId: result.agentId,
      confidence: result.confidence,
    });

    return result;
  }

  async execute(options: ExecuteOptions): Promise<ExecuteResult> {
    if (!options?.agentId) {
      throw new DexyError("agentId is required", {
        code: "AGENT_ID_REQUIRED",
        status: 400,
      });
    }

    const execPath = `/api/execute/${encodeURIComponent(options.agentId)}`;

    if (options.stream) {
      this._log("execute:stream:start", { agentId: options.agentId });

      const stream = await this._stream(execPath, {
        query: options.input,
        input: options.input,
        meta: options.meta,
        stream: true,
      });

      return {
        output: "",
        usage: this._defaultUsage(),
        stream,
        agent: { id: options.agentId },
      };
    }

    const url = this._url(execPath);
    this._log("execute:start", { agentId: options.agentId, url });

    let res: Response;
    try {
      res = await this.fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query: options.input,
          input: options.input,
          meta: options.meta,
          stream: false,
        }),
      });
    } catch (error) {
      throw new DexyError((error as Error)?.message ?? "Network error", {
        code: "NETWORK_ERROR",
        status: 0,
        details: error,
      });
    }

    const rawText = await res.text();
    this._log("execute:response", {
      agentId: options.agentId,
      status: res.status,
      contentType: res.headers.get("content-type") ?? undefined,
      bodyPreview: this._truncate(rawText, 200),
    });

    let payload: ExecuteApiResponse | RunApiResponse | null = null;
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }

    if (!res.ok || (payload as any)?.ok === false) {
      throw DexyError.fromResponse(res, payload ?? { error: rawText });
    }

    const output =
      (payload as any)?.normalized?.output ??
      (payload as any)?.result?.formatted ??
      (payload as any)?.result?.output ??
      (payload as any)?.result?.summary ??
      (payload as any)?.output ??
      rawText;

    const usage = this._normalizeUsage(
      (payload as any)?.normalized?.usage ?? (payload as any)?.usage
    );

    return {
      output,
      usage,
      agent: (payload as any)?.agent ?? { id: options.agentId },
    };
  }

  // ---------- 내부 유틸 ----------

  private _defaultUsage(): Usage {
    return { tokens: 0, cost: 0, latencyMs: 0 };
  }

  private _normalizeUsage(usage?: Usage): Usage {
    if (!usage) return this._defaultUsage();
    return {
      tokens: usage.tokens ?? 0,
      cost: usage.cost ?? 0,
      latencyMs: usage.latencyMs ?? 0,
    };
  }

  private _pickAgentId(raw: Record<string, any>): string {
    return (
      (
        raw?.id ??
        raw?.agentId ??
        raw?.agent_id ??
        raw?.agentID
      )?.toString?.() ?? ""
    );
  }

  private _url(path: string) {
    return new URL(path, `${this.baseURL}/`).toString();
  }

  private _log(message: string, data?: unknown) {
    if (!this.debug) return;
    if (data !== undefined) {
      // eslint-disable-next-line no-console
      console.info(`[DexySDK] ${message}`, data);
    } else {
      // eslint-disable-next-line no-console
      console.info(`[DexySDK] ${message}`);
    }
  }

  private _truncate(text: string, limit: number) {
    if (text.length <= limit) return text;
    return `${text.slice(0, limit)}…`;
  }

  private async _post<T>(path: string, body: unknown): Promise<T> {
    let res: Response;

    try {
      res = await this.fetch(this._url(path), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body ?? {}),
      });
    } catch (error) {
      throw new DexyError((error as Error)?.message ?? "Network error", {
        code: "NETWORK_ERROR",
        status: 0,
        details: error,
      });
    }

    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (!res.ok || payload?.ok === false || payload?.error) {
      throw DexyError.fromResponse(res, payload);
    }

    return payload as T;
  }

  private async _stream(
    path: string,
    body: unknown
  ): Promise<AsyncIterable<string>> {
    let res: Response;

    try {
      res = await this.fetch(this._url(path), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body ?? {}),
      });
    } catch (error) {
      throw new DexyError((error as Error)?.message ?? "Network error", {
        code: "NETWORK_ERROR",
        status: 0,
        details: error,
      });
    }

    if (!res.ok || !res.body) {
      let payload: any = null;
      try {
        payload = await res.clone().json();
      } catch {
        payload = null;
      }
      throw DexyError.fromResponse(res, payload);
    }

    return this._parseEventStream(res);
  }

  private _parseEventStream(response: Response): AsyncIterable<string> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const parseEvent = (raw: string): { event?: string; data?: string } => {
      const lines = raw.split(/\r?\n/);
      let event: string | undefined;
      const data: string[] = [];

      for (const line of lines) {
        if (line.startsWith("event:")) {
          event = line.replace(/^event:\s*/, "").trim();
        } else if (line.startsWith("data:")) {
          data.push(line.replace(/^data:\s*/, ""));
        }
      }

      return { event, data: data.join("\n") };
    };

    return {
      async *[Symbol.asyncIterator]() {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const rawEvent = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const parsed = parseEvent(rawEvent.trim());

            if (!parsed.data) {
              boundary = buffer.indexOf("\n\n");
              continue;
            }

            if (parsed.data === "[DONE]" || parsed.event === "done") {
              return;
            }

            yield parsed.data;
            boundary = buffer.indexOf("\n\n");
          }
        }

        const trailing = decoder.decode();
        if (trailing.trim()) {
          yield trailing.trim();
        }
      },
    };
  }
}
