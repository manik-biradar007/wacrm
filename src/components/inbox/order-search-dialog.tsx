"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Send,
  ExternalLink,
  IndianRupee,
  Image as ImageIcon,
  FileText,
  Sparkles,
  X,
} from "lucide-react";
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
import {
  uploadAccountMedia,
  deleteAccountMedia,
  MEDIA_MAX_BYTES_BY_KIND,
} from "@/lib/storage/upload-media";
import { CHAT_MEDIA_BUCKET } from "./message-composer";
import { isPlanExpired } from "@/lib/orders/plan";
import {
  OrderBiodataPreview,
  type OrderSendItem,
  type StagedKind,
} from "./order-biodata-preview";

/** Same support-page screenshot the "Biodata Support Bot" flow attaches
 *  on its own order-found step, so agents send the identical template. */
export const ORDER_FOUND_TEMPLATE_IMAGE_URL =
  "https://iywfneckeyuluzucnaut.supabase.co/storage/v1/object/public/flow-media/account-4167268b-0207-4912-87ac-23c9cf476371/1785951591780-support-page-guide.jpg";

export const ORDER_FOUND_VIDEO_URL = "https://youtu.be/UhKTD_0DcNM";

/** Upper bound on files staged for one message, so a stray click can't queue dozens of sends. */
const MAX_ATTACHMENTS = 10;

/** Canned reply for a resolved order — fills in the payment ID so the
 *  agent doesn't have to retype the re-download instructions by hand. */
function buildOrderFoundMessage(paymentId: string): string {
  return `✅ We found your order!\n\nYour Payment ID:\n${paymentId}\n\nGo back to the website where you purchased your biodata and open the Download/Support section there. Paste this Payment ID exactly as shown above (including "pay_") to re-download your biodata.\n\n📺 Watch Video Guide:\n${ORDER_FOUND_VIDEO_URL}`;
}

/** Posts one WhatsApp message; throws with the API's error (or `fallbackError`). */
async function postWhatsAppMessage(body: Record<string, unknown>, fallbackError: string) {
  const res = await fetch("/api/whatsapp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? fallbackError);
}

/** A file staged on the composer, waiting to be sent. */
interface StagedAttachment {
  kind: StagedKind;
  url: string;
  /** Storage object path; null for the fixed order-found template image (never GC'd). */
  path: string | null;
  filename: string;
}

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
  /**
   * The conversation currently open behind this dialog, if any. When
   * set, "Send" delivers straight into this thread instead of resolving
   * a conversation from the order's mobile number — that lookup can
   * land on a different contact/conversation than the one the agent is
   * actually looking at, which would otherwise send the message to the
   * wrong thread.
   */
  activeConversationId?: string | null;
}

// Debounce a search-as-you-type input against the external orders DB
// without hammering it on every keystroke.
const SEARCH_DEBOUNCE_MS = 300;

export function OrderSearchDialog({
  open,
  onOpenChange,
  onOpenConversation,
  activeConversationId,
}: OrderSearchDialogProps) {
  const t = useTranslations("Inbox.orderSearch");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrderSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<OrderSearchResult | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [opening, setOpening] = useState(false);
  // Files staged to send, in send order. Each one's storage object is GC'd
  // when removed, or when the dialog closes without sending it.
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  // Mirror of `attachments` for the close/unmount cleanup below, which
  // can't read render state.
  const attachmentsRef = useRef<StagedAttachment[]>([]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const discardStaged = useCallback((list: StagedAttachment[]) => {
    for (const a of list) {
      if (a.path) void deleteAccountMedia(CHAT_MEDIA_BUCKET, a.path).catch(() => {});
    }
  }, []);

  // Reset to a clean slate every time the dialog opens, and autofocus
  // the search box so the shortcut goes straight to typing. On close,
  // GC any staged-but-unsent files so they don't orphan in the bucket.
  useEffect(() => {
    if (!open) {
      discardStaged(attachmentsRef.current);
      setAttachments([]);
      return;
    }
    setQuery("");
    setResults([]);
    setSearched(false);
    setSelected(null);
    setMessage("");
    setAttachments([]);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, discardStaged]);

  useEffect(() => {
    return () => {
      discardStaged(attachmentsRef.current);
    };
  }, [discardStaged]);

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

  // Resolves the thread to send into: the conversation already open
  // behind this dialog, or — when opened from the global order search —
  // find-or-create one from the order's mobile number.
  const resolveTargetConversationId = useCallback(async (): Promise<string | null> => {
    if (activeConversationId) return activeConversationId;
    if (!selected?.mobile) return null;
    const res = await fetch("/api/orders/resolve-conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: selected.mobile, name: selected.personName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? t("openError"));
      return null;
    }
    return data.conversation_id as string;
  }, [activeConversationId, selected, t]);

  /** Uploads a file to the chat-media bucket and appends it to the staged list. */
  const stageFile = useCallback(
    async (file: File, kind: StagedKind) => {
      if (attachmentsRef.current.length >= MAX_ATTACHMENTS) {
        toast.error(t("tooManyAttachments", { max: MAX_ATTACHMENTS }));
        return;
      }
      const max = MEDIA_MAX_BYTES_BY_KIND[kind];
      if (file.size > max) {
        toast.error(
          kind === "image"
            ? t("imageTooLarge", { max: Math.round(max / 1024 / 1024) })
            : t("fileTooLarge", { max: Math.round(max / 1024 / 1024) }),
        );
        return;
      }
      setUploadingCount((n) => n + 1);
      try {
        const { publicUrl, path } = await uploadAccountMedia(CHAT_MEDIA_BUCKET, file);
        setAttachments((prev) =>
          prev.length >= MAX_ATTACHMENTS
            ? prev
            : [...prev, { kind, url: publicUrl, path, filename: file.name }],
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("imageUploadError"));
      } finally {
        setUploadingCount((n) => n - 1);
      }
    },
    [t],
  );

  const handleImageChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      for (const file of files) {
        await stageFile(file, "image");
      }
    },
    [stageFile],
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const target = prev[index];
      if (target?.path) void deleteAccountMedia(CHAT_MEDIA_BUCKET, target.path).catch(() => {});
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const applyFoundTemplate = useCallback(() => {
    if (!selected) return;
    const paymentId = selected.transactionId || selected.utr || "";
    setMessage(buildOrderFoundMessage(paymentId));
    // The template image is fixed (path null, never GC'd); don't stage it twice.
    setAttachments((prev) => {
      if (prev.some((a) => a.url === ORDER_FOUND_TEMPLATE_IMAGE_URL)) return prev;
      if (prev.length >= MAX_ATTACHMENTS) return prev;
      return [
        ...prev,
        {
          kind: "image",
          url: ORDER_FOUND_TEMPLATE_IMAGE_URL,
          path: null,
          filename: "support-page-guide.jpg",
        },
      ];
    });
  }, [selected]);

  /**
   * Sends the staged files one message each, in order. The message text goes
   * out as the caption of the first file; with no files it's a plain text
   * message. Sent files leave the list as they go, so a failure part-way
   * leaves only the unsent ones for a retry.
   */
  const handleSend = useCallback(async () => {
    const trimmed = message.trim();
    if (!selected?.mobile || (!trimmed && attachments.length === 0) || sending) return;
    setSending(true);
    try {
      const conversationId = await resolveTargetConversationId();
      if (!conversationId) return;

      const post = (body: Record<string, unknown>) => postWhatsAppMessage(body, t("sendError"));

      if (attachments.length === 0) {
        await post({ conversation_id: conversationId, message_type: "text", content_text: trimmed });
      } else {
        const queue = [...attachments];
        for (let i = 0; i < queue.length; i++) {
          const a = queue[i];
          const caption = i === 0 ? trimmed || undefined : undefined;
          await post(
            a.kind === "image"
              ? {
                  conversation_id: conversationId,
                  message_type: "image",
                  media_url: a.url,
                  content_text: caption,
                }
              : {
                  conversation_id: conversationId,
                  message_type: "document",
                  media_url: a.url,
                  filename: a.filename,
                  content_text: caption,
                },
          );
          // Sent — the storage object now belongs to the message, so drop it from the list.
          setAttachments((prev) => prev.filter((p) => p !== a));
        }
      }

      toast.success(t("sendSuccess"));
      setMessage("");
      if (!activeConversationId) onOpenConversation(conversationId);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("sendError"));
    } finally {
      setSending(false);
    }
  }, [
    selected,
    message,
    attachments,
    sending,
    activeConversationId,
    resolveTargetConversationId,
    onOpenConversation,
    onOpenChange,
    t,
  ]);

  /**
   * The preview's per-format "Send" and "Send all": uploads each generated
   * file and sends it as its own message right away, skipping the composer.
   * The dialog stays open so the agent can follow up with a text message.
   */
  const sendGeneratedFiles = useCallback(
    async (items: OrderSendItem[]) => {
      if (items.length === 0) return;
      const oversized = items.find(({ file, kind }) => file.size > MEDIA_MAX_BYTES_BY_KIND[kind]);
      if (oversized) {
        const max = Math.round(MEDIA_MAX_BYTES_BY_KIND[oversized.kind] / 1024 / 1024);
        toast.error(
          oversized.kind === "image" ? t("imageTooLarge", { max }) : t("fileTooLarge", { max }),
        );
        return;
      }

      let sent = 0;
      try {
        const conversationId = await resolveTargetConversationId();
        if (!conversationId) return;

        for (const { file, kind } of items) {
          const { publicUrl, path } = await uploadAccountMedia(CHAT_MEDIA_BUCKET, file);
          try {
            await postWhatsAppMessage(
              kind === "image"
                ? { conversation_id: conversationId, message_type: "image", media_url: publicUrl }
                : {
                    conversation_id: conversationId,
                    message_type: "document",
                    media_url: publicUrl,
                    filename: file.name,
                  },
              t("sendError"),
            );
          } catch (err) {
            // Never reached the customer — don't leave the upload orphaned.
            void deleteAccountMedia(CHAT_MEDIA_BUCKET, path).catch(() => {});
            throw err;
          }
          sent++;
        }

        // From the global search, switch the inbox to the thread we just
        // sent into; later sends from this dialog then target it directly.
        if (!activeConversationId) onOpenConversation(conversationId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("sendError"));
      } finally {
        if (sent > 0) toast.success(t("filesSent", { count: sent }));
      }
    },
    [activeConversationId, resolveTargetConversationId, onOpenConversation, t],
  );

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

  const uploading = uploadingCount > 0;
  const atLimit = attachments.length >= MAX_ATTACHMENTS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] sm:max-w-2xl lg:max-w-5xl">
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
            className="h-10 pl-9 text-sm"
          />
        </div>

        {!selected ? (
          <ScrollArea className="max-h-[65vh]">
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
                      {r.site && <Badge variant="outline">{r.site}</Badge>}
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
          // Two columns on wide screens: biodata preview + send buttons on
          // the left, order details + composer on the right, each scrolling
          // on its own. Stacks into one scrolling column on narrow screens.
          <div className="grid max-h-[75vh] gap-4 overflow-y-auto pr-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:overflow-hidden lg:pr-0">
            <div className="space-y-3 lg:max-h-[75vh] lg:overflow-y-auto lg:pr-1">
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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={applyFoundTemplate}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("useFoundTemplate")}
                </button>
                <a
                  href={ORDER_FOUND_VIDEO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("watchVideoGuide")}
                </a>
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
                rows={5}
                className="w-full resize-none rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none transition-colors focus:border-primary/50"
              />

              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={handleImageChange}
              />

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((a, index) =>
                    a.kind === "image" ? (
                      <div key={`${a.url}-${index}`} className="relative inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          aria-label={t("removeAttachment")}
                          className="absolute -right-1.5 -top-1.5 rounded-full bg-background/90 p-0.5 text-muted-foreground shadow hover:bg-background hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        key={`${a.url}-${index}`}
                        className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-muted/40 py-1.5 pl-2.5 pr-1.5 text-sm"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="max-w-[12rem] truncate text-foreground">{a.filename}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          aria-label={t("removeAttachment")}
                          className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ),
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading || atLimit}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" />
                )}
                {t("attachImage")}
              </button>

              <div className="flex items-center justify-end gap-2">
                {!activeConversationId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={opening}
                    className="mr-auto gap-1.5 text-xs text-muted-foreground"
                    onClick={handleOpenConversation}
                  >
                    {opening ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3.5 w-3.5" />
                    )}
                    {t("openConversation")}
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={(!message.trim() && attachments.length === 0) || sending || uploading}
                  onClick={handleSend}
                  className="gap-1.5"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {attachments.length > 1 ? t("sendCount", { count: attachments.length }) : t("send")}
                </Button>
              </div>
            </div>

            <div className="lg:order-first lg:max-h-[75vh] lg:overflow-y-auto lg:pr-1">
              {selected.transactionId ? (
                <OrderBiodataPreview
                  key={selected.transactionId}
                  paymentId={selected.transactionId}
                  planType={selected.type}
                  expired={isPlanExpired(selected.createdOn)}
                  onSend={sendGeneratedFiles}
                />
              ) : (
                <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                  {t("preview.missing")}
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
