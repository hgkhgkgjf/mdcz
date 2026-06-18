import type { AppRouter } from "@mdcz/server/router";
import type { TaskRealtimeEventDto, WebTaskUpdateDto } from "@mdcz/shared";
import type { Configuration } from "@mdcz/shared/config";
import { createTRPCClient, httpLink, type TRPCClient } from "@trpc/client";

const DEFAULT_API_BASE = "http://127.0.0.1:3838";
const API_BASE_KEY = "mdcz-web-api-base";
const TOKEN_KEY = "mdcz-admin-token";

export const getApiBase = (): string => localStorage.getItem(API_BASE_KEY) ?? DEFAULT_API_BASE;

export const setApiBase = (baseUrl: string): void => {
  const trimmed = baseUrl.trim().replace(/\/+$/u, "");
  if (!trimmed) {
    localStorage.removeItem(API_BASE_KEY);
    trpcCache = null;
    return;
  }
  localStorage.setItem(API_BASE_KEY, trimmed);
  trpcCache = null;
};

export const getAdminToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const setAdminToken = (token: string | undefined): void => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
};

const isRemoteImageUrl = (value: string): boolean => /^https?:\/\//iu.test(value.trim());

const encodePathSegments = (value: string): string =>
  value
    .split(/[\\/]+/u)
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export const getLibraryAssetSrc = (input: { rootId?: string | null; path: string | null | undefined }): string => {
  const assetPath = input.path?.trim();
  if (!assetPath) {
    return "";
  }
  if (isRemoteImageUrl(assetPath)) {
    return assetPath;
  }
  const rootId = input.rootId?.trim();
  if (!rootId) {
    return "";
  }
  const url = new URL(
    `/api/library/assets/${encodeURIComponent(rootId)}/${encodePathSegments(assetPath)}`,
    getApiBase(),
  );
  const token = getAdminToken();
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
};

const getAuthorizationHeaders = (): Record<string, string> => {
  const token = getAdminToken();
  if (!token) {
    return {};
  }
  return { authorization: `Bearer ${token}` };
};

let trpcCache: { baseUrl: string; client: TRPCClient<AppRouter> } | null = null;

const getTrpc = (): TRPCClient<AppRouter> => {
  const baseUrl = getApiBase();
  if (trpcCache?.baseUrl === baseUrl) {
    return trpcCache.client;
  }
  const client = createTRPCClient<AppRouter>({
    links: [
      httpLink({
        headers: getAuthorizationHeaders,
        methodOverride: "POST",
        url: `${baseUrl}/trpc`,
      }),
    ],
  });
  trpcCache = { baseUrl, client };
  return client;
};

type TrpcClient = TRPCClient<AppRouter>;
type FacadeProcedure<TProcedure> = TProcedure extends {
  query: (input: infer TInput, ...args: infer TRest) => infer TOutput;
}
  ? undefined extends TInput
    ? (input?: TInput, ...args: TRest) => TOutput
    : (input: TInput, ...args: TRest) => TOutput
  : TProcedure extends { mutate: (input: infer TInput, ...args: infer TRest) => infer TOutput }
    ? undefined extends TInput
      ? (input?: TInput, ...args: TRest) => TOutput
      : (input: TInput, ...args: TRest) => TOutput
    : TProcedure extends object
      ? { [TKey in keyof TProcedure as TKey extends symbol ? never : TKey]: FacadeProcedure<TProcedure[TKey]> }
      : never;
type TrpcFacade = FacadeProcedure<TrpcClient>;
type WebApiFacade = Omit<TrpcFacade, "config" | "maintenance"> & {
  config: Omit<TrpcFacade["config"], "read"> & {
    read: () => Promise<Configuration>;
  };
  maintenance: Omit<TrpcFacade["maintenance"], "execute"> & {
    apply: TrpcFacade["maintenance"]["execute"];
  };
};

export const api: WebApiFacade = {
  auth: {
    setup: () => getTrpc().auth.setup.query(undefined),
    login: async (input) => {
      const session = await getTrpc().auth.login.mutate(input);
      setAdminToken(session.token);
      return session;
    },
    logout: async () => {
      const session = await getTrpc().auth.logout.mutate(undefined);
      setAdminToken(undefined);
      return session;
    },
    status: () => getTrpc().auth.status.query(undefined),
  },
  app: {
    ensureWatermarkDirectory: () => getTrpc().app.ensureWatermarkDirectory.mutate(undefined),
  },
  browser: {
    list: (input) => getTrpc().browser.list.query(input),
  },
  crawler: {
    listSites: () => getTrpc().crawler.listSites.query(undefined),
    probeSiteConnectivity: (input) => getTrpc().crawler.probeSiteConnectivity.mutate(input),
  },
  network: {
    checkCookies: () => getTrpc().network.checkCookies.mutate(undefined),
  },
  translate: {
    testLlm: (input) => getTrpc().translate.testLlm.mutate(input),
  },
  serverPaths: {
    suggest: (input) => getTrpc().serverPaths.suggest.query(input),
  },
  config: {
    defaults: () => getTrpc().config.defaults.query(undefined),
    export: () => getTrpc().config.export.query(undefined),
    import: (input) => getTrpc().config.import.mutate(input),
    read: async () => (await getTrpc().config.read.query({})) as Configuration,
    previewNaming: (input) => getTrpc().config.previewNaming.mutate(input),
    reset: (input) => getTrpc().config.reset.mutate(input ?? {}),
    update: (input) => getTrpc().config.update.mutate(input),
    save: (input) => getTrpc().config.save.mutate(input),
    profiles: {
      list: () => getTrpc().config.profiles.list.query(undefined),
      create: (input) => getTrpc().config.profiles.create.mutate(input),
      switch: (input) => getTrpc().config.profiles.switch.mutate(input),
      delete: (input) => getTrpc().config.profiles.delete.mutate(input),
      export: (input) => getTrpc().config.profiles.export.mutate(input),
      import: (input) => getTrpc().config.profiles.import.mutate(input),
    },
  },
  health: {
    read: () => getTrpc().health.read.query(undefined),
  },
  system: {
    about: () => getTrpc().system.about.query(undefined),
  },
  logs: {
    list: (input) => getTrpc().logs.list.query(input),
    clearRuntime: () => getTrpc().logs.clearRuntime.mutate(undefined),
  },
  maintenance: {
    scanSelectedFiles: (input) => getTrpc().maintenance.scanSelectedFiles.query(input),
    apply: (input) => getTrpc().maintenance.execute.mutate(input),
    pause: (input) => getTrpc().maintenance.pause.mutate(input),
    preview: (input) => getTrpc().maintenance.preview.query(input),
    recover: () => getTrpc().maintenance.recover.query(undefined),
    resume: (input) => getTrpc().maintenance.resume.mutate(input),
    start: (input) => getTrpc().maintenance.start.mutate(input),
    stop: (input) => getTrpc().maintenance.stop.mutate(input),
  },
  library: {
    list: (input) => getTrpc().library.list.query(input),
    search: (input) => getTrpc().library.search.query(input),
    detail: (input) => getTrpc().library.detail.query(input),
    refresh: (input) => getTrpc().library.refresh.mutate(input),
    rescan: (input) => getTrpc().library.rescan.mutate(input),
    relink: (input) => getTrpc().library.relink.mutate(input),
    delete: (input) => getTrpc().library.delete.mutate(input),
  },
  overview: {
    summary: () => getTrpc().overview.summary.query(undefined),
    removeRecentAcquisition: (input) => getTrpc().overview.removeRecentAcquisition.mutate(input),
  },
  mediaRoots: {
    list: () => getTrpc().mediaRoots.list.query(undefined),
  },
  persistence: {
    status: () => getTrpc().persistence.status.query(undefined),
  },
  tools: {
    catalog: () => getTrpc().tools.catalog.query(undefined),
    execute: (input) => getTrpc().tools.execute.mutate(input),
  },
  scans: {
    candidates: (input) => getTrpc().scans.candidates.query(input),
    detail: (input) => getTrpc().scans.detail.query(input),
    events: (input) => getTrpc().scans.events.query(input),
    list: () => getTrpc().scans.list.query(undefined),
    retry: (input) => getTrpc().scans.retry.mutate(input),
    start: (input) => getTrpc().scans.start.mutate(input),
  },
  scrape: {
    startSelectedFiles: (input) => getTrpc().scrape.startSelectedFiles.mutate(input),
    deleteFile: (input) => getTrpc().scrape.deleteFile.mutate(input),
    listResults: (input) => getTrpc().scrape.listResults.query(input),
    getRecoverableSession: () => getTrpc().scrape.getRecoverableSession.query(undefined),
    nfoRead: (input) => getTrpc().scrape.nfoRead.query(input),
    nfoWrite: (input) => getTrpc().scrape.nfoWrite.mutate(input),
    pause: (input) => getTrpc().scrape.pause.mutate(input),
    result: (input) => getTrpc().scrape.result.query(input),
    resume: (input) => getTrpc().scrape.resume.mutate(input),
    retry: (input) => getTrpc().scrape.retry.mutate(input),
    confirmUncensored: (input) => getTrpc().scrape.confirmUncensored.mutate(input),
    resolveRecoverableSession: (input) => getTrpc().scrape.resolveRecoverableSession.mutate(input),
    start: (input) => getTrpc().scrape.start.mutate(input),
    stop: (input) => getTrpc().scrape.stop.mutate(input),
  },
  tasks: {
    detail: (input) => getTrpc().tasks.detail.query(input),
    events: (input) => getTrpc().tasks.events.query(input),
    list: () => getTrpc().tasks.list.query(undefined),
    retry: (input) => getTrpc().tasks.retry.mutate(input),
  },
  setup: {
    complete: async (input) => {
      const session = await getTrpc().setup.complete.mutate(input);
      setAdminToken(session.token);
      return session;
    },
    status: () => getTrpc().setup.status.query(undefined),
  },
};

const taskEventsUrl = (): string => {
  const token = getAdminToken();
  return `${getApiBase()}/events/tasks${token ? `?token=${encodeURIComponent(token)}` : ""}`;
};

const subscribeTaskEventSource = (handlers: {
  onEvent?: (payload: TaskRealtimeEventDto) => void;
  onUpdate?: (payload: WebTaskUpdateDto) => void;
}): (() => void) => {
  const eventSource = new EventSource(taskEventsUrl());
  eventSource.addEventListener("task-update", (event) => {
    handlers.onUpdate?.(JSON.parse(event.data) as WebTaskUpdateDto);
  });
  eventSource.addEventListener("task-event", (event) => {
    handlers.onEvent?.(JSON.parse(event.data) as TaskRealtimeEventDto);
  });
  return () => eventSource.close();
};

export const subscribeTaskUpdates = (onUpdate: (payload: WebTaskUpdateDto) => void): (() => void) => {
  return subscribeTaskEventSource({ onUpdate });
};

export const subscribeTaskEvents = (onEvent: (payload: TaskRealtimeEventDto) => void): (() => void) => {
  return subscribeTaskEventSource({ onEvent });
};

export const subscribeTaskRealtime = (handlers: {
  onEvent?: (payload: TaskRealtimeEventDto) => void;
  onUpdate?: (payload: WebTaskUpdateDto) => void;
}): (() => void) => {
  return subscribeTaskEventSource(handlers);
};
