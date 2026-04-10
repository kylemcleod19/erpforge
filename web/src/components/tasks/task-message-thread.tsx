"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { TaskMessageRow } from "@/lib/task-service";

interface TaskMessageThreadProps {
  taskId: string;
  initialMessages: TaskMessageRow[];
  currentUserId: string;
  currentUserName: string;
}

export function TaskMessageThread({
  taskId,
  initialMessages,
  currentUserId,
  currentUserName,
}: TaskMessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");

    try {
      const res = await fetch(`/api/tasks/${taskId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        const json = await res.json();
        setMessages((prev) => [...prev, json.data]);
      }
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  }

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Discussion</p>

      {messages.length > 0 && (
        <ScrollArea className="max-h-80 pr-2">
          <div className="space-y-3">
            {messages.map((msg) => {
              const isMe = msg.authorId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={cn("flex gap-2.5", isMe && "flex-row-reverse")}
                >
                  <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                    <AvatarFallback className="text-xs">
                      {isMe ? initials(currentUserName) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                      isMe
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                    <p
                      className={cn(
                        "text-xs mt-1 opacity-60",
                        isMe ? "text-right" : "text-left"
                      )}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      )}

      <form onSubmit={handleSend} className="flex gap-2 items-end">
        <Textarea
          id="message-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message your consultant or add a note… (Enter to send)"
          className="min-h-[2.5rem] max-h-32 resize-none"
          rows={2}
          disabled={sending}
        />
        <Button type="submit" size="icon" disabled={!input.trim() || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
