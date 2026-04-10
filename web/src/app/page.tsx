import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { DemoButton } from "@/components/demo-button";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/tasks");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">ERP Forge</h1>
          <p className="mt-3 text-muted-foreground text-lg">
            AI-powered ERP discovery and specification for small manufacturers.
          </p>
        </div>

        <div className="space-y-3">
          <DemoButton />
          <div className="text-sm text-muted-foreground">or</div>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Demo sessions expire after 24 hours.
        </p>
      </div>
    </div>
  );
}
