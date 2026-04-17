import Link from "next/link";
import {
  MessageSquare,
  FileText,
  Upload,
  RotateCcw,
  CheckSquare,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TaskRow } from "@/db/schema/index";

const ACTION_ICONS = {
  interview: MessageSquare,
  upload_transcript: Upload,
  upload_document: FileText,
  reassign: RotateCcw,
  general: CheckSquare,
} as const;

const STATUS_VARIANTS = {
  open: "secondary",
  in_progress: "default",
  complete: "outline",
  blocked: "destructive",
} as const satisfies Record<string, "secondary" | "default" | "outline" | "destructive">;

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In Progress",
  complete: "Complete",
  blocked: "Blocked",
} as const;

interface TaskListProps {
  tasks: TaskRow[];
  userRole?: string;
}

export function TaskList({ tasks, userRole: _userRole }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CheckSquare className="mx-auto h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No tasks yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const Icon = ACTION_ICONS[task.actionType] ?? CheckSquare;
        const statusVariant = STATUS_VARIANTS[task.status] ?? "secondary";
        const statusLabel = STATUS_LABELS[task.status] ?? task.status;

        return (
          <Link key={task.id} href={`/tasks/${task.id}`}>
            <Card className="hover:shadow-sm transition-shadow cursor-pointer">
              <CardContent className="flex items-start gap-4 py-4">
                <div
                  className={cn(
                    "mt-0.5 rounded-md p-2 shrink-0",
                    task.status === "complete"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className={cn(
                        "font-medium text-sm",
                        task.status === "complete" && "line-through text-muted-foreground"
                      )}
                    >
                      {task.title}
                    </p>
                    <Badge variant={statusVariant} className="text-xs">
                      {statusLabel}
                    </Badge>
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {task.description}
                    </p>
                  )}
                  {task.questions && task.questions.length > 0 && (
                    <p className="text-xs text-primary/70 font-medium mt-1">
                      {task.questions.length} question{task.questions.length !== 1 ? "s" : ""} to answer
                    </p>
                  )}
                  {task.dueAt && task.status !== "complete" && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Due {new Date(task.dueAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {task.status === "blocked" && (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
