"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Copy, KeyRound, Loader2, RefreshCcw, BarChart3 } from "lucide-react";

type ApiKeyRow = {
  id: string;
  name: string | null;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type UsageBar = {
  date: string;
  amount: number;
  tokens: number;
  cost: number;
  latencyMs: number;
  count: number;
};

type UsageTotals = {
  amount: number;
  tokens: number;
  cost: number;
  latencyMs: number;
  count: number;
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [newKeyName, setNewKeyName] = useState("My API key");
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageBar[]>([]);
  const [usageTotals, setUsageTotals] = useState<UsageTotals>({
    amount: 0,
    tokens: 0,
    cost: 0,
    latencyMs: 0,
    count: 0,
  });
  const [usageLoading, setUsageLoading] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/api-keys", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to load API keys");
      }
      const data = await res.json();
      setKeys(Array.isArray(data?.keys) ? data.keys : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    setUsageLoading(true);
    try {
      const res = await fetch("/api/api-key-usage", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load usage");
      const daily: UsageBar[] = Array.isArray(data?.daily)
        ? data.daily.map((row: any) => ({
            date: row.date,
            amount: Number(row.amount ?? 0),
            tokens: Number(row.tokens ?? 0),
            cost: Number(row.cost ?? row.amount ?? 0),
            latencyMs: Number(row.latencyMs ?? row.latency_ms ?? 0),
            count: Number(row.count ?? 0),
          }))
        : [];

      setUsage(daily);
      setUsageTotals({
        amount: Number(data?.totals?.amount ?? 0),
        tokens: Number(data?.totals?.tokens ?? 0),
        cost: Number(data?.totals?.cost ?? 0),
        latencyMs: Number(data?.totals?.latencyMs ?? 0),
        count: Number(data?.totals?.count ?? 0),
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setUsageLoading(false);
    }
  };

  const issueKey = async () => {
    setIssuing(true);
    setError(null);
    setPlainKey(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to issue key");

      setPlainKey(data?.apiKey ?? null);
      await fetchKeys();
    } catch (err: any) {
      setError(err?.message || "Failed to issue key");
    } finally {
      setIssuing(false);
    }
  };

  const statusText = useMemo(() => {
    if (loading) return "Loading";
    if (error) return error;
    return "";
  }, [loading, error]);

  const metrics = useMemo(
    () => [
      {
        key: "tokens",
        label: "Tokens",
        accessor: (row: UsageBar) => row.tokens ?? 0,
        format: (v: number) => v.toLocaleString(),
        gradient: "from-indigo-300 to-indigo-600",
      },
      {
        key: "cost",
        label: "Cost (USD)",
        accessor: (row: UsageBar) => row.cost ?? row.amount ?? 0,
        format: (v: number) => `$${v.toFixed(2)}`,
        gradient: "from-emerald-300 to-emerald-600",
      },
      {
        key: "latencyMs",
        label: "Latency (ms)",
        accessor: (row: UsageBar) => row.latencyMs ?? 0,
        format: (v: number) => `${Math.round(v)} ms`,
        gradient: "from-amber-300 to-amber-600",
      },
    ],
    []
  );

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 text-gray-900">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">API Keys</h1>
          <p className="text-sm text-gray-600">
            Generate a secret key to call Dexy APIs or the SDK. Keep it private—
            you will only see the full key once.
          </p>
        </div>
        <KeyRound className="h-10 w-10 text-gray-400" />
      </header>

      <Card className="p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-700">Key name</label>
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="My API key"
              maxLength={120}
            />
          </div>
          <Button onClick={issueKey} disabled={issuing || !newKeyName.trim()} className="sm:w-40">
            {issuing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Issue key
          </Button>
        </div>
        {plainKey ? (
          <div className="mt-4 rounded-md border border-dashed bg-gray-50 p-3 text-xs text-gray-800">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">New key</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard.writeText(plainKey)}
                className="h-7 px-2 text-xs"
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <code className="mt-2 block break-all font-mono text-[11px] leading-5">{plainKey}</code>
            <p className="mt-2 text-[11px] text-gray-600">
              Store this securely. You won’t be able to view it again.
            </p>
          </div>
        ) : null}
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Existing keys</h2>
        <Button variant="ghost" size="sm" onClick={() => { fetchKeys(); fetchUsage(); }} disabled={loading || usageLoading}>
          <RefreshCcw className="mr-1.5 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card className="p-4 shadow-sm">
        <div className="flex items-center gap-2 pb-3">
          <BarChart3 className="h-4 w-4 text-gray-500" />
          <div className="flex flex-col">
            <p className="text-sm font-semibold text-gray-800">Usage (last 30 days)</p>
            <p className="text-xs text-gray-500">Daily totals for tokens, cost, and latency.</p>
          </div>
          {usageLoading ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : null}
        </div>

        {!usage.length ? (
          <p className="text-sm text-gray-600">No usage yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => {
          const maxValue = usage.reduce(
            (max, row) => Math.max(max, metric.accessor(row)),
            0
          );
              const totalValue =
                metric.key === "tokens"
                  ? usageTotals.tokens
                  : metric.key === "cost"
                    ? usageTotals.cost
                    : usageTotals.latencyMs;

              return (
                <div key={metric.key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-gray-700">
                    <span className="font-semibold">{metric.label}</span>
                    <span className="text-gray-500">total {metric.format(totalValue)}</span>
                  </div>
                  <div className="flex h-40 items-end gap-1.5 rounded-md border bg-gray-50 p-2">
                    {usage.map((row) => {
                      const value = metric.accessor(row);
                      const height = maxValue ? Math.max(8, (value / maxValue) * 120) : 8;
                      return (
                        <div
                          key={`${metric.key}-${row.date}`}
                          className="flex flex-col items-center gap-1 text-[10px] text-gray-600"
                        >
                          <div
                            className={`w-7 rounded bg-gradient-to-t ${metric.gradient}`}
                            style={{ height }}
                            title={`${row.date}: ${metric.format(value)} • ${row.count} calls`}
                          />
                          <span className="text-[9px] text-gray-500">{row.date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-gray-600">
                    Hover to see exact {metric.label.toLowerCase()} per day.
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-3">
        {statusText ? (
          <p className="text-sm text-gray-600">{statusText}</p>
        ) : null}
        {!loading && !keys.length ? (
          <p className="text-sm text-gray-600">No keys yet. Create one above.</p>
        ) : null}

        {keys.map((key) => (
          <Card key={key.id} className="flex flex-col gap-2 p-4 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{key.name || "Untitled key"}</p>
                <p className="text-xs text-gray-600">dexy_{key.prefix}_••••</p>
              </div>
              <p className="text-xs text-gray-500">
                Created {new Date(key.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
              <span>
                Last used: {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "never"}
              </span>
              <span>
                Status: {key.revoked_at ? "revoked" : "active"}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
