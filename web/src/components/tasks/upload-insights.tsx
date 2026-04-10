import { FileText, Upload, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import type { UploadRow } from "@/db/schema/uploads";
import type { ExtractedUploadData } from "@/db/schema/uploads";

interface UploadInsightsProps {
  uploads: UploadRow[];
}

export function UploadInsights({ uploads }: UploadInsightsProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Uploaded Files</p>
      <div className="space-y-3">
        {uploads.map((upload) => (
          <UploadCard key={upload.id} upload={upload} />
        ))}
      </div>
    </div>
  );
}

function UploadCard({ upload }: { upload: UploadRow }) {
  const Icon = upload.uploadType === "transcript" ? Upload : FileText;
  const extracted = upload.extractedData as ExtractedUploadData | null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* File header */}
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{upload.originalFilename}</span>
        <StatusIcon status={upload.processingStatus} />
      </div>

      {/* Extracted insights */}
      {upload.processingStatus === "complete" && extracted && (
        <div className="space-y-2.5 text-sm pl-6">
          <p className="text-muted-foreground leading-relaxed">{extracted.summary}</p>

          {extracted.openQuestions.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Open Questions
              </p>
              <ul className="space-y-0.5">
                {extracted.openQuestions.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0">•</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {extracted.actionItems.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Action Items
              </p>
              <ul className="space-y-0.5">
                {extracted.actionItems.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0">→</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {upload.processingStatus === "error" && (
        <p className="text-xs text-destructive pl-6">{upload.errorMessage}</p>
      )}

      {(upload.processingStatus === "pending" || upload.processingStatus === "processing") && (
        <p className="text-xs text-muted-foreground pl-6">
          AI is analyzing this file…
        </p>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: UploadRow["processingStatus"] }) {
  if (status === "complete") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  if (status === "error") return <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  return <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />;
}
