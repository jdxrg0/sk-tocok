"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Camera,
  Loader2,
  Lock,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  Trash2,
} from "lucide-react";
import AvatarCropModal from "@/components/AvatarCropModal";
import { useModalAnimation } from "@/lib/useModalAnimation";

export interface OfficialModalData {
  id?: number;
  name: string;
  email?: string | null;
  role: string;
  contact_number?: string | null;
  avatar_url?: string | null;
}

interface OfficialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingOfficial?: OfficialModalData | null;
  defaultRole?: string;
}

const ROLE_OPTIONS = [
  "SK Chairperson",
  "SK Secretary",
  "SK Treasurer",
  "SK Kagawad",
  "Health",
  "Livelihood",
  "Sports",
  "GAD",
  "Education",
  "Environment",
  "Peace & Order",
  "SK Staff / Custodian",
];

export default function OfficialModal({
  isOpen,
  onClose,
  onSuccess,
  editingOfficial,
  defaultRole = "SK Kagawad",
}: OfficialModalProps) {
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { rendered, closing, handleClose } = useModalAnimation(isOpen, onClose);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: defaultRole,
    contact_number: "",
    avatar_url: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  // Avatar cropping state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setAvatarUploadError(null);
      setPendingCropFile(null);
      setShowPassword(false);

      if (editingOfficial) {
        setForm({
          name: editingOfficial.name || "",
          email: editingOfficial.email || "",
          password: "",
          role: editingOfficial.role || defaultRole,
          contact_number: editingOfficial.contact_number || "",
          avatar_url: editingOfficial.avatar_url || "",
        });
      } else {
        setForm({
          name: "",
          email: "",
          password: "",
          role: defaultRole,
          contact_number: "",
          avatar_url: "",
        });
      }
    }
  }, [isOpen, editingOfficial, defaultRole]);

  useEffect(() => {
    if (!isOpen || closing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pendingCropFile && !saving && !deleting) handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closing, handleClose, pendingCropFile, saving, deleting]);

  if (!rendered || !mounted) return null;

  const handleAvatarFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarUploadError("Please select a valid image file (PNG, JPG, WEBP, or GIF).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAvatarUploadError("Image size exceeds maximum 10MB limit.");
      return;
    }

    setAvatarUploadError(null);
    setPendingCropFile(file);
  };

  const handleApplyCroppedAvatar = async (croppedFile: File) => {
    setAvatarUploading(true);
    setAvatarUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", croppedFile);

      const res = await fetch("/api/admin/upload-avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setForm((prev) => ({ ...prev, avatar_url: data.url }));
        setPendingCropFile(null);
      } else {
        setAvatarUploadError(data.error || "Failed to upload profile picture.");
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setAvatarUploadError("Network error while uploading picture.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!editingOfficial && (!form.password || form.password.trim().length < 8)) {
      setError("Password is required and must be at least 8 characters with a letter and number or symbol.");
      return;
    }

    if (form.password && form.password.trim().length > 0 && (form.password.trim().length < 8 || !/[a-zA-Z]/.test(form.password) || !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(form.password))) {
      setError("Password must be at least 8 characters and include a letter plus a number or symbol.");
      return;
    }

    try {
      setSaving(true);
      let res: Response;

      if (editingOfficial?.id) {
        res = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingOfficial.id,
            name: form.name.trim(),
            email: form.email.trim(),
            role: form.role.trim(),
            contact_number: form.contact_number.trim(),
            avatar_url: form.avatar_url.trim() || null,
            password: form.password.trim(),
          }),
        });
      } else {
        res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            role: form.role.trim(),
            contact_number: form.contact_number.trim(),
            avatar_url: form.avatar_url.trim() || null,
            password: form.password.trim(),
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save official profile.");
      }

      onSuccess();
      handleClose();
    } catch (err: unknown) {
      console.error("OfficialModal error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingOfficial?.id) return;
    if (!confirm(`Are you sure you want to remove ${editingOfficial.name} from the SK Council?`)) {
      return;
    }

    try {
      setDeleting(true);
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingOfficial.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete official account.");
      }

      onSuccess();
      handleClose();
    } catch (err: unknown) {
      console.error("Delete official error:", err);
      setError(err instanceof Error ? err.message : "Failed to remove official.");
    } finally {
      setDeleting(false);
    }
  };

  return createPortal(
    <>
      <div
        className={`fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[100] bg-slate-950/55 dark:bg-black/75 backdrop-blur-sm overscroll-contain touch-none ${
          closing ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"
        }`}
        onClick={() => !saving && !deleting && !pendingCropFile && !closing && handleClose()}
        aria-hidden="true"
      />
      <div className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[101] pointer-events-none flex items-end sm:items-center justify-center p-0 sm:p-4 sm:pt-[max(1rem,env(safe-area-inset-top))] sm:pb-[max(1rem,env(safe-area-inset-bottom))] overscroll-contain font-sans">
        <form
          onSubmit={handleSubmit}
          role="dialog"
          aria-modal="true"
          aria-labelledby="official-modal-title"
          style={{
            maxHeight: "calc(100dvh - 1.25rem - env(safe-area-inset-top, 0px))",
          }}
          className={`bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl max-w-[420px] w-full shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 flex flex-col overflow-hidden overscroll-contain ${
            closing ? "pointer-events-none animate-modal-card-out" : "pointer-events-auto animate-modal-card-in"
          }`}
        >
          {/* Mobile Drag Handle */}
          <div className="sm:hidden flex justify-center pt-1.5 pb-0 shrink-0" aria-hidden="true">
            <span className="w-8 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Minimalist Header */}
          <div className="flex items-center justify-between gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
              <h3
                id="official-modal-title"
                className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate"
              >
                {editingOfficial ? "Edit Official" : "New Official"}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={saving || deleting || closing}
              className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-2.5 sm:px-4 sm:py-3 space-y-2 overscroll-contain">
            {error && (
              <div className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Inline Avatar Picker + Full Name Row */}
            <div className="flex items-end gap-2.5">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarFileSelected}
              />

              <button
                type="button"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
                className="relative group w-11 h-11 rounded-full ring-2 ring-slate-200/80 dark:ring-slate-700/80 hover:ring-brand-500 bg-slate-100 dark:bg-slate-800 shrink-0 cursor-pointer transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-600"
                title={form.avatar_url ? "Change profile photo" : "Upload profile photo"}
                aria-label={form.avatar_url ? "Change profile photo" : "Upload profile photo"}
              >
                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                  {form.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.avatar_url}
                      alt={form.name || "Official avatar"}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 font-bold text-sm">
                      {form.name ? form.name.charAt(0).toUpperCase() : <Camera className="w-4 h-4" />}
                    </span>
                  )}
                </div>

                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-brand-700 text-white shadow-xs flex items-center justify-center border-2 border-white dark:border-slate-900">
                  {avatarUploading ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <Camera className="w-2.5 h-2.5" />
                  )}
                </div>
              </button>

              <div className="flex-1 min-w-0">
                <label
                  htmlFor="official-name-input"
                  className="block text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300 mb-1"
                >
                  Full Name <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  id="official-name-input"
                  type="text"
                  required
                  placeholder="e.g. Hon. Maria Santos"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-sm sm:text-[13px] font-medium focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-600 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                />
              </div>
            </div>

            {avatarUploadError && (
              <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">{avatarUploadError}</span>
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="official-role-select"
                  className="block text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300 mb-1"
                >
                  Designation <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <select
                  id="official-role-select"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 text-sm sm:text-[13px] font-medium focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-600 bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer text-slate-900 dark:text-slate-100 transition-all"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  {!ROLE_OPTIONS.includes(form.role) && (
                    <option value={form.role}>{form.role}</option>
                  )}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="official-contact-input"
                    className="text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300"
                  >
                    Mobile
                  </label>
                  <span className="text-[10px] leading-none text-slate-400 dark:text-slate-500 sm:hidden">
                    Optional
                  </span>
                </div>
                <input
                  id="official-contact-input"
                  type="tel"
                  inputMode="tel"
                  placeholder="0912 345 6789"
                  value={form.contact_number}
                  onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-sm sm:text-[13px] font-medium tabular-nums focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-600 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="official-email-input"
                  className="block text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300 mb-1"
                >
                  Email <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    id="official-email-input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    placeholder="maria.santos@sktocok.gov.ph"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-sm sm:text-[13px] font-medium focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-600 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="official-password-input"
                    className="text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300"
                  >
                    {editingOfficial ? "New Password" : "Password"}{" "}
                    {!editingOfficial && <span className="text-rose-500 dark:text-rose-400">*</span>}
                  </label>
                  {editingOfficial && (
                    <span className="text-[10px] leading-none text-slate-400 dark:text-slate-500">
                      Optional
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    id="official-password-input"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={editingOfficial ? "Keep current" : "Min. 8 chars (letter + number/symbol)"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-8 pr-9 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-sm sm:text-[13px] font-medium focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-600 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Minimalist Footer */}
          <div className="px-3.5 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 shrink-0 bg-white dark:bg-slate-900">
            {editingOfficial?.id ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                title="Remove Official"
                aria-label="Remove Official"
                className="h-8 w-8 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shrink-0"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Remove</span>
              </button>
            ) : (
              <span className="hidden sm:block" />
            )}

            <div
              className={
                editingOfficial?.id
                  ? "flex items-center gap-2 flex-1 sm:flex-initial justify-end"
                  : "w-full sm:w-auto grid grid-cols-2 sm:flex sm:items-center gap-2"
              }
            >
              <button
                type="button"
                onClick={handleClose}
                disabled={saving || deleting || closing}
                className="flex-1 sm:flex-initial py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || deleting}
                className="flex-1 sm:flex-initial py-1.5 px-3.5 rounded-xl bg-brand-700 hover:bg-brand-800 active:scale-[0.98] text-white text-xs font-semibold shadow-xs cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{saving ? "Saving..." : editingOfficial ? "Save Changes" : "Add Official"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Avatar Crop Modal Sub-dialog */}
      {pendingCropFile && (
        <AvatarCropModal
          file={pendingCropFile}
          applying={avatarUploading}
          error={avatarUploadError}
          onCancel={() => {
            setPendingCropFile(null);
            setAvatarUploadError(null);
          }}
          onApply={handleApplyCroppedAvatar}
          onChooseAnother={() => avatarInputRef.current?.click()}
        />
      )}
    </>,
    document.body
  );
}
