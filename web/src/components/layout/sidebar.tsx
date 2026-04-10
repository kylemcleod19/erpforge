"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Building2, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  {
    label: "Organizations",
    href: "/orgs",
    icon: Building2,
    roles: ["platform_head"],
  },
];

interface NavLinksProps {
  userRole?: string;
  onNavigate?: () => void;
}

export function NavLinks({ userRole, onNavigate }: NavLinksProps) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(userRole ?? "")
  );

  return (
    <nav className="flex-1 p-2 space-y-1">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

interface SidebarProps {
  userRole?: string;
}

export function Sidebar({ userRole }: SidebarProps) {
  return (
    <aside className="hidden md:flex md:flex-col w-56 border-r bg-sidebar min-h-screen">
      <div className="p-4 border-b">
        <span className="font-bold text-sm tracking-wide">ERP Forge</span>
      </div>
      <NavLinks userRole={userRole} />
    </aside>
  );
}
