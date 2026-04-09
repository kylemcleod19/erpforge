"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DemoCleanupButtonProps {
  expiredCount: number;
}

export function DemoCleanupButton({ expiredCount }: DemoCleanupButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCleanup() {
    if (!confirm(`Delete ${expiredCount} expired demo org${expiredCount !== 1 ? "s" : ""}?`)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/demo", { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCleanup} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      Clean up {expiredCount} expired
    </Button>
  );
}
