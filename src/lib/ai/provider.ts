/**
 * AI Provider Layer — OllamaCloud + DeepSeek v4 with guardrails.
 * AI can ONLY return PROPOSALS. Direct mutation of protected ledgers
 * is forbidden at this layer AND re-checked at the action layer.
 */

export type AiModel = "deepseek-v4-flash" | "deepseek-v4-pro" | "fallback";

export interface AiRequest {
  module: string;
  prompt: string;
  context?: Record<string, any>;
  schema?: Record<string, any>;
  tier?: "fast" | "reasoning";
}

export interface AiProposal {
  module: string;
  model: AiModel;
  input: Record<string, any>;
  output: Record<string, any>;
  proposedAction?: {
    type: string;
    target: string;
    payload: Record<string, any>;
  };
  status: "PROPOSAL" | "REJECTED_BY_GUARDRAIL";
  reason?: string;
  createdAt: string;
}

export const FORBIDDEN_AI_MUTATIONS = new Set([
  "payment.create", "payment.update", "payment.delete",
  "debt.write", "debt.adjust",
  "inventory.ledger.write", "inventory_movement.create",
  "price.override", "discount.override",
  "tax_rule.create", "tax_rule.update", "tax_rule.retire",
  "data.hard_delete", "user.delete",
]);

export function isForbiddenAiMutation(actionType: string): boolean {
  return FORBIDDEN_AI_MUTATIONS.has(actionType);
}

export function selectModel(module: string, tier?: "fast" | "reasoning"): AiModel {
  const proModules = new Set([
    "ASK_BUSINESS", "PRICE_MARGIN", "ORDER_VALIDATION", "INVENTORY_FORECAST",
  ]);
  if (tier === "reasoning" || proModules.has(module)) {
    return "deepseek-v4-pro";
  }
  return "deepseek-v4-flash";
}

export async function generateProposal(req: AiRequest): Promise<AiProposal> {
  const model = selectModel(req.module, req.tier);
  const ollamaKey = process.env.OLLAMACLOUD_API_KEY;
  const ollamaUrl = process.env.OLLAMACLOUD_BASE_URL;

  let output: Record<string, any> = {};
  let usedModel: AiModel = model;

  if (ollamaKey && ollamaUrl) {
    try {
      const res = await fetch(`${ollamaUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ollamaKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "Դուք ERP համակարգի AI օգնական եք։ " +
                "Դուք ԿԱՐՈՂ եք միայն առաջարկներ անել (PROPOSAL)։ " +
                "Չեք կարող ուղղակի փոխել վճարումներ, պարտքեր, գույքագրում, գներ, զեղչեր կամ հարկային կանոններ։ " +
                "Պատասխանեք միայն JSON ձևաչափով։",
            },
            { role: "user", content: req.prompt },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content ?? "{}";
        output = typeof content === "string" ? JSON.parse(content) : content;
      } else {
        usedModel = "fallback";
      }
    } catch {
      usedModel = "fallback";
    }
  } else {
    usedModel = "fallback";
  }

  if (usedModel === "fallback") {
    try {
      const sdkModule: any = await import("z-ai-web-dev-sdk");
      const ZAI = sdkModule.default ?? sdkModule.ZAI;
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: "system", content: "Return JSON only. You are an ERP AI assistant. You can only PROPOSE actions, never execute." },
          { role: "user", content: req.prompt },
        ],
        temperature: 0.2,
      });
      const content = completion.choices?.[0]?.message?.content ?? "{}";
      try {
        output = JSON.parse(content);
      } catch {
        output = { _raw: content };
      }
    } catch (e: any) {
      output = { _error: e?.message ?? "AI unavailable" };
    }
  }

  const proposal: AiProposal = {
    module: req.module,
    model: usedModel,
    input: { prompt: req.prompt, context: req.context ?? {} },
    output,
    proposedAction: output.action ?? output.proposedAction,
    status: "PROPOSAL",
    createdAt: new Date().toISOString(),
  };

  if (proposal.proposedAction?.type && isForbiddenAiMutation(proposal.proposedAction.type)) {
    proposal.status = "REJECTED_BY_GUARDRAIL";
    proposal.reason = `Forbidden mutation type: ${proposal.proposedAction.type}`;
  }

  return proposal;
}
