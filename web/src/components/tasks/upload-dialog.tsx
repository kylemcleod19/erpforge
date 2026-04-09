"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ExtractedUploadData } from "@/db/schema/uploads";

type UploadType = "transcript" | "document";
type ProcessingStatus = "idle" | "uploading" | "processing" | "complete" | "error";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  uploadType: UploadType;
}

const LABELS: Record<UploadType, { title: string; hint: string; accept: string }> = {
  transcript: {
    title: "Upload Meeting Transcript",
    hint: "Upload a meeting transcript or call notes. AI will extract open questions and action items.",
    accept: ".txt,.md,.pdf,.doc,.docx",
  },
  document: {
    title: "Upload Supporting Document",
    hint: "Upload a spec, BOM, integration doc, or any reference material.",
    accept: ".txt,.md,.pdf,.doc,.docx",
  },
};

export function UploadDialog({ open, onOpenChange, taskId, uploadType }: UploadDialogProps) {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedUploadData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStatus("idle");
      setFile(null);
      setUploadId(null);
      setExtracted(null);
      setError(null);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [open]);

  // Polling for processing status
  useEffect(() => {
    if (!uploadId || status !== "processing") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/uploads/${uploadId}`);
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data;

        if (data.processingStatus === "complete") {
          clearInterval(pollRef.current!);
          setExtracted(data.extractedData as ExtractedUploadData);
          setStatus("complete");
        } else if (data.processingStatus === "error") {
          clearInterval(pollRef.current!);
          setError(data.errorMessage ?? "Processing failed");
          setStatus("error");
        }
      } catch {
        // Keep polling on transient errors
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [uploadId, status]);

  async function handleUpload(selectedFile: File) {
    setFile(selectedFile);
    setStatus("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("uploadType", uploadType);

    try {
      const res = await fetch(`/api/tasks/${taskId}/uploads`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Upload failed");
      }

      const json = await res.json();
      setUploadId(json.data.uploadId);
      setStatus("processing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("error");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleUpload(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleUpload(f);
  }

  const labels = LABELS[uploadType];
  const progressValue =
    status === "uploading" ? 30 : status === "processing" ? 65 : status === "complete" ? 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.hint}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Drop zone — only shown when idle */}
          {status === "idle" && (
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Drop file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supported: .txt, .md, .pdf, .doc, .docx — max 50 MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={labels.accept}
                className="sr-only"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Progress state */}
          {(status === "uploading" || status === "processing") && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate text-muted-foreground">{file?.name}</span>
              </div>
              <Progress value={progressValue} className="h-2" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {status === "uploading" ? "Uploading…" : "AI is analyzing your file…"}
              </div>
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2.5 rounded-md">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setStatus("idle"); setFile(null); }}
              >
                Try again
              </Button>
            </div>
          )}

          {/* Complete state — show extracted insights */}
          {status === "complete" && extracted && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Analysis complete
              </div>

              <div className="space-y-3 text-sm">
                {/* Summary */}
                <div className="rounded-md bg-muted p-3 space-y-1">
                  <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Summary</p>
                  <p>{extracted.summary}</p>
                </div>

                {/* Open questions */}
                {extracted.openQuestions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      Open Questions
                    </p>
                    <ul className="space-y-1">
                      {extracted.openQuestions.map((q, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-muted-foreground shrink-0">•</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action items */}
                {extracted.actionItems.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      Action Items
                    </p>
                    <ul className="space-y-1">
                      {extracted.actionItems.map((a, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-muted-foreground shrink-0">→</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Follow-up note */}
                {extracted.followUpNeeded && (
                  <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-yellow-800 text-xs">
                    <span className="font-medium">Follow-up interview queued</span>
                    — a new interview task has been added to your list.
                  </div>
                )}
              </div>

              <Button className="w-full" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
