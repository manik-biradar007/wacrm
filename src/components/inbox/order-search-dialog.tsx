"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Search, Send, ExternalLink, IndianRupee } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface OrderSearchResult {
  id: number;
  transactionId: string | null;
  utr: string | null;
  mobile: string | null;
  personName: string | null;
  email: string | null;
  amount: string | null;
  site: string | null;
  type: string | null;
  template: string | null;
  downloaded: number;
  createdOn: string;
}

interface OrderSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with a conversation id — after a message is sent, or when
   *  the agent clicks "Open conversation" — so the caller can select
   *  the thread the way a normal conversation click would. */
  onOpenConversation: (conversationId: string) => void;
}

// Debounce a search-as-you-type input against the external orders DB
// without hammering it on every keystroke.
const SEARCH_DEBOUNCE_MS = 300;

export function OrderSearchDialog({ open, onOpenChange, onOpenConversation }: OrderSearchDialogProps) {
  const t = useTranslations("Inbox.orderSearch");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrderSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<OrderSearchResult | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [opening, setOpening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  // Reset to a clean slate every time the dialog opens, and autofocus
  // the search box so the shortcut goes straight to typing.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setSearched(false);
    setSelected(null);
    setMessage("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setSearching(false);
      setSearched(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      fetch(`/api/orders/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => res.json())
        .then((data) => {
          if (requestId !== requestIdRef.current) return;
          setResults(Array.isArray(data.results) ? data.results : []);
          setSearched(true);
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          toast.error(t("searchError"));
        })
        .finally(() => {
          if (requestId !== requestIdRef.current) return;
          setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, t]);

  const handleSend = useCallback(async () => {
    if (!selected?.mobile || !message.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/orders/quick-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: selected.mobile,
          message: message.trim(),
          name: selected.personName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? t("sendError"));
        return;
      }
      toast.success(t("sendSuccess"));
      onOpenConversation(data.conversation_id);
      onOpenChange(false);
    } catch {
      toast.error(t("sendError"));
    } finally {
      setSending(false);
    }
  }, [selected, message, sending, onOpenConversation, onOpenChange, t]);

  const handleOpenConversation = useCallback(async () => {
    if (!selected?.mobile || opening) return;
    setOpening(true);
    try {
      const res = await fetch("/api/orders/resolve-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: selected.mobile, name: selected.personName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? t("openError"));
        return;
      }
      onOpenConversation(data.conversation_id);
      onOpenChange(false);
    } catch {
      toast.error(t("openError"));
    } finally {
      setOpening(false);
    }
  }, [selected, opening, onOpenConversation, onOpenChange, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder={t("placeholder")}
            className="pl-9"
          />
        </div>

        {!selected ? (
          <ScrollArea className="max-h-80">
            <div className="space-y-1.5 pr-2">
              {searching && (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              {!searching && query.trim().length > 0 && query.trim().length < 3 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {t("typeToSearch")}
                </p>
              )}
              {!searching && searched && results.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {t("noResults")}
                </p>
              )}
              {!searching &&
                results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelected(r)}
                    className="w-full rounded-lg border border-border bg-muted/40 p-3 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {r.personName || t("unnamed")}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(r.createdOn).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {r.mobile && <span>{r.mobile}</span>}
                      {r.amount && (
                        <Badge variant="outline" className="gap-0.5">
                          <IndianRupee className="h-2.5 w-2.5" />
                          {r.amount}
                        </Badge>
                      )}
                      {r.transactionId && (
                        <Badge variant="outline">{r.transactionId}</Badge>
                      )}
                      {r.utr && r.utr !== r.transactionId && (
                        <Badge variant="outline">{r.utr}</Badge>
                      )}
                      <Badge
                        variant={r.downloaded > 0 ? "secondary" : "outline"}
                        className={cn(!r.downloaded && "text-muted-foreground")}
                      >
                        {r.downloaded > 0
                          ? t("downloaded", { count: r.downloaded })
                          : t("notDownloaded")}
                      </Badge>
                    </div>
                  </button>
                ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">
                  {selected.personName || t("unnamed")}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("back")}
                </button>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <dt>{t("mobile")}</dt>
                <dd className="text-foreground">{selected.mobile ?? "—"}</dd>
                <dt>{t("amount")}</dt>
                <dd className="text-foreground">{selected.amount ?? "—"}</dd>
                <dt>{t("paymentId")}</dt>
                <dd className="truncate text-foreground">{selected.transactionId ?? "—"}</dd>
                <dt>{t("utr")}</dt>
                <dd className="truncate text-foreground">{selected.utr ?? "—"}</dd>
                <dt>{t("purchasedOn")}</dt>
                <dd className="text-foreground">
                  {new Date(selected.createdOn).toLocaleString()}
                </dd>
              </dl>
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={t("messagePlaceholder")}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none transition-colors focus:border-primary/50"
            />

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={opening}
                className="gap-1.5 text-xs text-muted-foreground"
                onClick={handleOpenConversation}
              >
                {opening ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5" />
                )}
                {t("openConversation")}
              </Button>
              <Button
                size="sm"
                disabled={!message.trim() || sending}
                onClick={handleSend}
                className="gap-1.5"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t("send")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
