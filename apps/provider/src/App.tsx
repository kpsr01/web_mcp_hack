import { useEffect, useState } from "react";
import { hasWebMCP, registerWebMCPTool } from "@weave/webmcp";
import { getProvider } from "./providers";

const provider = getProvider(import.meta.env.VITE_PROVIDER_KIND);
const weaveOrigin = import.meta.env.VITE_WEAVE_ORIGIN ?? "http://localhost:3000";

export function App() {
  const [lastAction, setLastAction] = useState<string>("Waiting for an agent call…");

  useEffect(() => {
    const cleanups = provider.tools.map((tool) => registerWebMCPTool(tool, {
      exposedTo: [weaveOrigin],
      onError: (error) => setLastAction(`Registration error: ${String(error)}`),
    }));
    const onAction = (event: Event) => {
      const detail = (event as CustomEvent<{ tool: string; result?: unknown }>).detail;
      const result = detail.result && typeof detail.result === "object" && !Array.isArray(detail.result)
        ? detail.result as Record<string, unknown>
        : {};
      const status = typeof result.status === "string" ? ` · ${result.status}` : "";
      const code = typeof result.code === "string" ? ` · ${result.code}` : "";
      const privacy = typeof result.privacy === "string" ? ` · ${result.privacy}` : "";
      setLastAction(`Tool executed: ${detail.tool}${status}${code}${privacy}`);
    };
    window.addEventListener("weave-provider-action", onAction);
    return () => { cleanups.forEach((cleanup) => cleanup()); window.removeEventListener("weave-provider-action", onAction); };
  }, []);

  return <main>
    <header><div><span>{provider.kind.toUpperCase()}</span><h1>{provider.name}</h1></div><strong className={hasWebMCP() ? "ok" : "warn"}>{hasWebMCP() ? "WebMCP ready" : "WebMCP off"}</strong></header>
    <p>{provider.strapline}</p>
    <div className="tools">{provider.tools.map((tool) => <div key={tool.name}><code>{tool.name}</code><small>{tool.annotations?.readOnlyHint ? "READ" : "WRITE"}</small></div>)}</div>
    <footer>{lastAction}</footer>
  </main>;
}
