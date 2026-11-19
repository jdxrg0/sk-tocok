"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  MessageSquareQuote,
  Send,
  Heart,
  Pin,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertCircle,
  Trash2,
  Loader2,
  X,
  Plus,
  HelpCircle,
  Lightbulb,
  ThumbsUp,
  ExternalLink,
  Lock,
  RefreshCw,
  FileText,
  Megaphone,
  ChevronDown,
  ArrowRight,
  MessageCircleQuestion,
  CornerDownRight,
  Archive,
  ArrowBigUp,
  MessageSquare,
  Share2,
} from "lucide-react";
import { useAuth, isOfficialRole } from "@/components/AuthProvider";
import {
  MESSAGE_CATEGORIES,
  PUROK_OPTIONS,
  getCategoryBadgeClass,
  getStatusBadge,
  generateRandomAlias,
  formatTimeAgo,
  getAvatarUrl,
  type MessageCategory,
  type MessageStatus,
  type AnonymousMessageItem,
  type PublicMessageItem,
  type TrackedMessageResult,
  type AnonymousMessageReply,
} from "@/lib/messages";

const AVATAR_COLORS = [
  "bg-orange-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-cyan-500",
  "bg-pink-500",
];

function getAvatarBg(alias: string): string {
  let hash = 0;
  for (let i = 0; i < (alias || "").length; i++) {
    hash = alias.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  // 1. Mobile & tablet User Agents (iOS, Android, etc.)
  const isMobileUA = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  // 2. Touch screen without fine pointer / hover (virtual touch keyboard)
  const isTouchDevice =
    window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
    (window.innerWidth < 768 && (navigator.maxTouchPoints > 0 || "ontouchstart" in window));

  return Boolean(isMobileUA || isTouchDevice);
}

// Tactile Feedback Engine: Physical vibration haptics on mobile + subtle acoustic click
function triggerHaptic(pattern: number | number[] = 15) {
  if (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  ) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration error if blocked or unsupported
    }
  }
}

function triggerAudioClick(type: "tap" | "pop" | "success" | "toggle" = "tap") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === "tap") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === "pop") {
      // Upvote pop
      osc.type = "triangle";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
      gain.gain.setValueAtTime(0.065, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.055);
    } else if (type === "toggle") {
      // Expand/collapse comments
      osc.type = "sine";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.04);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.045);
    } else if (type === "success") {
      // Submit / Copy
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(587.33, now + 0.05);
      osc.frequency.setValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.21);
    }
    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 280);
  } catch {
    // Audio unsupported or blocked
  }
}

function tactileFeedback(type: "tap" | "pop" | "success" | "toggle" = "tap") {
  if (type === "pop") {
    triggerHaptic(20);
    triggerAudioClick("pop");
  } else if (type === "success") {
    triggerHaptic([20, 45, 25]);
    triggerAudioClick("success");
  } else if (type === "toggle") {
    triggerHaptic(12);
    triggerAudioClick("toggle");
  } else {
    triggerHaptic(10);
    triggerAudioClick("tap");
  }
}

interface AnonymousAvatarProps {
  alias: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function AnonymousAvatar({
  alias,
  size = "md",
  className = "",
}: AnonymousAvatarProps) {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    xs: "w-5 h-5 text-[10px]",
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 sm:w-8.5 sm:h-8.5 text-xs",
    lg: "w-10 h-10 text-sm",
    xl: "w-14 h-14 sm:w-20 sm:h-20 text-xl sm:text-2xl",
  };

  const cleanAlias = (alias || "Anonymous Youth").trim();
  const avatarUrl = getAvatarUrl(cleanAlias);
  const bgColor = getAvatarBg(cleanAlias);

  if (hasError) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full ${bgColor} text-white flex items-center justify-center font-bold shrink-0 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700 ${className}`}
        title={`u/${cleanAlias}`}
      >
        <span>🎭</span>
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200/90 dark:ring-slate-700 shrink-0 shadow-2xs flex items-center justify-center ${className}`}
      title={`u/${cleanAlias}`}
    >
      <img
        src={avatarUrl}
        alt={`u/${cleanAlias}`}
        loading="lazy"
        onError={() => setHasError(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

interface ThreadedCommentItemProps {
  reply: AnonymousMessageReply;
  depth: number;
  messageId: number;
  repliesByParent: Record<number | "root", AnonymousMessageReply[]>;
  likedReplyIds: number[];
  selectedReplyTo: { id: number; alias: string } | null;
  onSelectReplyTo: (target: { id: number; alias: string } | null) => void;
  onLikeReply: (replyId: number, messageId: number) => void;
  animatingReplyLikeIds: Record<number, boolean>;
  replyInput: string;
  onReplyInputChange: (val: string) => void;
  onSubmitReply: (parentId?: number | null) => void;
  submittingReply: boolean;
  userAlias: string;
  newlyAddedReplyId?: number | null;
}

function ThreadedCommentItem({
  reply,
  depth,
  messageId,
  repliesByParent,
  likedReplyIds,
  selectedReplyTo,
  onSelectReplyTo,
  onLikeReply,
  animatingReplyLikeIds,
  replyInput,
  onReplyInputChange,
  onSubmitReply,
  submittingReply,
  userAlias,
  newlyAddedReplyId,
}: ThreadedCommentItemProps) {
  const isReplyLiked = likedReplyIds.includes(reply.id);
  const children = repliesByParent[reply.id] || [];
  const isReplyingThis = selectedReplyTo?.id === reply.id;
  const isAnimatingLike = animatingReplyLikeIds[reply.id];
  const isNewlyAdded = newlyAddedReplyId === reply.id;

  return (
    <div
      className={`space-y-1.5 animate-comment-enter transition-all duration-300 ${
        isNewlyAdded
          ? "p-1.5 -ml-1.5 rounded-xl bg-brand-500/10 dark:bg-brand-500/15 ring-1 ring-brand-500/30"
          : ""
      }`}
    >
      {/* Comment Header & Content */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs">
          <AnonymousAvatar alias={reply.alias} size="xs" />
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
            u/{reply.alias.replace(/^u\//i, "")}
          </span>
          <span className="text-slate-400 text-[10px]">•</span>
          <span className="text-slate-400 text-[10px]">
            {formatTimeAgo(reply.created_at)}
          </span>
          {isNewlyAdded && (
            <span className="text-[9px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-100 dark:bg-brand-950/80 px-1.5 py-0.2 rounded-full animate-in fade-in zoom-in-95 duration-200">
              Just now
            </span>
          )}
        </div>
        <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed pl-6.5 whitespace-pre-wrap">
          {reply.reply}
        </p>

        {/* Action Row */}
        <div className="pl-6.5 flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
          <button
            type="button"
            onClick={() => onLikeReply(reply.id, messageId)}
            className={`inline-flex items-center gap-1 transition-all duration-200 tactile-pill cursor-pointer ${
              isReplyLiked ? "text-orange-600 font-semibold" : "hover:text-orange-600"
            }`}
            title="Upvote comment"
          >
            <ArrowBigUp
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isReplyLiked ? "fill-orange-600" : ""
              } ${isAnimatingLike ? "animate-upvote-pop" : "hover:-translate-y-0.5"}`}
            />
            <span className={`transition-transform duration-200 ${isAnimatingLike ? "font-bold scale-110" : ""}`}>
              {reply.likes_count || 0}
            </span>
          </button>

          {/* Reply button: available up to depth 2 (allowing up to 3 levels: post -> comment -> reply) */}
          {depth < 3 && (
            <button
              type="button"
              onClick={() =>
                onSelectReplyTo(
                  isReplyingThis ? null : { id: reply.id, alias: reply.alias }
                )
              }
              className={`inline-flex items-center gap-1 transition-all duration-200 tactile-pill cursor-pointer ${
                isReplyingThis ? "text-brand-600 dark:text-brand-400 font-semibold" : "hover:text-brand-600 dark:hover:text-brand-400"
              }`}
              title="Reply to comment"
            >
              <MessageSquare className={`w-3 h-3 transition-transform duration-200 ${isReplyingThis ? "scale-110" : ""}`} />
              <span>{isReplyingThis ? "Cancel" : "Reply"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Inline Reply Box: Moves directly under this comment when replying */}
      {isReplyingThis && (
        <div className="pl-6.5 pt-1 space-y-1 animate-reply-box-enter">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/70 p-1.5 rounded-xl border border-brand-400/80 dark:border-brand-600/80 shadow-xs focus-within:ring-2 focus-within:ring-brand-500/25 transition-all duration-200">
            <AnonymousAvatar alias={userAlias} size="xs" className="shrink-0" />
            <textarea
              id={`reply-input-${messageId}`}
              rows={1}
              autoFocus
              value={replyInput}
              onChange={(e) => {
                onReplyInputChange(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
              }}
              onKeyDown={(e) => {
                if (isMobileDevice()) return;
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (replyInput.trim() && !submittingReply) {
                    onSubmitReply(reply.id);
                  }
                }
              }}
              placeholder={`Reply to u/${reply.alias.replace(/^u\//i, "")}...`}
              className="flex-1 py-1 px-2.5 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none leading-normal min-h-[34px] max-h-[100px]"
            />
            <button
              type="button"
              onClick={() => onSelectReplyTo(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-2 py-1 rounded-lg transition-all tactile-btn cursor-pointer shrink-0"
              title="Cancel reply"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSubmitReply(reply.id)}
              disabled={submittingReply || !replyInput.trim()}
              title="Send reply (Enter on desktop)"
              className="px-2.5 py-1.5 h-8.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1 transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-2xs hover:shadow-xs tactile-btn"
            >
              {submittingReply ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 transition-transform duration-200 hover:translate-x-0.5 hover:-translate-y-0.5" />
                  <span className="hidden sm:inline">Reply</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Nested Children Comments (Level 2 or Level 3) */}
      {children.length > 0 && (
        <div className="border-l-2 border-slate-200/90 dark:border-slate-700/80 ml-2.5 pl-3 space-y-2.5 pt-1">
          {children.map((child) => (
            <ThreadedCommentItem
              key={child.id}
              reply={child}
              depth={depth + 1}
              messageId={messageId}
              repliesByParent={repliesByParent}
              likedReplyIds={likedReplyIds}
              selectedReplyTo={selectedReplyTo}
              onSelectReplyTo={onSelectReplyTo}
              onLikeReply={onLikeReply}
              animatingReplyLikeIds={animatingReplyLikeIds}
              replyInput={replyInput}
              onReplyInputChange={onReplyInputChange}
              onSubmitReply={onSubmitReply}
              submittingReply={submittingReply}
              userAlias={userAlias}
              newlyAddedReplyId={newlyAddedReplyId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AnonymousCouncilMessagesProps {
  mode?: "public" | "admin";
}

export default function AnonymousCouncilMessages({
  mode = "public",
}: AnonymousCouncilMessagesProps) {
  const { user } = useAuth();
  const isOfficial = Boolean(user && isOfficialRole(user.role));
  const isAdmin = mode === "admin" && isOfficial;

  // Data states
  const [publicMessages, setPublicMessages] = useState<PublicMessageItem[]>([]);
  const [adminMessages, setAdminMessages] = useState<AnonymousMessageItem[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [adminStats, setAdminStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    private_answered: 0,
    rejected: 0,
    archived: 0,
    publicCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Public filters
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [publicSearch, setPublicSearch] = useState("");
  const [sortBy, setSortBy] = useState<"latest" | "popular">("latest");

  // Admin filters
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>("all");
  const [adminCategoryFilter, setAdminCategoryFilter] = useState<string>("all");
  const [adminSearch, setAdminSearch] = useState("");

  // Liked items stored locally in localStorage
  const [likedIds, setLikedIds] = useState<number[]>([]);
  const [likedReplyIds, setLikedReplyIds] = useState<number[]>([]);

  // Animation states for tactile micro-interactions
  const [animatingLikeIds, setAnimatingLikeIds] = useState<Record<number, boolean>>({});
  const [animatingReplyLikeIds, setAnimatingReplyLikeIds] = useState<Record<number, boolean>>({});
  const [newlyAddedReplyId, setNewlyAddedReplyId] = useState<number | null>(null);
  const [newlyAddedPostId, setNewlyAddedPostId] = useState<number | null>(null);

  // Reddit comments & replies state
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
  const [repliesByPost, setRepliesByPost] = useState<Record<number, AnonymousMessageReply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<number, boolean>>({});
  const [replyInputs, setReplyInputs] = useState<Record<number, string>>({});
  const [submittingReply, setSubmittingReply] = useState<Record<number, boolean>>({});
  const [replyingToByPost, setReplyingToByPost] = useState<
    Record<number, { id: number; alias: string } | null>
  >({});

  // Submission Form State
  const [formCategory, setFormCategory] = useState<string>("Suggestion");
  const [formPurok, setFormPurok] = useState<string>("Not Specified");
  const [formAlias, setFormAlias] = useState<string>("");
  const [formSubject, setFormSubject] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formHoneypot, setFormHoneypot] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPostId, setCopiedPostId] = useState<number | null>(null);

  // Tracking Lookup State
  const [lookupCode, setLookupCode] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<TrackedMessageResult | null>(
    null
  );
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Public Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);

  // Admin Response Editor Modal / State
  const [replyingMessage, setReplyingMessage] =
    useState<AnonymousMessageItem | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyPublish, setReplyPublish] = useState(true);
  const [replySaving, setReplySaving] = useState(false);

  // Admin Deletion State
  const [deletingMessage, setDeletingMessage] =
    useState<AnonymousMessageItem | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Visual viewport tracking for mobile devices (especially iOS Safari)
  // When keyboard opens on iOS, window.visualViewport.height shrinks, but 100dvh does not.
  const [vvHeight, setVvHeight] = useState<number | null>(null);
  const [vvTop, setVvTop] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      setVvHeight(window.visualViewport.height);
      setVvTop(window.visualViewport.offsetTop);
    };

    handleViewportChange();
    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, []);

  // Prevent background page scrolling & shifting while any modal is open on mobile and desktop
  const isAnyModalOpen = Boolean(
    showAddModal ||
    showTrackModal ||
    replyingMessage ||
    deletingMessage
  );

  useEffect(() => {
    if (!isAnyModalOpen) return;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalLeft = document.body.style.left;
    const originalRight = document.body.style.right;
    const originalWidth = document.body.style.width;
    const originalOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.documentElement.dataset.modalOpen = "true";

    // Enforce 0 window scroll while modal is active so Safari does not push the layout viewport
    const handleWindowScroll = () => {
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowAddModal(false);
        setShowTrackModal(false);
        setReplyingMessage(null);
        setDeletingMessage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      delete document.documentElement.dataset.modalOpen;
      window.removeEventListener("scroll", handleWindowScroll);
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.left = originalLeft;
      document.body.style.right = originalRight;
      document.body.style.width = originalWidth;
      window.scrollTo(0, scrollY);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAnyModalOpen]);

  // Toast Auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Load liked messages and replies from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("sk_tocok_liked_messages");
        if (stored) {
          setLikedIds(JSON.parse(stored));
        }
        const storedReplyLikes = localStorage.getItem("sk_tocok_liked_replies");
        if (storedReplyLikes) {
          setLikedReplyIds(JSON.parse(storedReplyLikes));
        }
      } catch {
        // Ignore JSON error
      }
    }
  }, []);

  // Retrieve or initialize persistent anonymous alias from localStorage so it doesn't change every time
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const storedAlias = localStorage.getItem("sk_tocok_anon_alias");
        if (storedAlias && storedAlias.trim()) {
          setFormAlias(storedAlias.trim());
        } else {
          const generated = generateRandomAlias();
          localStorage.setItem("sk_tocok_anon_alias", generated);
          setFormAlias(generated);
        }
      } catch {
        setFormAlias((prev) => prev || generateRandomAlias());
      }
    }
  }, []);

  const getPersistentAlias = useCallback(() => {
    if (formAlias && formAlias.trim()) return formAlias.trim();
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("sk_tocok_anon_alias");
        if (stored && stored.trim()) {
          setFormAlias(stored.trim());
          return stored.trim();
        }
        const created = generateRandomAlias();
        localStorage.setItem("sk_tocok_anon_alias", created);
        setFormAlias(created);
        return created;
      } catch {
        // ignore
      }
    }
    const fallback = generateRandomAlias();
    setFormAlias(fallback);
    return fallback;
  }, [formAlias]);

  // Fetch Public Messages
  const fetchPublicMessages = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        if (selectedCategory !== "all") params.set("category", selectedCategory);
        if (sortBy) params.set("sort", sortBy);
        if (publicSearch.trim()) params.set("q", publicSearch.trim());

        const res = await fetch(`/api/messages?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setPublicMessages(data.messages || []);
          setCategoryCounts(data.categoryCounts || {});
        } else {
          setToast({
            type: "error",
            message: data.error || "Failed to load public messages.",
          });
        }
      } catch (err) {
        console.error("fetchPublicMessages error:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedCategory, sortBy, publicSearch]
  );

  // Fetch Admin Messages
  const fetchAdminMessages = useCallback(
    async (silent = false) => {
      if (!isAdmin) return;
      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        if (adminStatusFilter !== "all") params.set("status", adminStatusFilter);
        if (adminCategoryFilter !== "all")
          params.set("category", adminCategoryFilter);
        if (adminSearch.trim()) params.set("q", adminSearch.trim());

        const res = await fetch(`/api/admin/messages?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setAdminMessages(data.messages || []);
          setAdminStats(
            data.stats || {
              total: 0,
              pending: 0,
              approved: 0,
              private_answered: 0,
              rejected: 0,
              archived: 0,
              publicCount: 0,
            }
          );
        } else {
          setToast({
            type: "error",
            message: data.error || "Failed to load admin messages.",
          });
        }
      } catch (err) {
        console.error("fetchAdminMessages error:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAdmin, adminStatusFilter, adminCategoryFilter, adminSearch]
  );

  // Trigger data load
  useEffect(() => {
    if (isAdmin) {
      fetchAdminMessages();
    } else {
      fetchPublicMessages();
    }
  }, [isAdmin, fetchAdminMessages, fetchPublicMessages]);

  // Handle Like Upvote (Toggle support: upvote or take back upvote)
  const handleLike = async (id: number) => {
    tactileFeedback("pop");
    setAnimatingLikeIds((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setAnimatingLikeIds((prev) => ({ ...prev, [id]: false }));
    }, 450);

    const isCurrentlyLiked = likedIds.includes(id);

    if (isCurrentlyLiked) {
      // Take back upvote
      const nextLiked = likedIds.filter((item) => item !== id);
      setLikedIds(nextLiked);
      setPublicMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, likes_count: Math.max(0, (m.likes_count || 0) - 1) }
            : m
        )
      );

      try {
        localStorage.setItem(
          "sk_tocok_liked_messages",
          JSON.stringify(nextLiked)
        );
        await fetch(`/api/messages/${id}/like?unlike=true`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unlike: true }),
        });
      } catch {
        // Ignore background like failure
      }
    } else {
      // Upvote
      const nextLiked = [...likedIds, id];
      setLikedIds(nextLiked);
      setPublicMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, likes_count: (m.likes_count || 0) + 1 } : m
        )
      );

      try {
        localStorage.setItem(
          "sk_tocok_liked_messages",
          JSON.stringify(nextLiked)
        );
        await fetch(`/api/messages/${id}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unlike: false }),
        });
      } catch {
        // Ignore background like failure
      }
    }
  };

  // Reddit-style Replies & Comments Handlers
  const fetchReplies = async (messageId: number) => {
    setLoadingReplies((prev) => ({ ...prev, [messageId]: true }));
    try {
      const res = await fetch(`/api/messages/${messageId}/replies`);
      const data = await res.json();
      if (data.success) {
        setRepliesByPost((prev) => ({
          ...prev,
          [messageId]: data.replies || [],
        }));
      }
    } catch (err) {
      console.error("fetchReplies error:", err);
    } finally {
      setLoadingReplies((prev) => ({ ...prev, [messageId]: false }));
    }
  };

  const toggleReplies = async (messageId: number) => {
    tactileFeedback("toggle");
    setOpenComments((prev) => {
      const nextState = !prev[messageId];
      if (nextState && !repliesByPost[messageId]) {
        fetchReplies(messageId);
      }
      return { ...prev, [messageId]: nextState };
    });
  };

  const handleSelectReplyTo = (
    messageId: number,
    target: { id: number; alias: string } | null
  ) => {
    tactileFeedback(target ? "tap" : "toggle");
    setReplyingToByPost((prev) => ({
      ...prev,
      [messageId]: target,
    }));
    if (target) {
      setTimeout(() => {
        const input = document.getElementById(`reply-input-${messageId}`);
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 50);
    }
  };

  const handleAddReply = async (messageId: number, parentId?: number | null) => {
    tactileFeedback("tap");
    const text = (replyInputs[messageId] || "").trim();
    if (!text) return;

    const currentAlias = formAlias.trim() || getPersistentAlias();
    setSubmittingReply((prev) => ({ ...prev, [messageId]: true }));

    try {
      const res = await fetch(`/api/messages/${messageId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias: currentAlias,
          reply: text,
          parent_id: parentId || null,
        }),
      });

      const data = await res.json();
      if (data.success && data.reply) {
        tactileFeedback("success");
        setNewlyAddedReplyId(data.reply.id);
        setTimeout(() => setNewlyAddedReplyId(null), 3000);
        setRepliesByPost((prev) => ({
          ...prev,
          [messageId]: [...(prev[messageId] || []), data.reply],
        }));
        setReplyInputs((prev) => ({ ...prev, [messageId]: "" }));
        setReplyingToByPost((prev) => ({ ...prev, [messageId]: null }));
        if (typeof document !== "undefined") {
          const el = document.getElementById(`reply-input-${messageId}`) as HTMLTextAreaElement | null;
          if (el) el.style.height = "auto";
        }
        setPublicMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, replies_count: (m.replies_count || 0) + 1 }
              : m
          )
        );
      } else {
        setToast({
          type: "error",
          message: data.error || "Failed to post reply.",
        });
      }
    } catch (err) {
      console.error("Reply error:", err);
      setToast({
        type: "error",
        message: "Failed to post reply.",
      });
    } finally {
      setSubmittingReply((prev) => ({ ...prev, [messageId]: false }));
    }
  };

  const handleLikeReply = async (replyId: number, messageId: number) => {
    tactileFeedback("pop");
    setAnimatingReplyLikeIds((prev) => ({ ...prev, [replyId]: true }));
    setTimeout(() => {
      setAnimatingReplyLikeIds((prev) => ({ ...prev, [replyId]: false }));
    }, 450);

    const isCurrentlyLiked = likedReplyIds.includes(replyId);

    if (isCurrentlyLiked) {
      // Take back reply upvote
      const nextLiked = likedReplyIds.filter((id) => id !== replyId);
      setLikedReplyIds(nextLiked);
      setRepliesByPost((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] || []).map((r) =>
          r.id === replyId
            ? { ...r, likes_count: Math.max(0, (r.likes_count || 0) - 1) }
            : r
        ),
      }));

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            "sk_tocok_liked_replies",
            JSON.stringify(nextLiked)
          );
        } catch {
          // ignore
        }
      }

      try {
        await fetch(`/api/messages/replies/${replyId}/like?unlike=true`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unlike: true }),
        });
      } catch {
        // ignore
      }
    } else {
      // Upvote reply
      const nextLiked = [...likedReplyIds, replyId];
      setLikedReplyIds(nextLiked);
      setRepliesByPost((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] || []).map((r) =>
          r.id === replyId ? { ...r, likes_count: (r.likes_count || 0) + 1 } : r
        ),
      }));

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            "sk_tocok_liked_replies",
            JSON.stringify(nextLiked)
          );
        } catch {
          // ignore
        }
      }

      try {
        await fetch(`/api/messages/replies/${replyId}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unlike: false }),
        });
      } catch {
        // ignore
      }
    }
  };

  const handleShare = async (msg: PublicMessageItem) => {
    tactileFeedback("tap");
    if (typeof window === "undefined") return;

    const shareUrl = `${window.location.origin}/messages?code=${encodeURIComponent(
      msg.tracking_code
    )}`;
    const shareText =
      msg.subject && msg.subject !== "Community Suggestion"
        ? msg.subject
        : msg.message.slice(0, 80);

    // 1. Try native Web Share API first (on mobile/tablets where supported)
    if (
      typeof navigator !== "undefined" &&
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ url: shareUrl })
    ) {
      try {
        await navigator.share({
          title: "Bumo-Boses | SK Tocok",
          text: shareText,
          url: shareUrl,
        });
        tactileFeedback("success");
        setToast({ type: "success", message: "Shared successfully!" });
        return;
      } catch (err: unknown) {
        // User cancelled / dismissed native share sheet
        if ((err as Error)?.name === "AbortError") {
          return;
        }
      }
    }

    // 2. Clipboard copy: modern API (works in HTTPS / secure context)
    let copied = false;
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      window.isSecureContext
    ) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
      } catch {
        copied = false;
      }
    }

    // 3. Fallback for HTTP / local IP / mobile browsers without clipboard permission
    if (!copied) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      tactileFeedback("success");
      setCopiedPostId(msg.id);
      setTimeout(() => setCopiedPostId(null), 2500);
      setToast({ type: "success", message: "Link copied to clipboard!" });
    } else {
      setToast({
        type: "info",
        message: `Post code: ${msg.tracking_code}`,
      });
    }
  };

  // Handle Submit Form
  const handleSubmitMessage = async (e?: React.FormEvent) => {
    tactileFeedback("tap");
    if (e) e.preventDefault();
    setFormError(null);

    const trimmedMsg = formMessage.trim();
    if (!trimmedMsg || trimmedMsg.length < 5) {
      setFormError("Please enter your suggestion or message (at least 5 characters).");
      return;
    }

    setFormSubmitting(true);
    try {
      const aliasToSend = formAlias.trim() || getPersistentAlias();
      const firstLine = trimmedMsg.split(/[\n.!?]/)[0]?.trim() || "";
      const subjectToSend =
        firstLine.length >= 3
          ? firstLine.length > 60
            ? firstLine.slice(0, 57) + "..."
            : firstLine
          : "Community Suggestion";

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "Suggestion",
          purok: null,
          alias: aliasToSend,
          subject: subjectToSend,
          message: trimmedMsg,
          honeypot: formHoneypot,
        }),
      });

      const data = await res.json();
      if (data.success) {
        tactileFeedback("success");
        setShowAddModal(false);
        setFormMessage("");
        setFormSubject("");
        setFormError(null);
        if (data.id) {
          setNewlyAddedPostId(data.id);
          setTimeout(() => setNewlyAddedPostId(null), 4000);
        }
        fetchPublicMessages(true);
      } else {
        setFormError(data.error || "Failed to submit. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setFormError("A network error occurred. Please try again.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Tracking Lookup
  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = lookupCode.trim().toUpperCase();
    if (!code) {
      setLookupError("Please enter a tracking code.");
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const res = await fetch(`/api/messages/track?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.success && data.message) {
        setLookupResult(data.message);
      } else {
        setLookupError(data.error || "Tracking code not found.");
      }
    } catch (err) {
      console.error(err);
      setLookupError("Failed to look up message. Please check your connection.");
    } finally {
      setLookupLoading(false);
    }
  };

  // Copy tracking code
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    setToast({ type: "info", message: "Tracking code copied to clipboard!" });
  };

  // Admin: Save reply and publish state
  const handleSaveReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingMessage) return;

    setReplySaving(true);
    try {
      const res = await fetch(`/api/admin/messages/${replyingMessage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_reply: replyText.trim(),
          is_public: replyPublish,
          status: replyPublish ? "approved" : "private_answered",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({
          type: "success",
          message: "Council response saved successfully!",
        });
        setReplyingMessage(null);
        fetchAdminMessages(true);
      } else {
        setToast({ type: "error", message: data.error || "Failed to save reply." });
      }
    } catch (err) {
      console.error(err);
      setToast({ type: "error", message: "Network error saving response." });
    } finally {
      setReplySaving(false);
    }
  };

  // Admin: Quick toggle public / pin / status
  const handleQuickUpdate = async (
    id: number,
    patch: Partial<AnonymousMessageItem>
  ) => {
    try {
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: "Message updated." });
        fetchAdminMessages(true);
      } else {
        setToast({ type: "error", message: data.error || "Update failed." });
      }
    } catch {
      setToast({ type: "error", message: "Failed to update message." });
    }
  };

  // Admin: Delete message
  const handleDeleteMessage = async () => {
    if (!deletingMessage) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/messages/${deletingMessage.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: "Message deleted permanently." });
        setDeletingMessage(null);
        fetchAdminMessages(true);
      } else {
        setToast({ type: "error", message: data.error || "Delete failed." });
      }
    } catch {
      setToast({ type: "error", message: "Failed to delete message." });
    } finally {
      setDeleteBusy(false);
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return "";
    try {
      return new Date(isoString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-[120] max-w-[90vw] animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium pointer-events-auto ${
              toast.type === "success"
                ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20"
                : toast.type === "error"
                ? "bg-rose-600 text-white border-rose-500 shadow-rose-500/20"
                : "bg-slate-900 text-white border-slate-700 shadow-slate-900/30"
            }`}
          >
            {toast.type === "success" && <Check className="w-4 h-4 shrink-0" />}
            {toast.type === "error" && (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            {toast.type === "info" && <Copy className="w-4 h-4 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ADMIN VIEW HEADER & STATS */}
      {isAdmin ? (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200/70 dark:border-brand-800/70">
                  <MessageSquareQuote className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Bumo-Boses
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300">
                      Council Moderation
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Review incoming resident suggestions, write official responses, and approve public posts.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAdminMessages(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                title="Refresh messages"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
                <span>Refresh</span>
              </button>
              <Link
                href="/messages"
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/60 hover:bg-brand-100 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 text-xs font-semibold transition-colors border border-brand-200/70 dark:border-brand-800/70"
              >
                <span>View Public Board</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Received
              </span>
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 block">
                {adminStats.total}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/20 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                  Pending Review
                </span>
                {adminStats.pending > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </div>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
                {adminStats.pending}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-50/20 shadow-xs">
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                Public on Wall
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                {adminStats.publicCount}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-sky-200/70 dark:border-sky-800/50 bg-sky-50/20 shadow-xs">
              <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wider block">
                Private Answers
              </span>
              <span className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1 block">
                {adminStats.private_answered}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Archived
              </span>
              <span className="text-2xl font-black text-slate-600 dark:text-slate-400 mt-1 block">
                {adminStats.archived}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-200/70 dark:border-rose-800/50 bg-rose-50/20 shadow-xs">
              <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">
                Declined / Hidden
              </span>
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block">
                {adminStats.rejected}
              </span>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  placeholder="Search by keyword, subject, tracking code, or alias..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {adminSearch && (
                  <button
                    onClick={() => setAdminSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                <select
                  value={adminStatusFilter}
                  onChange={(e) => setAdminStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending Review</option>
                  <option value="approved">Approved</option>
                  <option value="private_answered">Private Answered</option>
                  <option value="rejected">Rejected / Hidden</option>
                  <option value="archived">Archived</option>
                </select>

                <select
                  value={adminCategoryFilter}
                  onChange={(e) => setAdminCategoryFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">All Categories</option>
                  {MESSAGE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Admin Messages List */}
          {loading ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading messages...</p>
            </div>
          ) : adminMessages.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <MessageSquareQuote className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No messages match your criteria
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Try resetting your status or category filters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {adminMessages.map((item) => {
                const statusMeta = getStatusBadge(item.status, item.is_public);
                const categoryClass = getCategoryBadgeClass(item.category);

                return (
                  <div
                    key={item.id}
                    className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-xs transition-all space-y-4 ${
                      item.status === "pending"
                        ? "border-amber-300 dark:border-amber-700/70 ring-1 ring-amber-300/40 dark:ring-amber-700/30"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {/* Top Meta Line */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${categoryClass}`}
                        >
                          {item.category}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>

                        {item.is_pinned && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1">
                            <Pin className="w-3 h-3 fill-amber-500" />
                            Pinned
                          </span>
                        )}

                        {item.purok && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {item.purok}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          <span>{item.tracking_code}</span>
                          <button
                            onClick={() => handleCopyCode(item.tracking_code)}
                            title="Copy Code"
                            className="hover:text-brand-600"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Subject & Message Content */}
                    <div className="space-y-1.5">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {item.subject}
                        </h3>
                        <span className="text-xs text-slate-500 inline-flex items-center gap-1.5">
                          <AnonymousAvatar alias={item.alias} size="xs" />
                          <span>by</span>
                          <strong className="text-slate-700 dark:text-slate-300">
                            u/{item.alias.replace(/^u\//i, "")}
                          </strong>
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50/70 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                        {item.message}
                      </p>
                    </div>

                    {/* Council Response Preview */}
                    {item.admin_reply && (
                      <div className="bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-800/70 rounded-xl p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-brand-800 dark:text-brand-200 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
                            Official Reply by {item.replied_by || "SK Council"}
                          </span>
                          {item.replied_at && (
                            <span className="text-[11px] text-brand-700 dark:text-brand-400">
                              {formatDate(item.replied_at)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-brand-950 dark:text-brand-100 whitespace-pre-wrap leading-relaxed">
                          {item.admin_reply}
                        </p>
                      </div>
                    )}

                    {/* Admin Actions Toolbar */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Write / Edit Reply Button */}
                        <button
                          onClick={() => {
                            setReplyingMessage(item);
                            setReplyText(item.admin_reply || "");
                            setReplyPublish(item.is_public);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-xs transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {item.admin_reply ? "Edit Response" : "Write Official Response"}
                          </span>
                        </button>

                        {/* Quick Status Toggles */}
                        <button
                          onClick={() =>
                            handleQuickUpdate(item.id, {
                              is_public: !item.is_public,
                              status: !item.is_public ? "approved" : "private_answered",
                            })
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                            item.is_public
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          {item.is_public ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Published on Wall</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Make Public</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() =>
                            handleQuickUpdate(item.id, {
                              is_pinned: !item.is_pinned,
                            })
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-semibold transition-colors ${
                            item.is_pinned
                              ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                          title="Pin to top of public board"
                        >
                          <Pin className={`w-3.5 h-3.5 ${item.is_pinned ? "fill-amber-500" : ""}`} />
                          <span>{item.is_pinned ? "Unpin" : "Pin"}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status Select dropdown */}
                        <select
                          value={item.status}
                          onChange={(e) =>
                            handleQuickUpdate(item.id, {
                              status: e.target.value as MessageStatus,
                              is_public: e.target.value === "approved" ? true : item.is_public,
                            })
                          }
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved & Public</option>
                          <option value="private_answered">Private Answered</option>
                          <option value="rejected">Declined</option>
                          <option value="archived">Archived</option>
                        </select>

                        {/* Delete Button */}
                        <button
                          onClick={() => setDeletingMessage(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors"
                          title="Delete message"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Response Editor Modal */}
          {mounted && replyingMessage && createPortal(
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) setReplyingMessage(null);
              }}
              className="fixed z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 touch-none overscroll-none"
              style={{
                position: "fixed",
                top: vvTop ? `${vvTop}px` : "0px",
                left: "0px",
                right: "0px",
                bottom: "0px",
                height: vvHeight ? `${vvHeight}px` : "100%",
                paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
                paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
                paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
                paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
              }}
            >
              <div
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                style={{
                  maxHeight: vvHeight
                    ? `calc(${vvHeight}px - 1rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`
                    : "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
                }}
              >
                {/* Pinned Header */}
                <div className="shrink-0 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-brand-600" />
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                      Official Council Response
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingMessage(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form
                  onSubmit={handleSaveReply}
                  className="flex flex-col flex-1 min-h-0 overflow-hidden"
                >
                  {/* Scrollable Middle Area */}
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4 sm:px-6 py-4 space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
                        <span>{replyingMessage.subject}</span>
                        <span className="font-mono">{replyingMessage.tracking_code}</span>
                      </div>
                      <p className="text-slate-500 line-clamp-2">
                        {replyingMessage.message}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        Council Response Message
                      </label>
                      <textarea
                        rows={5}
                        required
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write the official response from the Sangguniang Kabataan..."
                        className="w-full p-3 text-base sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-3 bg-brand-50/40 dark:bg-brand-950/30 p-3 rounded-xl border border-brand-200/60 dark:border-brand-800/60 text-xs">
                      <input
                        type="checkbox"
                        id="publishCheck"
                        checked={replyPublish}
                        onChange={(e) => setReplyPublish(e.target.checked)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                      />
                      <label
                        htmlFor="publishCheck"
                        className="cursor-pointer text-slate-700 dark:text-slate-300 font-medium"
                      >
                        Publish message and response to the Public Freedom Wall
                        <span className="block text-[11px] text-slate-500">
                          If unchecked, response is only viewable privately by the sender using their tracking code.
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Pinned Footer */}
                  <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReplyingMessage(null)}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={replySaving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs"
                    >
                      {replySaving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Save & Post Response</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

          {/* Delete Confirmation Modal */}
          {mounted && deletingMessage && createPortal(
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) setDeletingMessage(null);
              }}
              className="fixed z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 touch-none overscroll-none"
              style={{
                position: "fixed",
                top: vvTop ? `${vvTop}px` : "0px",
                left: "0px",
                right: "0px",
                bottom: "0px",
                height: vvHeight ? `${vvHeight}px` : "100%",
                paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
                paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
                paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
                paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
              }}
            >
              <div
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-sm w-full p-5 sm:p-6 space-y-4 text-center overflow-y-auto overscroll-contain touch-pan-y animate-in fade-in zoom-in-95 duration-150"
                style={{
                  maxHeight: vvHeight
                    ? `calc(${vvHeight}px - 1rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`
                    : "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
                }}
              >
                <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                    Delete Message Permanently?
                  </h3>
                  <p className="text-xs text-slate-500">
                    This action cannot be undone. Code:{" "}
                    <strong className="font-mono text-slate-700 dark:text-slate-300">
                      {deletingMessage.tracking_code}
                    </strong>
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setDeletingMessage(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteMessage}
                    disabled={deleteBusy}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
                  >
                    {deleteBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      ) : (
        /* PUBLIC VIEW - ULTRA SIMPLE & MINIMALIST */
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Floating Action Button (FAB) to Add Suggestion - Matching Admin Page FAB Exactly */}
          <div
            data-page-fab
            className={`fixed right-4 sm:right-6 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6 md:right-6 z-30 pointer-events-auto flex items-center gap-2.5 sm:gap-3 transition-all duration-200 ${
              isAnyModalOpen
                ? "opacity-0 pointer-events-none scale-75"
                : "opacity-100 scale-100"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                tactileFeedback("pop");
                if (!formAlias) {
                  getPersistentAlias();
                }
                setFormMessage("");
                setShowAddModal(true);
                setFormError(null);
              }}
              aria-label="Add Suggestion"
              title="Add Suggestion"
              className="relative w-14 h-14 md:w-12 md:h-12 rounded-full bg-brand-700 hover:bg-brand-800 text-white shadow-xl md:shadow-lg shadow-brand-950/25 hover:shadow-brand-900/35 border border-white/20 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-90 transition-all duration-200 group focus:outline-none focus:ring-4 focus:ring-brand-500/30 tactile-fab"
            >
              <Plus className="w-6 h-6 md:w-5 md:h-5 stroke-[2.5] transition-transform duration-200 group-hover:rotate-90" />

              {/* Tooltip on Desktop hover */}
              <span className="hidden md:group-hover:block absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 dark:border dark:border-slate-700 text-white text-xs font-semibold whitespace-nowrap shadow-md pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                Add Suggestion
              </span>
            </button>
          </div>

          {/* Message Cards List */}
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
              <p className="text-xs">Loading suggestions &amp; messages...</p>
            </div>
          ) : publicMessages.length === 0 ? (
            <div className="py-14 px-4 text-center flex flex-col items-center justify-center animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 flex items-center justify-center border border-slate-200/80 dark:border-slate-700/60 shadow-2xs mb-3.5">
                <MessageSquareQuote className="w-7 h-7" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                No posts yet on Bumo-Boses
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-4">
                Be the first to share an anonymous thought, idea, or question with the community and the SK Council.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!formAlias) {
                    getPersistentAlias();
                  }
                  setFormMessage("");
                  setShowAddModal(true);
                  setFormError(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-50 dark:bg-brand-950/70 hover:bg-brand-100 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800/70 text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create the First Post</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
                  {publicMessages.map((msg) => {
                    const isLiked = likedIds.includes(msg.id);
                    const isNewlyAddedPost = newlyAddedPostId === msg.id;

                    return (
                      <div
                        key={msg.id}
                        className={`bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border transition-all duration-300 p-3.5 sm:p-4.5 space-y-3 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 ${
                          isNewlyAddedPost
                            ? "animate-new-post ring-2 ring-brand-500/50 border-brand-400"
                            : msg.is_pinned
                            ? "border-emerald-300/80 dark:border-emerald-800/80 bg-emerald-50/10"
                            : "border-slate-200/90 dark:border-slate-800"
                        }`}
                      >
                        {/* Reddit Header: Avatar, u/Alias, Time, Flair */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <AnonymousAvatar alias={msg.alias} size="md" />
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                u/{msg.alias.replace(/^u\//i, "")}
                              </span>
                              {isNewlyAddedPost && (
                                <span className="text-[9px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-100 dark:bg-brand-950/80 px-1.5 py-0.2 rounded-full animate-in fade-in zoom-in-95 duration-200">
                                  Just posted
                                </span>
                              )}
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-400 text-[11px]">
                                {formatTimeAgo(msg.created_at)}
                              </span>
                              {msg.purok && (
                                <>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                                    {msg.purok}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {msg.is_pinned && (
                              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Pin className="w-2.5 h-2.5 fill-emerald-600 text-emerald-600" />
                                Pinned
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Message Content */}
                        <div className="sm:pl-9">
                          <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                            {msg.message}
                          </p>
                        </div>

                        {/* Official SK Council Sticky Response (if replied) */}
                        {msg.admin_reply && (
                          <div className="sm:ml-9 border-l-2 border-emerald-500 pl-3 py-1.5 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-r-lg space-y-1 my-2">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                SK Council Response
                                <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded">
                                  MOD
                                </span>
                              </span>
                              {msg.replied_at && (
                                <span className="text-slate-400 text-[10px]">
                                  {formatTimeAgo(msg.replied_at)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                              {msg.admin_reply}
                            </p>
                            {msg.replied_by && (
                              <p className="text-[10px] text-slate-500">
                                — {msg.replied_by}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Reddit Action Bar: Upvote, Comments, Share */}
                        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-xs flex-wrap sm:pl-9">
                          {/* Upvote Pill */}
                          <button
                            onClick={() => handleLike(msg.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 tactile-pill text-xs font-medium cursor-pointer ${
                              isLiked
                                ? "bg-orange-500 text-white font-bold shadow-xs hover:bg-orange-600 scale-[1.02]"
                                : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                            }`}
                            title="Upvote"
                          >
                            <ArrowBigUp
                              className={`w-4 h-4 transition-transform duration-200 ${
                                isLiked ? "fill-white" : ""
                              } ${
                                animatingLikeIds[msg.id]
                                  ? "animate-upvote-pop"
                                  : "hover:-translate-y-0.5"
                              }`}
                            />
                            <span
                              className={`transition-transform duration-200 ${
                                animatingLikeIds[msg.id]
                                  ? "font-bold scale-115"
                                  : ""
                              }`}
                            >
                              {msg.likes_count || 0}
                            </span>
                          </button>

                          {/* Comments / Reply Pill */}
                          <button
                            onClick={() => toggleReplies(msg.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 tactile-pill cursor-pointer ${
                              openComments[msg.id]
                                ? "bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200/80 dark:border-brand-800/80 font-semibold shadow-2xs scale-[1.02]"
                                : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                            }`}
                            title="Comments & Replies"
                          >
                            <MessageSquare
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                openComments[msg.id]
                                  ? "scale-110 text-brand-600 dark:text-brand-400"
                                  : ""
                              }`}
                            />
                            <span>
                              {msg.replies_count || 0}{" "}
                              {msg.replies_count === 1
                                ? "Comment"
                                : "Comments"}
                            </span>
                          </button>

                          {/* Share Pill */}
                          <button
                            onClick={() => handleShare(msg)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 tactile-pill cursor-pointer ${
                              copiedPostId === msg.id
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold border border-emerald-200/80 dark:border-emerald-800/80 scale-105 shadow-2xs"
                                : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                            }`}
                            title="Share"
                          >
                            {copiedPostId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-in zoom-in duration-200" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Share2 className="w-3.5 h-3.5 transition-transform duration-200 hover:rotate-12" />
                                <span>Share</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Animated Reddit Comment Section Accordion */}
                        <div
                          className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            openComments[msg.id]
                              ? "grid-rows-[1fr] opacity-100 pt-3 border-t border-slate-100 dark:border-slate-800"
                              : "grid-rows-[0fr] opacity-0 pt-0 border-t-0 pointer-events-none"
                          }`}
                        >
                          <div className="overflow-hidden sm:pl-9 space-y-3">
                            {(openComments[msg.id] || repliesByPost[msg.id]) && (() => {
                              const postReplies = repliesByPost[msg.id] || [];
                              const allReplyIds = new Set(postReplies.map((r) => r.id));
                              const repliesByParent: Record<number | "root", AnonymousMessageReply[]> = {
                                root: [],
                              };
                              for (const r of postReplies) {
                                if (r.parent_id && allReplyIds.has(r.parent_id)) {
                                  if (!repliesByParent[r.parent_id]) repliesByParent[r.parent_id] = [];
                                  repliesByParent[r.parent_id].push(r);
                                } else {
                                  repliesByParent.root.push(r);
                                }
                              }

                              const currentReplyTarget = replyingToByPost[msg.id] || null;

                              return (
                                <>
                                  {/* Root Comment Composer: Shown at top ONLY when not actively replying inline */}
                                  {!currentReplyTarget && (
                                    <div className="space-y-1.5 animate-comment-enter">
                                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 focus-within:ring-2 focus-within:ring-brand-500/25 transition-all duration-200">
                                        <AnonymousAvatar
                                          alias={formAlias || "Anonymous Youth"}
                                          size="sm"
                                          className="shrink-0"
                                        />
                                        <textarea
                                          id={`reply-input-${msg.id}`}
                                          rows={1}
                                          value={replyInputs[msg.id] || ""}
                                          onChange={(e) => {
                                            setReplyInputs((prev) => ({
                                              ...prev,
                                              [msg.id]: e.target.value,
                                            }));
                                            e.target.style.height = "auto";
                                            e.target.style.height = `${Math.min(
                                              e.target.scrollHeight,
                                              100
                                            )}px`;
                                          }}
                                          onKeyDown={(e) => {
                                            // On mobile, let Enter insert a new line naturally
                                            if (isMobileDevice()) return;

                                            if (
                                              e.key === "Enter" &&
                                              !e.shiftKey &&
                                              !e.nativeEvent.isComposing
                                            ) {
                                              e.preventDefault();
                                              const text = (
                                                replyInputs[msg.id] || ""
                                              ).trim();
                                              if (text && !submittingReply[msg.id]) {
                                                handleAddReply(msg.id, null);
                                              }
                                            }
                                          }}
                                          placeholder="What are your thoughts?"
                                          className="flex-1 py-1.5 px-3 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none leading-normal min-h-[36px] max-h-[100px]"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleAddReply(msg.id, null)}
                                          disabled={
                                            submittingReply[msg.id] ||
                                            !(replyInputs[msg.id] || "").trim()
                                          }
                                          title="Comment (Enter on desktop)"
                                          className="px-3 py-1.5 h-9 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-2xs hover:shadow-xs tactile-btn"
                                        >
                                          {submittingReply[msg.id] ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <>
                                              <Send className="w-3.5 h-3.5 transition-transform duration-200 hover:translate-x-0.5 hover:-translate-y-0.5" />
                                              <span className="hidden sm:inline">Comment</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Comments List */}
                                  {loadingReplies[msg.id] ? (
                                    <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2 animate-pulse">
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                                      <span>Loading comments...</span>
                                    </div>
                                  ) : postReplies.length === 0 ? (
                                    <p className="text-center text-xs text-slate-400 py-3 animate-in fade-in duration-200">
                                      No comments yet. Be the first to share your thoughts!
                                    </p>
                                  ) : (
                                    <div className="space-y-3 pt-1">
                                      {repliesByParent.root.map((rootReply) => (
                                        <ThreadedCommentItem
                                          key={rootReply.id}
                                          reply={rootReply}
                                          depth={1}
                                          messageId={msg.id}
                                          repliesByParent={repliesByParent}
                                          likedReplyIds={likedReplyIds}
                                          selectedReplyTo={currentReplyTarget}
                                          onSelectReplyTo={(target) =>
                                            handleSelectReplyTo(msg.id, target)
                                          }
                                          onLikeReply={handleLikeReply}
                                          animatingReplyLikeIds={animatingReplyLikeIds}
                                          replyInput={replyInputs[msg.id] || ""}
                                          onReplyInputChange={(val) =>
                                            setReplyInputs((prev) => ({
                                              ...prev,
                                              [msg.id]: val,
                                            }))
                                          }
                                          onSubmitReply={(parentId) =>
                                            handleAddReply(msg.id, parentId)
                                          }
                                          submittingReply={Boolean(
                                            submittingReply[msg.id]
                                          )}
                                          userAlias={formAlias || "Anonymous Youth"}
                                          newlyAddedReplyId={newlyAddedReplyId}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          {/* =========================================================================
              MODAL: ADD SUGGESTION / MESSAGE
              ========================================================================= */}
          {mounted && showAddModal && createPortal(
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowAddModal(false);
              }}
              className="fixed z-[100] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 touch-none overscroll-none"
              style={{
                position: "fixed",
                top: vvTop ? `${vvTop}px` : "0px",
                left: "0px",
                right: "0px",
                bottom: "0px",
                height: vvHeight ? `${vvHeight}px` : "100%",
                paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
                paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
                paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
                paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
              }}
            >
              <div
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                style={{
                  maxHeight: vvHeight
                    ? `calc(${vvHeight}px - 1rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`
                    : "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
                }}
              >
                {/* 1. PINNED HEADER (shrink-0) */}
                <div className="shrink-0 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                    Post
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form
                  onSubmit={handleSubmitMessage}
                  className="flex flex-col flex-1 min-h-0 overflow-hidden"
                >
                  {/* 2. MIDDLE CONTENT AREA (flex-1 min-h-0 overflow-y-auto) */}
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4 sm:px-6 py-4 space-y-4">
                    {/* Big Centered Profile Picture & Alias */}
                    <div className="text-center py-1 sm:py-2 space-y-1.5 sm:space-y-2">
                      <div className="flex justify-center">
                        <AnonymousAvatar
                          alias={formAlias || "Anonymous Youth"}
                          size="xl"
                          className="ring-4 ring-brand-500/25 shadow-lg"
                        />
                      </div>
                      <div className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        u/{formAlias.replace(/^u\//i, "") || "Anonymous Youth"}
                      </div>
                    </div>

                    <input
                      type="text"
                      name="website"
                      value={formHoneypot}
                      onChange={(e) => setFormHoneypot(e.target.value)}
                      style={{ display: "none" }}
                      tabIndex={-1}
                      autoComplete="off"
                    />

                    {formError && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* Single Suggestion / Message Input */}
                    <textarea
                      rows={4}
                      required
                      maxLength={3000}
                      value={formMessage}
                      onChange={(e) => setFormMessage(e.target.value)}
                      onKeyDown={(e) => {
                        // On mobile, let Enter insert a new line naturally
                        if (isMobileDevice()) return;

                        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          const text = formMessage.trim();
                          if (text.length >= 5 && !formSubmitting) {
                            handleSubmitMessage();
                          }
                        }
                      }}
                      placeholder="Write your suggestion, community idea, concern, or message for the SK Council..."
                      className="w-full p-3 sm:p-3.5 text-base sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none leading-relaxed"
                    />
                  </div>

                  {/* 3. PINNED FOOTER (shrink-0) */}
                  <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      Press <kbd className="px-1 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600">Enter ↵</kbd> to post, <kbd className="px-1 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600">Shift+Enter</kbd> for new line
                    </span>
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => setShowAddModal(false)}
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={formSubmitting}
                        className="px-6 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        {formSubmitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Posting...</span>
                          </>
                        ) : (
                          <span>Post</span>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

          {/* =========================================================================
              MODAL: TRACK STATUS
              ========================================================================= */}
          {mounted && showTrackModal && createPortal(
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowTrackModal(false);
              }}
              className="fixed z-[100] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 touch-none overscroll-none"
              style={{
                position: "fixed",
                top: vvTop ? `${vvTop}px` : "0px",
                left: "0px",
                right: "0px",
                bottom: "0px",
                height: vvHeight ? `${vvHeight}px` : "100%",
                paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
                paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
                paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
                paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
              }}
            >
              <div
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                style={{
                  maxHeight: vvHeight
                    ? `calc(${vvHeight}px - 1rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`
                    : "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
                }}
              >
                {/* Pinned Header */}
                <div className="shrink-0 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 bg-white dark:bg-slate-900">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Track Your Suggestion
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Enter your tracking code (e.g. <code className="font-mono">SKM-XXXXXX</code>).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTrackModal(false);
                      setLookupResult(null);
                      setLookupError(null);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4 sm:px-6 py-4 space-y-4">
                  <form onSubmit={handleLookup} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={lookupCode}
                        onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                        placeholder="e.g. SKM-7B2K9X"
                        className="w-full pl-8 pr-3 py-1.5 text-base sm:text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 tracking-wider uppercase"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={lookupLoading}
                      className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium text-xs transition-colors shrink-0 flex items-center gap-1.5 shadow-xs"
                    >
                      {lookupLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Search</span>
                      )}
                    </button>
                  </form>

                  {lookupError && (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{lookupError}</span>
                    </div>
                  )}

                  {lookupResult && (
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3 pt-3">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {lookupResult.tracking_code}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              getStatusBadge(
                                lookupResult.status,
                                lookupResult.is_public
                              ).badgeClass
                            }`}
                          >
                            {
                              getStatusBadge(
                                lookupResult.status,
                                lookupResult.is_public
                              ).label
                            }
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {formatDate(lookupResult.created_at)}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {lookupResult.subject}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {lookupResult.message}
                        </p>
                      </div>

                      {lookupResult.admin_reply ? (
                        <div className="border-l-2 border-brand-500 pl-3 py-1 bg-brand-50/40 dark:bg-brand-950/20 rounded-r-lg space-y-1">
                          <span className="font-semibold text-brand-700 dark:text-brand-300 text-[11px] flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            SK Council Response
                          </span>
                          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                            {lookupResult.admin_reply}
                          </p>
                          {lookupResult.replied_by && (
                            <p className="text-[10px] text-slate-400">
                              — {lookupResult.replied_by}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-2.5 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                          <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                          <div>
                            <strong className="block font-semibold">Active on Board</strong>
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                              Your post is public. Any official response from the council will show here.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      )}
    </div>
  );
}
