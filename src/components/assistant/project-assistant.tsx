"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const WELCOME =
  "Բարև ձեզ։ Ես Arm Roll ERP/CRM համակարգի օգնականն եմ։\nԿարող եմ պատասխանել հաճախորդների, պատվերների, ապրանքների, պահեստի, պարտքերի, վաճառքի, մատակարարների, փաստաթղթերի և ձևերի վերաբերյալ հարցերին։\nԳրեք «օգնություն»՝ հնարավորությունների ցանկի համար։";

const SUGGESTIONS = [
  "Քանի հաճախորդ կա",
  "Վերջին պատվերները",
  "Ովքեր են պարտատերերը",
  "Այսօրվա վաճառք",
  "Ցածր մնացորդով ապրանքներ",
  "Ինչ բաժիններ կան",
];

export function ProjectAssistant({ className }: { className?: string }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Սխալ");
      setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Ներողություն, սխալ տեղի ունեցավ։ Խնդրում ենք փորձել կրկին։" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={cn("flex flex-col h-[calc(100vh-8rem)] min-h-[480px] border border-hairline bg-card rounded-xl overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-hairline bg-muted/20">
        <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
          <Bot className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Նախագծի օգնական</div>
          <div className="text-[10px] text-muted-foreground">Arm Roll ERP/CRM · պատասխանում է բազայի տվյալներից</div>
        </div>
        <Sparkles className="size-4 text-copper" />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
          >
            {m.role === "assistant" && (
              <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="size-3.5" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[85%] sm:max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words leading-relaxed",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 border border-hairline"
              )}
            >
              {m.text}
            </div>
            {m.role === "user" && (
              <div className="size-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <User className="size-3.5" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Bot className="size-3.5" />
            </div>
            <div className="bg-muted/50 border border-hairline rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Մտածում է…</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="px-4 py-2 flex gap-1.5 overflow-x-auto border-t border-hairline">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={loading}
            className="shrink-0 text-[11px] px-2.5 py-1 border border-hairline rounded-full hover:bg-muted/40 transition-colors disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-hairline flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Գրեք հարցը հայերեն…"
          rows={1}
          className="resize-none focus-steel min-h-[40px] max-h-32"
        />
        <Button
          size="icon"
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="h-10 w-10 shrink-0 bg-primary"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
