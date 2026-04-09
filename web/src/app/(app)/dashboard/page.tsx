import { redirect } from "next/navigation";

// Dashboard redirects to tasks for now — the task list is the primary view.
export default function DashboardPage() {
  redirect("/tasks");
}
