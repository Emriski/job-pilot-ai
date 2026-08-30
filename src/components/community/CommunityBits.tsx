import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reportContent } from "@/lib/community.functions";
import { REPORT_REASONS } from "@/lib/community-validation";
import { cn } from "@/lib/utils";

export type Identity = {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  headline: string | null;
};

export function timeAgo(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

export function IdentityAvatar({
  identity,
  className,
}: {
  identity: Identity;
  className?: string;
}) {
  const label = identity.nickname ?? "Member";
  return (
    <Avatar className={cn("size-9", className)}>
      {identity.avatarUrl ? (
        <AvatarImage src={identity.avatarUrl} alt={`${label}'s profile picture`} />
      ) : null}
      <AvatarFallback>{label.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

export function AuthorLine({
  identity,
  createdAt,
  trailing,
}: {
  identity: Identity;
  createdAt: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <IdentityAvatar identity={identity} />
      <div className="min-w-0">
        {identity.nickname ? (
          <Link
            to="/people/$nickname"
            params={{ nickname: identity.nickname }}
            className="truncate text-sm font-medium text-foreground hover:underline"
          >
            @{identity.nickname}
          </Link>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">Member</span>
        )}
        <p className="truncate text-xs text-muted-foreground">
          {identity.headline ? `${identity.headline} · ` : ""}
          {timeAgo(createdAt)}
        </p>
      </div>
      {trailing ? <div className="ml-auto flex items-center gap-1">{trailing}</div> : null}
    </div>
  );
}

export function ReportDialog({
  targetType,
  targetId,
  trigger,
}: {
  targetType: "post" | "comment" | "user" | "job";
  targetId: string;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const report = useServerFn(reportContent);

  const mutation = useMutation({
    mutationFn: () =>
      report({
        data: {
          target_type: targetType,
          target_id: targetId,
          reason: reason as (typeof REPORT_REASONS)[number],
          details: details.trim() ? details.trim() : null,
        },
      }),
    onSuccess: () => {
      setOpen(false);
      setDetails("");
      toast.success("Thanks — our moderators will review this.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm">
            Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this {targetType}</DialogTitle>
          <DialogDescription>
            Reports are private. Moderators review every report before acting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="report-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="report-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-details">More detail (optional)</Label>
            <Textarea
              id="report-details"
              value={details}
              maxLength={1000}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Tell us what's wrong with this content."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Sending..." : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
