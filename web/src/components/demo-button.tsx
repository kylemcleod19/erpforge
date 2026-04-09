"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DemoButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDemo() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/demo", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to start demo");
      }
      router.push("/tasks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button className="w-full" onClick={handleDemo} disabled={loading}>
        {loading ? "Setting up demo…" : "Try Demo"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
