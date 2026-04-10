"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LogOut, User } from "lucide-react";
import { NavLinks } from "./sidebar";

interface HeaderProps {
  userName?: string;
  userEmail?: string;
  userRole?: string;
  isDemo?: boolean;
  demoExpiresAt?: string;
}

export function Header({ userName, userEmail, userRole, isDemo, demoExpiresAt }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
        {/* Mobile hamburger */}
        <button
          className="md:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Desktop: spacer (sidebar handles branding) */}
        <div className="hidden md:block flex-1" />
        <div className="flex-1 md:hidden" />

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

      {/* Mobile nav Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-56 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-sm font-bold tracking-wide text-left">
              ERP Forge
            </SheetTitle>
          </SheetHeader>
          <NavLinks userRole={userRole} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
