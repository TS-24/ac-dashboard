export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type Page<T> = {
  items: T[];
  total: number;
  limit?: number;
  offset?: number;
};

export type ConnectorStatus = "active" | "disabled" | "error";
export type SyncStatus = "pending" | "running" | "success" | "failed";

export type ConnectorConfig = {
  schedule?: string;
  enabled?: boolean;
  settings?: JsonObject;
};

export type Connector = {
  id: string;
  type: "declarative";
  name: string;
  status: ConnectorStatus;
  last_sync_at: string | null;
  last_sync_status: SyncStatus | null;
  error_count: number;
  config: ConnectorConfig;
  created_at: string;
  updated_at: string;
};

export type CreateConnectorInput = {
  type: "declarative";
  name: string;
  config?: ConnectorConfig;
};

export type UpdateConnectorInput = {
  name?: string;
  config?: ConnectorConfig;
  status?: ConnectorStatus;
};

export type SyncTrigger = {
  sync_run_id: string;
  status: SyncStatus;
  message?: string;
};

export type SyncRun = {
  id: string;
  connector_id: string;
  status: SyncStatus;
  started_at: string | null;
  finished_at: string | null;
  items_collected: number;
  items_normalized: number;
  events_created: number;
  error: string | null;
  metadata: JsonObject;
};

export type ConnectorHealth = {
  connector_id: string;
  status: ConnectorStatus;
  is_healthy: boolean;
  last_sync_at: string | null;
  last_sync_status: SyncStatus | null;
  last_error: string | null;
  error_count: number;
};

export type EventType =
  | "assignment.created"
  | "assignment.updated"
  | "grade.posted"
  | "email.received"
  | "email.updated"
  | "calendar_event.created"
  | "calendar_event.updated"
  | "calendar_event.deleted"
  | "item.created"
  | "item.updated"
  | "item.deleted";

export type Event = {
  id: string;
  source: string;
  type: EventType;
  timestamp: string;
  payload: JsonObject;
  metadata: JsonObject;
  created_at: string;
};

export type EventQuery = {
  type?: EventType;
  source?: string;
  connector_id?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
};

export type Snapshot = {
  id: string;
  connector_id: string;
  entity_type: string;
  external_id: string;
  data: JsonObject;
  version: number;
  updated_at: string | null;
};

export type SnapshotQuery = {
  connector_id?: string;
  entity_type?: string;
  external_id?: string;
  limit?: number;
  offset?: number;
};

export type CredentialStatus = {
  connector_id: string;
  has_credential: boolean;
  type: "username_password" | "oauth2" | null;
  keys: string[];
  has_browser_session: boolean;
  updated_at: string | null;
};

export type CredentialInput = {
  type: "username_password" | "oauth2";
  values: JsonObject;
};

export type SourceItem = {
  external_id: string;
  entity_type: string;
  data: JsonObject;
};

export type SourceItemQuery = {
  entity_type?: string;
  limit?: number;
  offset?: number;
};

export type Health = {
  status: "ok" | "degraded";
  version: string;
  database: string;
  uptime_seconds: number;
};

export type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
};

export type CreatedApiKey = ApiKey & { key: string };

export type PksApiClientOptions = {
  baseUrl: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
};

export class PksApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PksApiError";
    this.status = status;
    this.code = code;
  }
}

function queryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}

export class PksApiClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetcher: typeof globalThis.fetch;

  readonly health = {
    get: (): Promise<Health> => this.request("/health", { auth: false }),
  };

  readonly auth = {
    createKey: (input: { name: string }): Promise<CreatedApiKey> =>
      this.request("/auth/keys", { method: "POST", body: input, auth: false }),
    listKeys: (): Promise<Page<ApiKey>> => this.request("/auth/keys"),
    revokeKey: (keyId: string): Promise<void> =>
      this.request(`/auth/keys/${encodeURIComponent(keyId)}`, { method: "DELETE" }),
  };

  readonly connectors = {
    list: (query: { limit?: number; offset?: number } = {}): Promise<Page<Connector>> =>
      this.request(`/connectors${queryString(query)}`),
    get: (connectorId: string): Promise<Connector> => this.request(`/connectors/${this.id(connectorId)}`),
    create: (input: CreateConnectorInput): Promise<Connector> =>
      this.request("/connectors", { method: "POST", body: input }),
    update: (connectorId: string, input: UpdateConnectorInput): Promise<Connector> =>
      this.request(`/connectors/${this.id(connectorId)}`, { method: "PATCH", body: input }),
    delete: (connectorId: string): Promise<void> =>
      this.request(`/connectors/${this.id(connectorId)}`, { method: "DELETE" }),
    sync: (connectorId: string): Promise<SyncTrigger> =>
      this.request(`/connectors/${this.id(connectorId)}/sync`, { method: "POST" }),
    health: (connectorId: string): Promise<ConnectorHealth> =>
      this.request(`/connectors/${this.id(connectorId)}/health`),
    syncRuns: (
      connectorId: string,
      query: { limit?: number; offset?: number } = {},
    ): Promise<Page<SyncRun>> =>
      this.request(`/connectors/${this.id(connectorId)}/sync-runs${queryString(query)}`),
    getCredentials: (connectorId: string): Promise<CredentialStatus> =>
      this.request(`/connectors/${this.id(connectorId)}/credentials`),
    setCredentials: (connectorId: string, input: CredentialInput): Promise<CredentialStatus> =>
      this.request(`/connectors/${this.id(connectorId)}/credentials`, { method: "PUT", body: input }),
    deleteCredentials: (connectorId: string): Promise<void> =>
      this.request(`/connectors/${this.id(connectorId)}/credentials`, { method: "DELETE" }),
  };

  readonly events = {
    list: (query: EventQuery = {}): Promise<Page<Event>> => this.request(`/events${queryString(query)}`),
    get: (eventId: string): Promise<Event> => this.request(`/events/${this.id(eventId)}`),
  };

  readonly snapshots = {
    list: (query: SnapshotQuery = {}): Promise<Page<Snapshot>> =>
      this.request(`/snapshots${queryString(query)}`),
    get: (snapshotId: string): Promise<Snapshot> => this.request(`/snapshots/${this.id(snapshotId)}`),
  };

  readonly sources = {
    listItems: (source: string, query: SourceItemQuery = {}): Promise<Page<SourceItem>> =>
      this.request(`/sources/${this.source(source)}/items${queryString(query)}`),
    getItem: (source: string, externalId: string): Promise<SourceItem> =>
      this.request(`/sources/${this.source(source)}/items/${encodeURIComponent(externalId)}`),
    sync: (source: string): Promise<SyncTrigger & { source: string }> =>
      this.request(`/sources/${this.source(source)}/sync`, { method: "POST" }),
  };

  constructor(options: PksApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  private id(value: string): string {
    return encodeURIComponent(value);
  }

  private source(value: string): string {
    return encodeURIComponent(value);
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: JsonValue | { name: string }; auth?: boolean } = {},
  ): Promise<T> {
    const headers = new Headers({ Accept: "application/json" });
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    if (options.auth !== false && this.apiKey) headers.set("X-API-Key", this.apiKey);

    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => undefined)) as
        | { error?: { code?: string; message?: string } }
        | undefined;
      throw new PksApiError(
        response.status,
        payload?.error?.code ?? "UNKNOWN_ERROR",
        payload?.error?.message ?? `PKS API request failed with status ${response.status}`,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

export function createPksApiClient(): PksApiClient {
  return new PksApiClient({
    baseUrl: process.env.PKS_API_URL ?? "http://localhost:8001/api/v1",
    apiKey: process.env.PKS_API_KEY,
  });
}
