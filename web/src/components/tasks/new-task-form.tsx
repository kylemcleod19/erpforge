"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Org {
  id: string;
  name: string;
  slug: string;
}

interface OrgMember {
  userId: string;
  name: string;
  email: string;
}

interface NewTaskFormProps {
  orgs: Org[];
}

const ACTION_TYPE_LABELS = {
  interview: "AI Interview",
  upload_transcript: "Upload Transcript",
  upload_document: "Upload Document",
  reassign: "Re-assign",
  general: "General",
} as const;

export function NewTaskForm({ orgs }: NewTaskFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [orgId, setOrgId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [actionType, setActionType] = useState<keyof typeof ACTION_TYPE_LABELS>("general");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load members when org changes
  useEffect(() => {
    if (!orgId) { setMembers([]); setAssignedToId(""); return; }
    setMembersLoading(true);
    setAssignedToId("");
    fetch(`/api/orgs/${orgId}`)
      .then((r) => r.json())
      .then((json) => {
        setMembers(json?.data?.members ?? []);
      })
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false));
  }, [orgId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !orgId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          orgId,
          actionType,
          description: description.trim() || undefined,
          assignedToId: assignedToId || undefined,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Failed to create task");
        return;
      }
      router.push(`/tasks/${json.data.id}`);
    } catch {
      setError("Failed to create task");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Clarify your BOM process"
          disabled={loading}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="orgId">Organization *</Label>
        <Select value={orgId} onValueChange={setOrgId} disabled={loading}>
          <SelectTrigger id="orgId">
            <SelectValue placeholder="Select an organization" />
          </SelectTrigger>
          <SelectContent>
            {orgs.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="actionType">Action Type *</Label>
        <Select value={actionType} onValueChange={(v) => setActionType(v as typeof actionType)} disabled={loading}>
          <SelectTrigger id="actionType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assignedToId">
          Assign To{" "}
          {membersLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
        </Label>
        <Select
          value={assignedToId}
          onValueChange={setAssignedToId}
          disabled={loading || !orgId || membersLoading}
        >
          <SelectTrigger id="assignedToId">
            <SelectValue placeholder={orgId ? "Unassigned" : "Select an org first"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.name} — {m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional context or instructions for this task"
          rows={3}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dueAt">Due Date</Label>
        <Input
          id="dueAt"
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          disabled={loading}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={!title.trim() || !orgId || loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Create Task
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
