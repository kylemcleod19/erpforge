"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Upload, FileText, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "./upload-dialog";
import type { TaskRow } from "@/db/schema/index";

interface TaskActionButtonsProps {
  task: TaskRow;
}

export function TaskActionButtons({ task }: TaskActionButtonsProps) {
  const router = useRouter();
  const done = task.status === "complete";
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"transcript" | "document">("transcript");

  function openUpload(type: "transcript" | "document") {
    setUploadType(type);
    setUploadOpen(true);
  }

  function handleUploadClose(open: boolean) {
    setUploadOpen(open);
    if (!open) router.refresh(); // reload page to show any new follow-up tasks
  }

  return (
    <>
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Launch AI Interview */}
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2 items-start text-left"
            disabled={done}
            onClick={() => router.push(`/tasks/${task.id}/interview`)}
          >
            <div className="flex items-center gap-2 font-medium">
              <MessageSquare className="h-4 w-4 text-primary" />
              Launch AI Interview
            </div>
            <span className="text-xs text-muted-foreground font-normal">
              Chat with the AI to capture your requirements
            </span>
          </Button>

          {/* Upload Meeting Transcript */}
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2 items-start text-left"
            disabled={done}
            onClick={() => openUpload("transcript")}
          >
            <div className="flex items-center gap-2 font-medium">
              <Upload className="h-4 w-4 text-primary" />
              Upload Meeting Transcript
            </div>
            <span className="text-xs text-muted-foreground font-normal">
              AI extracts open questions and action items
            </span>
          </Button>

          {/* Upload Supporting Document */}
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2 items-start text-left"
            disabled={done}
            onClick={() => openUpload("document")}
          >
            <div className="flex items-center gap-2 font-medium">
              <FileText className="h-4 w-4 text-primary" />
              Upload Supporting Document
            </div>
            <span className="text-xs text-muted-foreground font-normal">
              Share specs, BOMs, or reference material
            </span>
          </Button>

          {/* Re-assign / Get Support */}
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2 items-start text-left"
            onClick={() => document.getElementById("message-input")?.focus()}
          >
            <div className="flex items-center gap-2 font-medium">
              <RotateCcw className="h-4 w-4 text-primary" />
              Re-assign / Get Support
            </div>
            <span className="text-xs text-muted-foreground font-normal">
              Message your consultant or delegate the task
            </span>
          </Button>
        </div>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={handleUploadClose}
        taskId={task.id}
        uploadType={uploadType}
      />
    </>
  );
}
