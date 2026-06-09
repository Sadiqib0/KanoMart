// Type surface for tests and the Vercel entrypoints. The implementation is
// plain JS (server.mjs); keep this in sync when exports change.
import type { IncomingMessage, ServerResponse, Server } from "node:http";

export type RequestHandler = ((request: IncomingMessage, response: ServerResponse) => Promise<void>) & {
  store?: any;
};

export interface InjectResult {
  status: number;
  headers: any;
  body: any;
}

export function createApp(options?: Record<string, unknown>): RequestHandler;
export function createMemoryStore(initial?: unknown): any;
export function createRemoteStoreApp(options?: Record<string, unknown>): Promise<RequestHandler>;
export function runMaintenanceTasks(): Promise<Record<string, number>>;
export function startServer(options?: Record<string, unknown>): Server;
export function inject(
  app: RequestHandler,
  request: { path: string; method?: string; headers?: any; body?: unknown },
): Promise<InjectResult>;

declare const handler: RequestHandler;
export default handler;
