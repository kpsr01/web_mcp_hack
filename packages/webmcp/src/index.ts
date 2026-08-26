export interface WebMCPToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface WebMCPExecuteOptions {
  signal: AbortSignal;
}

export interface WebMCPTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: WebMCPToolAnnotations;
  execute: (input: Record<string, unknown>, options: WebMCPExecuteOptions) => Promise<unknown> | unknown;
}

export interface RegisteredWebMCPTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: WebMCPToolAnnotations;
  origin?: string;
}

export interface ModelContextLike {
  registerTool(tool: WebMCPTool, options?: { exposedTo?: string[]; signal?: AbortSignal }): Promise<void>;
  getTools(options?: { fromOrigins?: string[] }): Promise<RegisteredWebMCPTool[]>;
  executeTool?(tool: RegisteredWebMCPTool, input: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown>;
  ontoolchange: ((event: Event) => void) | null;
}

declare global {
  interface Document {
    modelContext?: ModelContextLike;
  }
}

export function hasWebMCP(): boolean {
  return typeof document !== "undefined" && Boolean(document.modelContext?.registerTool);
}

export function registerWebMCPTool(
  tool: WebMCPTool,
  options: { exposedTo?: string[]; onError?: (error: unknown) => void } = {},
): () => void {
  if (!document.modelContext) return () => undefined;

  const controller = new AbortController();
  void document.modelContext
    .registerTool(tool, { exposedTo: options.exposedTo, signal: controller.signal })
    .catch((error) => options.onError?.(error));

  return () => controller.abort();
}

export async function getWebMCPTools(fromOrigins?: string[]): Promise<RegisteredWebMCPTool[]> {
  if (!document.modelContext) return [];
  return document.modelContext.getTools(fromOrigins ? { fromOrigins } : undefined);
}
