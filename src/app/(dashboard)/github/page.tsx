"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Github, Link2, ExternalLink, GitBranch, Check, AlertCircle, RefreshCw } from "lucide-react";

/**
 * GitHub Connection Page
 *
 * Supports two connection methods:
 * 1. Personal Access Token (PAT) — simpler, works immediately
 * 2. OAuth App — requires GitHub App setup (coming soon)
 *
 * Once connected, users can:
 * - List repos
 * - Pull latest code for AI analysis
 * - Push generated code back (with branch selection)
 */

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

interface RepoInfo {
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  private: boolean;
  updated_at: string;
}

export default function GitHubPage() {
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [error, setError] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);

  const connectWithToken = async () => {
    if (!token.trim()) return;
    setState("connecting");
    setError("");

    try {
      // Validate token by fetching user info
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token.trim()}`, Accept: "application/vnd.github.v3+json" },
      });

      if (!userRes.ok) {
        throw new Error("Invalid token — check your Personal Access Token and try again.");
      }

      const userData = await userRes.json();
      setUsername(userData.login);

      // Fetch repos
      const reposRes = await fetch("https://api.github.com/user/repos?sort=updated&per_page=30", {
        headers: { Authorization: `Bearer ${token.trim()}`, Accept: "application/vnd.github.v3+json" },
      });

      if (reposRes.ok) {
        const repoData = await reposRes.json();
        setRepos(
          repoData.map((r: any) => ({
            full_name: r.full_name,
            description: r.description,
            html_url: r.html_url,
            default_branch: r.default_branch,
            private: r.private,
            updated_at: r.updated_at,
          }))
        );
      }

      setState("connected");
    } catch (err: any) {
      setState("error");
      setError(err.message || "Failed to connect");
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-[var(--bg-app)] text-[var(--fg-primary)]">
      <div className="page-frame max-w-5xl">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="page-hero mb-8 px-6 py-6">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--fg-muted)]">Codebase</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">GitHub</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-2">Connect repositories to inspect code, analyze projects, and prepare generated changes for push.</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {state === "disconnected" && (
            <motion.div
              key="disconnected"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-4"
            >
              {/* Connect card */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
                    <Github size={20} className="text-[var(--fg-primary)]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--fg-primary)]">Connect GitHub</h2>
                    <p className="text-xs text-[var(--fg-muted)]">Use a Personal Access Token for instant access</p>
                  </div>
                </div>

                {!showTokenInput ? (
                  <button
                    onClick={() => setShowTokenInput(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--fg-primary)] text-[var(--bg-base)] text-sm font-semibold hover:opacity-90 transition-all duration-200 hover-lift"
                  >
                    <Github size={15} />
                    Connect with Personal Access Token
                  </button>
                ) : (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-[var(--fg-secondary)] mb-1 block">
                        Personal Access Token
                      </label>
                      <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxx"
                        className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3.5 py-2.5 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors font-mono"
                        autoFocus
                      />
                      <p className="text-[10px] text-[var(--fg-muted)] mt-1.5">
                        Create one at{" "}
                        <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener" className="text-[var(--accent)] hover:underline">
                          github.com/settings/tokens
                        </a>{" "}
                        with <code className="text-[var(--fg-secondary)]">repo</code> scope
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={connectWithToken}
                        disabled={!token.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--fg-primary)] text-[var(--bg-base)] text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
                      >
                        <Link2 size={14} />
                        Connect
                      </button>
                      <button onClick={() => { setShowTokenInput(false); setToken(""); }} className="px-3 py-2.5 rounded-xl text-sm text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)] transition-colors">
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Info card */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                <h3 className="text-xs font-semibold text-[var(--fg-secondary)] mb-2">What you can do</h3>
                <ul className="space-y-2 text-xs text-[var(--fg-muted)]">
                  <li className="flex items-start gap-2"><Check size={12} className="text-[var(--success)] mt-0.5 shrink-0" /> Pull code from any repo for the 10-Agent Council to analyze</li>
                  <li className="flex items-start gap-2"><Check size={12} className="text-[var(--success)] mt-0.5 shrink-0" /> Push generated code to a new branch</li>
                  <li className="flex items-start gap-2"><Check size={12} className="text-[var(--success)] mt-0.5 shrink-0" /> Browse files and commits directly in Inceptive</li>
                  <li className="flex items-start gap-2"><Check size={12} className="text-[var(--success)] mt-0.5 shrink-0" /> Your token is stored securely and never shared</li>
                </ul>
              </div>
            </motion.div>
          )}

          {state === "connecting" && (
            <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-20">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                <RefreshCw size={24} className="text-[var(--accent)]" />
              </motion.div>
              <p className="text-sm text-[var(--fg-muted)] mt-3">Connecting to GitHub...</p>
            </motion.div>
          )}

          {state === "error" && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-[var(--destructive)]/30 bg-[var(--destructive-soft)] p-5 text-center">
              <AlertCircle size={20} className="text-[var(--destructive)] mx-auto mb-2" />
              <p className="text-sm text-[var(--destructive)] font-medium">{error}</p>
              <button
                onClick={() => { setState("disconnected"); setError(""); }}
                className="mt-3 px-4 py-2 text-xs font-medium text-[var(--fg-primary)] bg-[var(--bg-elevated)] rounded-xl hover:bg-[var(--bg-surface)] transition-colors"
              >
                Try Again
              </button>
            </motion.div>
          )}

          {state === "connected" && (
            <motion.div key="connected" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Connected header */}
              <div className="rounded-2xl border border-[var(--success)]/20 bg-[var(--success-soft)] p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--success)]/10 flex items-center justify-center">
                  <Check size={16} className="text-[var(--success)]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--fg-primary)]">Connected as @{username}</p>
                  <p className="text-xs text-[var(--fg-muted)]">{repos.length} repositories available</p>
                </div>
                <button
                  onClick={() => { setState("disconnected"); setToken(""); setRepos([]); setUsername(""); }}
                  className="text-xs text-[var(--fg-muted)] hover:text-[var(--destructive)] transition-colors"
                >
                  Disconnect
                </button>
              </div>

              {/* Repo list */}
              <div className="space-y-2">
                {repos.map((repo, i) => (
                  <motion.div
                    key={repo.full_name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setSelectedRepo(selectedRepo === repo.full_name ? null : repo.full_name)}
                    className={`rounded-xl border p-3.5 cursor-pointer transition-all duration-200 ${
                      selectedRepo === repo.full_name
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-default)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Github size={14} className="text-[var(--fg-muted)] shrink-0" />
                      <span className="text-sm font-medium text-[var(--fg-primary)] truncate">{repo.full_name}</span>
                      {repo.private && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--fg-muted)] border border-[var(--border-subtle)]">Private</span>}
                      <a href={repo.html_url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="ml-auto text-[var(--fg-muted)] hover:text-[var(--fg-primary)]">
                        <ExternalLink size={12} />
                      </a>
                    </div>
                    {repo.description && (
                      <p className="text-xs text-[var(--fg-muted)] mt-1 ml-5 line-clamp-1">{repo.description}</p>
                    )}
                    {selectedRepo === repo.full_name && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 ml-5 flex items-center gap-2">
                        <GitBranch size={12} className="text-[var(--fg-muted)]" />
                        <span className="text-xs text-[var(--fg-muted)]">{repo.default_branch}</span>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
