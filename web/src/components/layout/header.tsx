"use client";

import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";

interface HeaderProps {
  userName?: string;
  userEmail?: string;
  isDemo?: boolean;
  demoExpiresAt?: string;
}

export function Header({ userName, userEmail, isDemo, demoExpiresAt }: HeaderProps) {
  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="flex flex-col">
      {isDemo && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 text-center">
          You&apos;re in demo mode.{" "}
          {demoExpiresAt && (
            <>
              Session expires{" "}
              {new Date(demoExpiresAt).toLocaleString()}.{" "}
            </>
          )}
          <a href="/signup" className="underline font-medium">
            Create an account
          </a>{" "}
          to save your work.
        </div>
      )}
      <header className="h-14 border-b flex items-center justify-between px-4">
        <div className="md:hidden font-bold text-sm">ERP Forge</div>
        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
              {userEmail}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
    </div>
  );
}
