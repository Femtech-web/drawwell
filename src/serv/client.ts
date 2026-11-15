const BASE_URL = process.env.SERV_BASE_URL ?? "https://inference-api.openserv.ai/v1";

export interface ServFeatures {
  model: string;
  multipath: boolean;
  kronos: boolean;
  promptGuard: boolean;
  shadow: { hint: string; maxIterations: number } | null;
  reasoningEffort?: "none" | "low" | "medium" | "high";
}

export interface ServRequest {
  system: string;
  user: string;
  features: ServFeatures;
  schema?: { name: string; schema: Record<string, unknown> };
  timeoutMs?: number;
}

export interface ServResponse {
  content: string;
  modelId: string;
  servedModel: string;
  latencyMs: number;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  requestId: string | null;
  finishReason: string | null;
}

export class ServError extends Error {
  constructor(message: string, readonly status: number, readonly body: string) {
    super(message);
  }
}

export function modelId(f: ServFeatures): string {
  const suffix = [f.kronos && "kronos", f.multipath && "multipath"].filter(Boolean).join("-");
  return suffix ? `${f.model}-serv-${suffix}` : f.model;
}

function servTools(f: ServFeatures) {
  const tools: Record<string, unknown>[] = [];
  if (f.promptGuard) tools.push({ type: "function", function: { name: "serv_prompt_guard" } });
  if (f.shadow) {
    tools.push({
      type: "function",
      function: {
        name: "serv_shadow_agent",
        parameters: {
          type: "object",
          properties: {
            hint: { type: "string", default: f.shadow.hint },
            max_iterations: { type: "integer", default: f.shadow.maxIterations },
          },
        },
      },
    });
  }
  return tools;
}

export function servConfigured(): boolean {
  return Boolean(process.env.SERV_API_KEY);
}

export async function servChat(req: ServRequest): Promise<ServResponse> {
  const key = process.env.SERV_API_KEY;
  if (!key) throw new ServError("SERV_API_KEY is not set", 0, "");
  const id = modelId(req.features);
  const tools = servTools(req.features);
  const body: Record<string, unknown> = {
    model: id,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
  };
  if (tools.length) body.tools = tools;
  if (req.schema) {
    body.response_format = { type: "json_schema", json_schema: { name: req.schema.name, strict: true, schema: req.schema.schema } };
  }
  if (req.features.reasoningEffort) body.reasoning_effort = req.features.reasoningEffort;

  const started = Date.now();
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(req.timeoutMs ?? 240_000),
  });
  const text = await res.text();
  if (!res.ok) throw new ServError(`SERV ${res.status}`, res.status, text.slice(0, 2000));
  const json = JSON.parse(text);
  const choice = json.choices?.[0];
  return {
    content: choice?.message?.content ?? "",
    modelId: id,
    servedModel: json.model ?? id,
    latencyMs: Date.now() - started,
    usage: json.usage
      ? { promptTokens: json.usage.prompt_tokens ?? 0, completionTokens: json.usage.completion_tokens ?? 0, totalTokens: json.usage.total_tokens ?? 0 }
      : null,
    requestId: res.headers.get("x-request-id") ?? json.id ?? null,
    finishReason: choice?.finish_reason ?? null,
  };
}
