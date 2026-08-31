import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/resume", label: "Resume" },
  { to: "/jobs", label: "Find jobs" },
  { to: "/saved", label: "Saved" },
  { to: "/applications", label: "Applications" },
  { to: "/community", label: "Community" },
  { to: "/messages", label: "Messages" },
  { to: "/notifications", label: "Notifications" },
  { to: "/profile", label: "Profile" },
  { to: "/settings", label: "Settings" },
] as const;

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("font-display text-lg font-semibold tracking-tight text-foreground", className)}
    >
      Jobe<span className="text-primary">Pilot</span>AI
    </span>
  );
}

export function AppShell({ children, isAdmin }: { children: ReactNode; isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const links = isAdmin
    ? [
        ...NAV,
        { to: "/admin/sources", label: "Sources" } as const,
        { to: "/admin/moderation", label: "Moderation" } as const,
      ]
    : NAV;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: {}, replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <BrandMark />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-0.5 xl:flex">
            {links.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  pathname.startsWith(item.to) && "bg-accent text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hidden xl:inline-flex" onClick={signOut}>
              Sign out
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="xl:hidden"
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? (
                <X className="size-5" aria-hidden="true" />
              ) : (
                <Menu className="size-5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {open ? (
          <nav aria-label="Mobile" className="border-t border-border xl:hidden">
            <div className="container-page flex flex-col py-2">
              {links.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
              <Button variant="outline" size="sm" className="mt-2" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </nav>
        ) : null}
      </header>

      <main className="container-page py-8">{children}</main>
    </div>
  );
}

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
