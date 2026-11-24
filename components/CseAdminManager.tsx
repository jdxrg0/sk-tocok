"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Award,
  Search,
  Download,
  CheckCircle2,
  Trash2,
  Eye,
  ExternalLink,
  Trophy,
  Loader2,
  X,
} from "lucide-react";
import {
  PUROK_OPTIONS,
  getReimbursementBadge,
  getAttendanceBadge,
  getResultBadge,
  type CseApplication,
} from "@/lib/cse";

export default function CseAdminManager() {
  const [applications, setApplications] = useState<CseApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [reimbursementFilter, setReimbursementFilter] = useState("all");
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [purokFilter, setPurokFilter] = useState("all");

  // Selected App for Details / Modals
  const [selectedApp, setSelectedApp] = useState<CseApplication | null>(null);
  const [viewDocsModal, setViewDocsModal] = useState(false);
  const [recordPayoutModal, setRecordPayoutModal] = useState(false);
  const [verifyAttendanceModal, setVerifyAttendanceModal] = useState(false);
  const [verifyResultModal, setVerifyResultModal] = useState(false);

  // Modal form states
  const [voucherNo, setVoucherNo] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("Barangay Hall Cash");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Attendance form
  const [attendanceChoice, setAttendanceChoice] = useState<"Verified Attended" | "Did Not Attend">("Verified Attended");
  const [attendanceAdminNotes, setAttendanceAdminNotes] = useState("");

  // Result form
  const [resultChoice, setResultChoice] = useState<"Passed" | "Did Not Pass">("Passed");
  const [ratingVal, setRatingVal] = useState("");
  const [featureToggle, setFeatureToggle] = useState(true);
  const [resultAdminNotes, setResultAdminNotes] = useState("");

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (reimbursementFilter !== "all") params.set("reimbursementStatus", reimbursementFilter);
      if (attendanceFilter !== "all") params.set("attendanceStatus", attendanceFilter);
      if (resultFilter !== "all") params.set("resultStatus", resultFilter);
      if (purokFilter !== "all") params.set("purok", purokFilter);

      const res = await fetch(`/api/admin/cse?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.applications)) {
        setApplications(data.applications);
      }
    } catch (err) {
      console.error("Error fetching CSE admin applications:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, reimbursementFilter, attendanceFilter, resultFilter, purokFilter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Submit Payout Record (₱500)
  const handleRecordPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    if (!voucherNo.trim()) {
      setModalError("Disbursement Voucher (DV) number is required for audit liquidation.");
      return;
    }

    setModalLoading(true);
    setModalError(null);
    try {
      const res = await fetch("/api/admin/cse", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedApp.id,
          action: "record_reimbursement",
          voucherNo: voucherNo.trim(),
          payoutMethod,
          adminNotes: payoutNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to log reimbursement.");
      }

      setRecordPayoutModal(false);
      setSelectedApp(null);
      setVoucherNo("");
      setPayoutNotes("");
      fetchApplications();
    } catch (err: unknown) {
      setModalError((err as Error).message);
    } finally {
      setModalLoading(false);
    }
  };

  // Submit Attendance Verification
  const handleVerifyAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    setModalLoading(true);
    setModalError(null);
    try {
      const res = await fetch("/api/admin/cse", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedApp.id,
          action: "verify_attendance",
          attendanceStatus: attendanceChoice,
          adminNotes: attendanceAdminNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to verify attendance.");
      }

      setVerifyAttendanceModal(false);
      setSelectedApp(null);
      fetchApplications();
    } catch (err: unknown) {
      setModalError((err as Error).message);
    } finally {
      setModalLoading(false);
    }
  };

  // Submit Result Verification
  const handleVerifyResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    setModalLoading(true);
    setModalError(null);
    try {
      const res = await fetch("/api/admin/cse", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedApp.id,
          action: "verify_result",
          resultStatus: resultChoice,
          rating: ratingVal || null,
          isFeatured: featureToggle,
          adminNotes: resultAdminNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to verify result.");
      }

      setVerifyResultModal(false);
      setSelectedApp(null);
      fetchApplications();
    } catch (err: unknown) {
      setModalError((err as Error).message);
    } finally {
      setModalLoading(false);
    }
  };

  // Delete
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete application for ${name}?`)) return;
    try {
      const res = await fetch(`/api/admin/cse?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchApplications();
    } catch (err) {
      console.error("Failed to delete application:", err);
    }
  };

  // Statistics
  const totalApps = applications.length;
  const pendingCount = applications.filter((a) => a.reimbursement_status === "Pending Review").length;
  const reimbursedCount = applications.filter((a) => a.reimbursement_status === "Reimbursed").length;
  const totalReimbursedAmount = reimbursedCount * 500;
  const attendedCount = applications.filter((a) => a.attendance_status === "Verified Attended").length;
  const passersCount = applications.filter((a) => a.exam_result_status === "Passed").length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold mb-1">
            <Award className="w-3.5 h-3.5" />
            <span>Civil Service Exam Subsidy Module</span>
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            CSE ₱500 Reimbursement & Eligibility Tracker
          </h2>
          <p className="text-xs text-slate-500">
            20 Slots/Year (₱10,000 Budget) • Verifying CSC Receipts, ₱500 Payout Vouchers, and Passer Honor Roll.
          </p>
        </div>

        <a
          href="/api/admin/cse/export"
          download
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold transition-all shadow-xs shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Export COA Liquidation CSV</span>
        </a>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block">Total Applicants</span>
          <span className="text-xl font-black text-slate-900 dark:text-white">{totalApps}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-500 block">Pending Review</span>
          <span className="text-xl font-black text-amber-600 dark:text-amber-400">{pendingCount}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-600 block">Reimbursed</span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {reimbursedCount} <span className="text-xs text-slate-400 font-normal">/ 20 slots</span>
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block">Funds Released</span>
          <span className="text-xl font-black text-slate-900 dark:text-white">
            ₱{totalReimbursedAmount.toLocaleString()}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-sky-600 block">Attended Exam</span>
          <span className="text-xl font-black text-sky-600 dark:text-sky-400">{attendedCount}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-500 block">Tocok Passers</span>
          <span className="text-xl font-black text-amber-500">{passersCount} 🎉</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search applicant name, tracking code, phone..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
          />
        </div>

        <select
          value={reimbursementFilter}
          onChange={(e) => setReimbursementFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none"
        >
          <option value="all">All Reimbursement Status</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Approved for Payout">Approved for Payout</option>
          <option value="Reimbursed">₱500 Reimbursed</option>
          <option value="Disapproved">Disapproved</option>
        </select>

        <select
          value={attendanceFilter}
          onChange={(e) => setAttendanceFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none"
        >
          <option value="all">All Attendance</option>
          <option value="Not Yet Taken">Not Yet Taken</option>
          <option value="Attendance Submitted">Proof Submitted</option>
          <option value="Verified Attended">Verified Attended</option>
          <option value="Did Not Attend">Did Not Attend</option>
        </select>

        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none"
        >
          <option value="all">All Results</option>
          <option value="Passed">Passed (Eligibles)</option>
          <option value="Did Not Pass">Did Not Pass</option>
          <option value="Awaiting Results">Awaiting Results</option>
        </select>

        <select
          value={purokFilter}
          onChange={(e) => setPurokFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none"
        >
          <option value="all">All Puroks</option>
          {PUROK_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p.split("(")[0].trim()}
            </option>
          ))}
        </select>
      </div>

      {/* Applications Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading applications...</span>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No applications match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Tracking Code & Date</th>
                  <th className="py-3 px-4">Applicant & Purok</th>
                  <th className="py-3 px-4">Exam Info</th>
                  <th className="py-3 px-4">Payout Method</th>
                  <th className="py-3 px-4">Documents</th>
                  <th className="py-3 px-4">Reimbursement (₱500)</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4">Result</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Tracking Code */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-brand-600 dark:text-brand-400 block">
                        {app.tracking_code}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(app.created_at).toLocaleDateString()}
                      </span>
                    </td>

                    {/* Applicant */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {app.full_name}
                      </span>
                      <span className="text-[11px] text-slate-500 block truncate max-w-[140px]">
                        {app.purok.split("(")[0].trim()} • {app.age} yrs
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {app.contact_number}
                      </span>
                    </td>

                    {/* Exam info */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold block">{app.exam_level}</span>
                      <span className="text-[10px] text-slate-400 block">{app.exam_date}</span>
                      <span className="text-[10px] text-slate-500">
                        {app.is_first_time ? "First-time" : "Retaker"}
                      </span>
                    </td>

                    {/* Payout Details */}
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 dark:text-white block">
                        {app.payout_preference}
                      </span>
                      {app.payout_preference === "GCash" && (
                        <span className="text-[10px] text-sky-600 dark:text-sky-400 block font-mono">
                          {app.gcash_number} ({app.gcash_account_name || "Account"})
                        </span>
                      )}
                    </td>

                    {/* Documents View Button */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedApp(app);
                          setViewDocsModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px]"
                      >
                        <Eye className="w-3.5 h-3.5 text-brand-500" />
                        <span>View Docs</span>
                      </button>
                    </td>

                    {/* Reimbursement Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          getReimbursementBadge(app.reimbursement_status).badgeClass
                        }`}
                      >
                        {getReimbursementBadge(app.reimbursement_status).label}
                      </span>
                      {app.disbursement_voucher_no && (
                        <span className="text-[10px] font-mono text-emerald-600 block mt-0.5">
                          DV: {app.disbursement_voucher_no}
                        </span>
                      )}
                    </td>

                    {/* Attendance */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          getAttendanceBadge(app.attendance_status).badgeClass
                        }`}
                      >
                        {getAttendanceBadge(app.attendance_status).label}
                      </span>
                      {app.exam_attendance_proof_url && (
                        <a
                          href={app.exam_attendance_proof_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-brand-600 hover:underline block mt-0.5 flex items-center gap-0.5"
                        >
                          <span>Proof</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </td>

                    {/* Result */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          getResultBadge(app.exam_result_status).badgeClass
                        }`}
                      >
                        {app.exam_result_status === "Passed"
                          ? `Passed (${app.rating ? `${app.rating}%` : "Eligible"})`
                          : app.exam_result_status}
                      </span>
                      {app.result_proof_url && (
                        <a
                          href={app.result_proof_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-amber-600 hover:underline block mt-0.5 flex items-center gap-0.5"
                        >
                          <span>Proof</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Payout Action */}
                        {app.reimbursement_status !== "Reimbursed" ? (
                          <button
                            onClick={() => {
                              setSelectedApp(app);
                              setVoucherNo(app.disbursement_voucher_no || "");
                              setPayoutMethod(app.payout_preference);
                              setPayoutNotes(app.admin_notes || "");
                              setRecordPayoutModal(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                            title="Record ₱500 Payout"
                          >
                            Disburse ₱500
                          </button>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-600 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 rounded">
                            Disbursed
                          </span>
                        )}

                        {/* Verify Attendance */}
                        <button
                          onClick={() => {
                            setSelectedApp(app);
                            setAttendanceChoice(
                              app.attendance_status === "Verified Attended"
                                ? "Verified Attended"
                                : "Verified Attended"
                            );
                            setAttendanceAdminNotes(app.admin_notes || "");
                            setVerifyAttendanceModal(true);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Verify Exam Attendance"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>

                        {/* Verify Result */}
                        <button
                          onClick={() => {
                            setSelectedApp(app);
                            setResultChoice(
                              app.exam_result_status === "Passed" ? "Passed" : "Passed"
                            );
                            setRatingVal(app.rating ? String(app.rating) : "");
                            setFeatureToggle(app.is_featured_in_hall_of_fame);
                            setResultAdminNotes(app.admin_notes || "");
                            setVerifyResultModal(true);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Verify Result & Hall of Fame"
                        >
                          <Trophy className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(app.id, app.full_name)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Delete Application"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= MODAL: VIEW ATTACHED DOCUMENTS ================= */}
      {viewDocsModal && selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  Audit Documents: {selectedApp.full_name}
                </h3>
                <span className="text-xs text-slate-500">
                  {selectedApp.tracking_code} • {selectedApp.purok}
                </span>
              </div>
              <button
                onClick={() => setViewDocsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Doc 1: Valid ID */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    1. Valid ID / Proof of Barangay Residency
                  </span>
                  <a
                    href={selectedApp.valid_id_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Open Fullscreen</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedApp.valid_id_url}
                  alt="Valid ID"
                  className="max-h-60 rounded-xl mx-auto object-contain border border-slate-200 dark:border-slate-700"
                />
              </div>

              {/* Doc 2: CSC Official Receipt ₱500 */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    2. CSC Official Receipt (₱500.00 Fee Proof)
                  </span>
                  <a
                    href={selectedApp.csc_receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Open Fullscreen</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedApp.csc_receipt_url}
                  alt="CSC Official Receipt"
                  className="max-h-60 rounded-xl mx-auto object-contain border border-slate-200 dark:border-slate-700"
                />
              </div>

              {/* Doc 3: CSC Exam Schedule / Slip */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    3. CSC Application Slip / ONSA Schedule
                  </span>
                  <a
                    href={selectedApp.exam_schedule_proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Open Fullscreen</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedApp.exam_schedule_proof_url}
                  alt="Exam Slip"
                  className="max-h-60 rounded-xl mx-auto object-contain border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewDocsModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: RECORD ₱500 PAYOUT ================= */}
      {recordPayoutModal && selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  Record ₱500 Reimbursement Payout
                </h3>
                <span className="text-xs text-slate-500">
                  Beneficiary: {selectedApp.full_name} ({selectedApp.purok})
                </span>
              </div>
              <button
                onClick={() => setRecordPayoutModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleRecordPayout} className="space-y-4 text-xs">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-3">
                <span className="text-emerald-800 dark:text-emerald-300 font-medium block">
                  Amount to Disburse: <strong>₱500.00</strong>
                </span>
                <span className="text-slate-500 block text-[11px] mt-0.5">
                  Requested Payout Preference: <strong>{selectedApp.payout_preference}</strong>
                  {selectedApp.payout_preference === "GCash" && ` (${selectedApp.gcash_number})`}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Disbursement Voucher (DV) / Check No. * (Required by COA)
                </label>
                <input
                  type="text"
                  required
                  value={voucherNo}
                  onChange={(e) => setVoucherNo(e.target.value)}
                  placeholder="e.g. DV-2026-0042 or OR-7891"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Disbursement Channel / Station
                </label>
                <input
                  type="text"
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  placeholder="e.g. Barangay Hall Payout / GCash Ref #9872"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Internal Notes (Optional)
                </label>
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="e.g. Signed payroll acknowledgment receipt on hand"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRecordPayoutModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {modalLoading ? "Recording..." : "Confirm ₱500 Disbursed"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: VERIFY ATTENDANCE ================= */}
      {verifyAttendanceModal && selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                Verify Exam Attendance
              </h3>
              <button
                onClick={() => setVerifyAttendanceModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifyAttendance} className="space-y-4 text-xs">
              {selectedApp.exam_attendance_proof_url ? (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <span className="font-bold block mb-1">Uploaded Attendance Proof:</span>
                  <a
                    href={selectedApp.exam_attendance_proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>View Stamped ONSA / Test Center Photo</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {selectedApp.exam_attendance_notes && (
                    <span className="text-slate-500 block text-[11px] mt-1">
                      Notes: {selectedApp.exam_attendance_notes}
                    </span>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
                  Applicant has not uploaded test-day proof yet, but council may manually verify.
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Attendance Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`p-3 rounded-xl border text-center cursor-pointer font-bold ${
                      attendanceChoice === "Verified Attended"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="att"
                      value="Verified Attended"
                      checked={attendanceChoice === "Verified Attended"}
                      onChange={() => setAttendanceChoice("Verified Attended")}
                      className="sr-only"
                    />
                    <span>Verified Attended</span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border text-center cursor-pointer font-bold ${
                      attendanceChoice === "Did Not Attend"
                        ? "border-rose-500 bg-rose-50 text-rose-800"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="att"
                      value="Did Not Attend"
                      checked={attendanceChoice === "Did Not Attend"}
                      onChange={() => setAttendanceChoice("Did Not Attend")}
                      className="sr-only"
                    />
                    <span>Did Not Attend</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyAttendanceModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold"
                >
                  {modalLoading ? "Saving..." : "Save Attendance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: VERIFY RESULT ================= */}
      {verifyResultModal && selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                Verify Exam Result & Hall of Fame
              </h3>
              <button
                onClick={() => setVerifyResultModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifyResult} className="space-y-4 text-xs">
              {selectedApp.result_proof_url && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <span className="font-bold block mb-1">Applicant Result Attachment:</span>
                  <a
                    href={selectedApp.result_proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>View CSC Rating Slip / Passer Proof</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Official Outcome
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`p-3 rounded-xl border text-center cursor-pointer font-bold ${
                      resultChoice === "Passed"
                        ? "border-amber-500 bg-amber-50 text-amber-900"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="res"
                      value="Passed"
                      checked={resultChoice === "Passed"}
                      onChange={() => setResultChoice("Passed")}
                      className="sr-only"
                    />
                    <span>Passed 🎉</span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border text-center cursor-pointer font-bold ${
                      resultChoice === "Did Not Pass"
                        ? "border-slate-500 bg-slate-100 text-slate-900"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="res"
                      value="Did Not Pass"
                      checked={resultChoice === "Did Not Pass"}
                      onChange={() => setResultChoice("Did Not Pass")}
                      className="sr-only"
                    />
                    <span>Did Not Pass</span>
                  </label>
                </div>
              </div>

              {resultChoice === "Passed" && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Official Rating % (e.g. 84.50)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={ratingVal}
                      onChange={(e) => setRatingVal(e.target.value)}
                      placeholder="e.g. 85.20"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featureToggle}
                      onChange={(e) => setFeatureToggle(e.target.checked)}
                      className="accent-amber-600 rounded"
                    />
                    <span>Feature on <strong>Barangay Tocok CSE Hall of Fame</strong></span>
                  </label>
                </>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyResultModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  {modalLoading ? "Saving..." : "Save Result"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
