import "server-only";
import { z } from "zod";

export class AIUnavailableError extends Error {
  constructor(message = "AI 建议暂不可用，请稍后重试") {
    super(message);
    this.name = "AIUnavailableError";
  }
}

export class AIResponseFormatError extends Error {
  constructor(message = "AI 返回格式不正确，请重新生成。") {
    super(message);
    this.name = "AIResponseFormatError";
  }
}

type CallAIInput<T extends z.ZodTypeAny> = {
  task: string;
  prompt: string;
  schema: T;
};

function getAIEndpoint() {
  const base = process.env.AI_BASE_URL?.trim();
  if (!base) return "https://api.openai.com/v1/chat/completions";
  if (base.endsWith("/chat/completions")) return base;
  return `${base.replace(/\/$/, "")}/chat/completions`;
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) return JSON.parse(text.slice(first, last + 1));
    throw new AIResponseFormatError();
  }
}

export async function callAI<T extends z.ZodTypeAny>({ task, prompt, schema }: CallAIInput<T>): Promise<z.infer<T>> {
  const apiKey = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim();

  if (!apiKey || !model) {
    throw new AIUnavailableError("AI Key 或模型未配置，请在服务端环境变量中配置 AI_API_KEY 和 AI_MODEL。");
  }

  const response = await fetch(getAIEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是谨慎的跑步训练 AI 教练。只输出严格 JSON，不要 Markdown。建议仅供训练调整参考，不是医疗诊断。遇到疼痛或疑似伤病，优先建议停止训练并咨询专业人士。",
        },
        { role: "user", content: `任务：${task}\n\n${prompt}` },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AIUnavailableError(`AI 调用失败：${response.status} ${body.slice(0, 200)}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new AIResponseFormatError();
  }

  const parsedJson = tryParseJson(content);
  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new AIResponseFormatError(`AI 返回 JSON 未通过校验：${parsed.error.message}`);
  }
  return parsed.data;
}
