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
  inputSchema?: Record<string, unknown> | string;
  annotations?: WebMCPToolAnnotations;
  origin?: string;
}

export type WebMCPToolChangeListener = (event: Event) => void;

export interface ModelContextLike {
  registerTool(tool: WebMCPTool, options?: { exposedTo?: string[]; signal?: AbortSignal }): void | Promise<void>;
  getTools(options?: { fromOrigins?: string[] }): Promise<RegisteredWebMCPTool[]>;
  executeTool?(tool: RegisteredWebMCPTool, input: Record<string, unknown> | string, options?: { signal?: AbortSignal }): Promise<unknown>;
  addEventListener?(type: "toolchange", listener: WebMCPToolChangeListener): void;
  removeEventListener?(type: "toolchange", listener: WebMCPToolChangeListener): void;
  ontoolchange?: WebMCPToolChangeListener | null;
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
  const context = typeof document === "undefined" ? undefined : document.modelContext;
  if (!context?.registerTool) return () => undefined;
  const controller = new AbortController();

  try {
    void Promise.resolve(context.registerTool(tool, { exposedTo: options.exposedTo, signal: controller.signal }))
      .catch((error) => options.onError?.(error));
  } catch (error) {
    options.onError?.(error);
  }

  return () => controller.abort();
}

export async function getWebMCPTools(fromOrigins?: string[]): Promise<RegisteredWebMCPTool[]> {
  const context = typeof document === "undefined" ? undefined : document.modelContext;
  if (!context?.getTools) return [];
  return context.getTools(fromOrigins ? { fromOrigins } : undefined);
}

export async function executeWebMCPTool(tool: RegisteredWebMCPTool, input: Record<string, unknown>): Promise<unknown> {
  const context = typeof document === "undefined" ? undefined : document.modelContext;
  if (!context?.executeTool) throw new Error("PROVIDER_UNAVAILABLE");
  const result = await context.executeTool(tool, JSON.stringify(input));
  if (typeof result !== "string") return result;
  try {
    return JSON.parse(result) as unknown;
  } catch {
    return result;
  }
}
export function subscribeWebMCPToolChanges(listener: WebMCPToolChangeListener): () => void {
  const context = typeof document === "undefined" ? undefined : document.modelContext;
  if (!context) return () => undefined;

  if (context.addEventListener) {
    context.addEventListener("toolchange", listener);
    return () => context.removeEventListener?.("toolchange", listener);
  }

  const previous = context.ontoolchange ?? null;
  context.ontoolchange = listener;
  return () => {
    if (context.ontoolchange === listener) context.ontoolchange = previous;
  };
}
