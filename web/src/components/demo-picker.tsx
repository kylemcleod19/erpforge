"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const DEMO_COMPANIES = [
  {
    id: "guitar",
    label: "Guitar Manufacturer",
    description: "Custom handcrafted guitars, make-to-order",
    prompt:
      "I run a small custom guitar workshop. We build acoustic and electric guitars by hand — about 200 guitars a year with 12 employees. We take custom orders from musicians and dealers, and each guitar has its own BOM with wood selections, hardware, and finish specs.",
  },
  {
    id: "food",
    label: "Food/Beverage Producer",
    description: "Artisan batch production, retail distribution",
    prompt:
      "We're an artisan hot sauce company with 8 employees and 15 product SKUs. We batch-produce using proprietary recipes and sell to regional grocery chains, restaurants, and through our website. We track lot numbers for food safety compliance.",
  },
  {
    id: "metal",
    label: "Metal Fabricator",
    description: "Custom sheet metal, make-to-order from blueprints",
    prompt:
      "We do custom sheet metal fabrication for HVAC and construction contractors. 25 employees. Everything is make-to-order from customer blueprints — no standard products. We cut, bend, weld, and coat to spec.",
  },
  {
    id: "electronics",
    label: "Electronics Assembler",
    description: "Industrial control panels, complex BOMs",
    prompt:
      "We assemble custom industrial control panels and electrical enclosures for factories. 18 employees. Every job has a unique BOM based on customer requirements and typically runs 8–16 week lead times. Lots of documentation and compliance requirements.",
  },
] as const;

interface DemoPickerDialogProps {
  open: boolean;
  onClose: () => void;
}

export function DemoPickerDialog({ open, onClose }: DemoPickerDialogProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(DEMO_COMPANIES[0].id);
  const [prompt, setPrompt] = useState<string>(DEMO_COMPANIES[0].prompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSelectCompany(id: string) {
    const company = DEMO_COMPANIES.find((c) => c.id === id);
    if (!company) return;
    setSelectedId(id);
    setPrompt(company.prompt);
  }

  async function handleStart() {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyPrompt: trimmed }),
      });
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose a demo company</DialogTitle>
          <DialogDescription>
            Pick an example below, edit it to match your business, or write your own.
          </DialogDescription>
        </DialogHeader>

        {/* Company cards */}
        <div className="grid grid-cols-2 gap-2">
          {DEMO_COMPANIES.map((company) => (
            <button
              key={company.id}
              type="button"
              onClick={() => handleSelectCompany(company.id)}
              className={`rounded-lg border p-3 text-left transition-colors hover:bg-accent ${
                selectedId === company.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border"
              }`}
            >
              <div className="font-medium text-sm">{company.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{company.description}</div>
            </button>
          ))}
        </div>

        {/* Editable prompt */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Edit the description below — the AI interviewer will use it as a starting point.
          </p>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="resize-none text-sm"
            placeholder="Describe your company and what you make…"
            disabled={loading}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={!prompt.trim() || loading}>
            {loading ? "Setting up demo…" : "Start Demo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
