"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleUserRound, Clock3, LogIn, Moon, Plus, RefreshCw, Search, Settings, Sun, Trash2, XCircle } from "lucide-react";
import type { AccountView } from "@/lib/types";
import { createDemoAccounts } from "@/lib/demo-accounts";

const statusLabel: Record<string, string> = { active: "Đang hoạt động", login_required: "Cần đăng nhập lại", access_denied: "Bị từ chối truy cập", unsupported: "CLI chưa tương thích", error: "Lỗi", new: "Chưa kiểm tra" };
const statusColor: Record<string, string> = { active: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300", login_required: "text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300", access_denied: "text-red-700 bg-red-50 dark:bg-red-950/60 dark:text-red-300", unsupported: "text-slate-700 bg-slate-100 dark:bg-slate-700 dark:text-slate-200", error: "text-red-700 bg-red-50 dark:bg-red-950/60 dark:text-red-300", new: "text-slate-700 bg-slate-100 dark:bg-slate-700 dark:text-slate-200" };

function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Chưa có"; }
function formatResetRemaining(value: string) {
  const remainingMs = new Date(value).getTime() - Date.now();
  if (remainingMs <= 0) return "đang reset";
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `còn ${days} ngày${hours > 0 ? ` ${hours} giờ` : ""}`;
  if (hours > 0) return `còn ${hours} giờ${minutes > 0 ? ` ${minutes} phút` : ""}`;
  return `còn ${minutes} phút`;
}
function percent(account: AccountView) { const windows = account.latestSnapshot?.windows ?? []; return windows.length ? Math.max(...windows.map((window) => window.usedPercent)) : 0; }

async function api(path: string, init?: RequestInit) { const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Yêu cầu thất bại"); return body; }

export default function Home() {
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [demoMode, setDemoMode] = useState(false);
  const refreshedOnLoad = useRef(false);

  const load = async () => { try { const data = await api("/api/accounts"); setAccounts(data.accounts); } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể tải dữ liệu"); } };
  useEffect(() => {
    if (refreshedOnLoad.current) return;
    refreshedOnLoad.current = true;
    void (async () => {
      const demo = new URLSearchParams(window.location.search).get("demo") === "1";
      if (demo) {
        setDemoMode(true);
        setAccounts(createDemoAccounts());
        return;
      }
      try {
        await api("/api/csrf");
        await load();
        setBusy("all");
        await api("/api/accounts/refresh-all", { method: "POST" });
        await load();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Không thể cập nhật usage");
      } finally {
        setBusy(null);
      }
    })();
  }, []);
  useEffect(() => {
    const saved = localStorage.getItem("codex-usage-theme");
    const requested = new URLSearchParams(window.location.search).get("theme");
    const nextTheme = requested === "dark" || requested === "light" ? requested : saved === "dark" || saved === "light" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    const update = window.setTimeout(() => setTheme(nextTheme), 0);
    return () => window.clearTimeout(update);
  }, []);
  const setThemeMode = (nextTheme: "light" | "dark") => {
    setTheme(nextTheme);
    localStorage.setItem("codex-usage-theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };
  const filtered = useMemo(() => accounts.filter((account) => `${account.displayName} ${account.maskedEmail ?? ""}`.toLowerCase().includes(query.toLowerCase())), [accounts, query]);
  const run = async (key: string, action: () => Promise<void>) => { setBusy(key); setNotice(null); try { await action(); await load(); } catch (error) { setNotice(error instanceof Error ? error.message : "Thao tác thất bại"); } finally { setBusy(null); } };
  const add = async () => { if (!newName.trim()) return; await run("add", async () => { await api("/api/accounts", { method: "POST", body: JSON.stringify({ displayName: newName }) }); setNewName(""); setShowAdd(false); }); };
  const login = async (account: AccountView) => {
    await run(account.id, async () => {
      const data = await api(`/api/accounts/${account.id}/login`, { method: "POST" });
      window.open(data.authUrl, "_blank", "noopener,noreferrer");
      let completed = false;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const status = await api(`/api/accounts/${account.id}/login-status`);
        if (!status.done) continue;
        completed = true;
        if (!status.success) throw new Error(status.error ?? "Đăng nhập Codex không thành công");
        await api(`/api/accounts/${account.id}/refresh`, { method: "POST" });
        break;
      }
      if (!completed) throw new Error("Đăng nhập hết thời gian chờ. Hãy thử lại.");
    });
  };
  const summary = { total: accounts.length, active: accounts.filter((a) => a.status === "active").length, login: accounts.filter((a) => a.status === "login_required").length, near: accounts.filter((a) => percent(a) >= 80).length };

  return <main data-demo-ready={demoMode ? "true" : undefined} className="min-h-screen bg-[#f6f9fc] text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div><div className="mb-2 flex items-center gap-3"><div className="rounded-2xl bg-blue-600 p-2.5 text-white"><CircleUserRound size={22} /></div><span className="text-sm font-semibold tracking-[0.2em] text-blue-600">CODEX LOCAL</span></div><h1 className="text-3xl font-bold tracking-tight">Codex Usage Manager</h1><p className="mt-1 text-slate-500">Theo dõi quota và trạng thái các tài khoản Codex trên máy này.</p></div>
        <div className="flex flex-wrap gap-3"><div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Chọn giao diện"><button onClick={() => setThemeMode("light")} aria-pressed={theme === "light"} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${theme === "light" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}><Sun size={15} /> Light</button><button onClick={() => setThemeMode("dark")} aria-pressed={theme === "dark"} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${theme === "dark" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}><Moon size={15} /> Dark</button></div><button onClick={() => void run("all", async () => { await api("/api/accounts/refresh-all", { method: "POST" }); })} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:border-blue-300 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"><RefreshCw size={16} className={busy === "all" ? "animate-spin" : ""} /> Làm mới tất cả</button><button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"><Plus size={17} /> Thêm tài khoản</button></div>
      </header>
      {demoMode && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">Chế độ minh họa · Toàn bộ tài khoản và quota bên dưới là dữ liệu giả.</div>}
      {notice && <div className="mb-5 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><span>{notice}</span><button onClick={() => setNotice(null)}><XCircle size={17} /></button></div>}
      <section className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Summary label="Tổng tài khoản" value={summary.total} icon={<CircleUserRound />} /><Summary label="Đang hoạt động" value={summary.active} icon={<CheckCircle2 />} tone="green" /><Summary label="Cần đăng nhập" value={summary.login} icon={<LogIn />} tone="amber" /><Summary label="Gần giới hạn (≥80%)" value={summary.near} icon={<AlertTriangle />} tone="red" /></section>
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"><Search size={18} className="text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc email đã mask…" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" /><span className="text-xs text-slate-400">{filtered.length} tài khoản</span></div>
      {filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center dark:border-slate-700 dark:bg-slate-900"><CircleUserRound className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={42} /><p className="font-semibold text-slate-700 dark:text-slate-200">Chưa có tài khoản Codex</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Thêm tài khoản rồi đăng nhập OAuth trong browser mặc định.</p></div> : <div className="grid gap-5 xl:grid-cols-2">{filtered.map((account) => <AccountCard key={account.id} account={account} busy={busy === account.id} onRefresh={() => void run(account.id, async () => { await api(`/api/accounts/${account.id}/refresh`, { method: "POST" }); })} onLogin={() => void login(account)} onDelete={() => { if (window.confirm(`Xóa session của ${account.displayName}?`)) void run(account.id, async () => { await api(`/api/accounts/${account.id}/session`, { method: "DELETE" }); }); }} />)}</div>}
      <footer className="mt-10 flex items-center gap-2 text-xs text-slate-400"><Settings size={14} /> Cập nhật khi tải lại trang (F5) · Dữ liệu lưu trong %LOCALAPPDATA%\CodexUsageManager · Không gửi telemetry.</footer>
      {showAdd && <div className="fixed inset-0 z-10 grid place-items-center bg-slate-900/50 px-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"><h2 className="text-lg font-bold">Thêm tài khoản Codex</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tài khoản sẽ có Codex home riêng và không dùng lại session hiện tại.</p><input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void add(); }} placeholder="Tên hiển thị" className="mt-5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800" /><div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowAdd(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Hủy</button><button onClick={() => void add()} disabled={busy === "add"} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Tạo tài khoản</button></div></div></div>}
    </div>
  </main>;
}

function Summary({ label, value, icon, tone = "blue" }: { label: string; value: number; icon: React.ReactNode; tone?: string }) { const colors: Record<string, string> = { blue: "text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300", green: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300", amber: "text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300", red: "text-red-600 bg-red-50 dark:bg-red-950/60 dark:text-red-300" }; return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className={`mb-4 grid h-9 w-9 place-items-center rounded-xl ${colors[tone]}`}>{icon}</div><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>; }

function AccountCard({ account, busy, onRefresh, onLogin, onDelete }: { account: AccountView; busy: boolean; onRefresh: () => void; onLogin: () => void; onDelete: () => void }) { const snapshot = account.latestSnapshot; const windows = snapshot?.windows ?? []; return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{account.displayName}</h2><p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{account.maskedEmail ?? "Chưa đăng nhập"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[account.status]}`}>{statusLabel[account.status]}</span></div><div className="mt-5 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-700"><span className="text-sm text-slate-500 dark:text-slate-400">Gói hiện tại</span><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold uppercase dark:bg-slate-800">{account.plan ?? "Chưa có dữ liệu"}</span></div>{windows.length ? <div className="mt-4 space-y-4">{windows.map((window) => <div key={`${window.limitId}-${window.kind}`}><div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-slate-600 dark:text-slate-300">{window.limitName ?? window.limitId} · {window.kind === "primary" ? "Chính" : "Phụ"}</span><span className="font-semibold">{window.remainingPercent}% còn lại</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className={`h-full rounded-full ${window.remainingPercent <= 20 ? "bg-amber-500" : "bg-blue-500"}`} style={{ width: `${window.remainingPercent}%` }} /></div><div className="mt-1 flex items-center justify-between text-xs text-slate-400"><span>Đã dùng {window.usedPercent}%</span><span className="inline-flex items-center gap-1"><Clock3 size={12} /> {window.resetsAt ? `reset ${formatDate(window.resetsAt)} · ${formatResetRemaining(window.resetsAt)}` : "OpenAI không trả về dữ liệu reset"}</span></div></div>)}</div> : <div className="mt-5 rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">{snapshot?.message ?? "OpenAI không trả về dữ liệu quota."}</div>}<div className="mt-5 flex items-center justify-between text-xs text-slate-400"><span>Nguồn: {snapshot?.source ?? "codex_app_server"} · Kiểm tra: {formatDate(account.lastCheckedAt)}</span><div className="flex gap-1"><button title="Đăng nhập" onClick={onLogin} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400"><LogIn size={16} /></button><button title="Làm mới" onClick={onRefresh} disabled={busy} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400"><RefreshCw size={16} className={busy ? "animate-spin" : ""} /></button><button title="Xóa session" onClick={onDelete} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400"><Trash2 size={16} /></button></div></div></article>; }
