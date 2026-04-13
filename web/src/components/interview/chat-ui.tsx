"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PhaseProgress } from "./phase-progress";
import { MessageBubble } from "./message-bubble";
import type { InterviewPhase } from "./phase-progress";
import type { ChatMessage } from "./message-bubble";

interface ChatUIProps {
  /** The interview slug — derived from task ID as "task-{taskId}" */
  slug: string;
  /** Display name shown above the chat */
  taskTitle: string;
  /**
   * Optional seed message sent automatically as the user's first reply.
   * Used by the demo flow to inject the visitor's company description.
   * Only sent on fresh sessions — not on resume.
   */
  initialPrompt?: string;
}

export function ChatUI({ slug, taskTitle, initialPrompt }: ChatUIProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<InterviewPhase>("intake");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  /** Start or resume the interview session. Populates messages and returns the opening/last reply. */
  const startSession = useCallback(async (): Promise<string | null> => {
    const res = await fetch("/api/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message ?? "Failed to start interview");
    }
    const json = await res.json();
    const data = json.data as {
      reply: string;
      phase: InterviewPhase;
      done: boolean;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };
    setPhase(data.phase);
    if (data.done) setDone(true);
    // If resuming (history present), restore the full conversation
    if (data.history && data.history.length > 0) {
      setMessages(data.history.map((m) => ({ role: m.role, content: m.content })));
      return null; // history already contains the last reply — no need to append again
    }
    return data.reply;
  }, [slug]);

  /** Send a message and get the agent's reply. Auto-resumes if worker is gone. */
  const sendTurn = useCallback(
    async (text: string): Promise<{ reply: string; phase: InterviewPhase; done: boolean }> => {
      const res = await fetch(`/api/interviews/${slug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      // Worker died (server restart) — resume from session file then retry
      if (res.status === 404 || res.status === 500) {
        await startSession(); // re-spawns worker, discards opening message
        const retry = await fetch(`/api/interviews/${slug}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        if (!retry.ok) throw new Error("Failed to send message after resume");
        const j = await retry.json();
        return j.data;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to send message");
      }
      const json = await res.json();
      return json.data;
    },
    [slug, startSession]
  );

  // On mount: start the session, display the opening message, and optionally
  // auto-send initialPrompt as the user's first message (demo flow only).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function init() {
      setLoading(true);
      try {
        const reply = await startSession();
        if (reply) {
          // Fresh session — show AI opening message
          setMessages([{ role: "assistant", content: reply }]);
          scrollToBottom();

          // Auto-send the seed prompt so the AI can skip questions already answered
          if (initialPrompt) {
            setMessages((prev) => [...prev, { role: "user", content: initialPrompt }]);
            scrollToBottom();
            const result = await sendTurn(initialPrompt);
            setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
            setPhase(result.phase);
            if (result.done) setDone(true);
            scrollToBottom();
          }
        }
        // reply === null means resumed session — history already restored, no auto-send
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start interview");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [startSession, scrollToBottom, initialPrompt, sendTurn]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || done) return;

    setInput("");
    setLoading(true);
    setError(null);

    // Optimistically append user message
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    scrollToBottom();

    try {
      const result = await sendTurn(text);
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
      setPhase(result.phase);
      if (result.done) setDone(true);
      scrollToBottom();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      // Remove optimistic message on failure
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="space-y-3 shrink-0">
        <h2 className="font-semibold text-sm text-muted-foreground truncate">{taskTitle}</h2>
        <PhaseProgress currentPhase={phase} />
      </div>

      {/* Message thread */}
      <ScrollArea className="flex-1 min-h-0 pr-2">
        <div className="space-y-4 pb-2">
          {messages.length === 0 && loading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting interview…
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {loading && messages.length > 0 && (
            <div className="flex gap-3">
              <div className="h-7 w-7 rounded-full bg-muted border shrink-0 mt-0.5 flex items-center justify-center text-xs">
                AI
              </div>
              <div className="bg-muted rounded-xl rounded-tl-sm px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          {done && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Interview complete. Your spec has been compiled.
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md shrink-0">
          {error}
        </p>
      )}

      {/* Input */}
      {!done && (
        <form onSubmit={handleSend} className="flex gap-2 items-end shrink-0">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer… (Enter to send, Shift+Enter for new line)"
            className="min-h-[2.5rem] max-h-36 resize-none"
            rows={2}
            disabled={loading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || loading}
            className="shrink-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
