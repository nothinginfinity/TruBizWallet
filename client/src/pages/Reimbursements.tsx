import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Client, Activity } from "@shared/schema";

type Reimbursement = {
  id: number;
  activityId: number;
  clientId: number;
  amount: number;
  method: string;
  status: string;
  sentAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
};

type EnrichedReimbursement = Reimbursement & {
  client?: Client;
  activity?: Activity;
};

const STATUS_TABS = ["all", "draft", "sent", "paid", "cancelled"] as const;
type StatusTab = typeof STATUS_TABS[number];

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-muted text-muted-foreground",
  sent:      "bg-amber-900/40 text-amber-400",
  paid:      "bg-green-900/40 text-green-400",
  cancelled: "bg-red-900/40 text-red-400",
};

const METHOD_ICONS: Record<string, string> = {
  zelle:  "💙",
  venmo:  "💸",
  cash:   "💵",
  check:  "📝",
};

function buildPaymentLink(client: Client, amount: number): string | null {
  // Zelle: no universal URI spec, but registered scheme opens the app on iOS/Android
  if (client.preferredPayment === "zelle" && client.zelleHandle) {
    return `zelle://send?recipient=${encodeURIComponent(client.zelleHandle)}&amount=${amount.toFixed(2)}`;
  }
  if (client.preferredPayment === "venmo" && client.venmoHandle) {
    return `venmo://paycharge?txn=charge&recipients=${encodeURIComponent(client.venmoHandle)}&amount=${amount.toFixed(2)}&note=Business+reimbursement`;
  }
  return null;
}

function ReimbursementRow({
  r, onSend, onPaid, onCancel, isPending,
}: {
  r: EnrichedReimbursement;
  onSend: (r: EnrichedReimbursement) => void;
  onPaid: (r: EnrichedReimbursement) => void;
  onCancel: (r: EnrichedReimbursement) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const payLink = r.client ? buildPaymentLink(r.client, r.amount) : null;

  return (
    <div className="card-panel space-y-3">
      {/* Header row — tap to expand */}
      <button
        className="w-full flex items-start justify-between gap-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold">${r.amount.toFixed(2)}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[r.status] ?? "bg-muted text-muted-foreground"}`}>
              {r.status}
            </span>
          </div>
          <p className="text-sm font-medium mt-0.5 truncate">
            {r.client?.name ?? `Client #${r.clientId}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {METHOD_ICONS[r.method] ?? "💳"} {r.method}
            {r.activity?.merchant ? ` · ${r.activity.merchant}` : ""}
            {r.activity?.merchantCategory ? ` · ${r.activity.merchantCategory}` : ""}
          </p>
        </div>
        <span className="text-muted-foreground text-xs mt-1.5">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <span className="text-muted-foreground">Created</span>
            <span>{new Date(r.createdAt).toLocaleDateString()}</span>

            {r.activity?.date && (
              <>
                <span className="text-muted-foreground">Spend date</span>
                <span>{r.activity.date}</span>
              </>
            )}
            {r.sentAt && (
              <>
                <span className="text-muted-foreground">Sent</span>
                <span>{new Date(r.sentAt).toLocaleDateString()}</span>
              </>
            )}
            {r.paidAt && (
              <>
                <span className="text-muted-foreground">Paid</span>
                <span className="text-green-400">{new Date(r.paidAt).toLocaleDateString()}</span>
              </>
            )}
            {r.client?.preferredPayment && (
              <>
                <span className="text-muted-foreground">Prefers</span>
                <span className="capitalize">{r.client.preferredPayment}</span>
              </>
            )}
            {r.client?.zelleHandle && (
              <>
                <span className="text-muted-foreground">Zelle</span>
                <span className="truncate">{r.client.zelleHandle}</span>
              </>
            )}
            {r.client?.venmoHandle && (
              <>
                <span className="text-muted-foreground">Venmo</span>
                <span className="truncate">@{r.client.venmoHandle}</span>
              </>
            )}
          </div>
          {r.notes && (
            <p className="text-xs text-muted-foreground italic">"{r.notes}"</p>
          )}
        </div>
      )}

      {/* Action buttons */}
      {(r.status === "draft" || r.status === "sent") && (
        <div className="flex gap-2 pt-1">
          {r.status === "draft" && (
            payLink ? (
              <a
                href={payLink}
                onClick={() => onSend(r)}
                className="flex-1 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium text-center"
              >
                {METHOD_ICONS[r.client?.preferredPayment ?? "zelle"]} Send via {r.client?.preferredPayment ?? r.method}
              </a>
            ) : (
              <button
                onClick={() => onSend(r)}
                disabled={isPending}
                className="flex-1 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
              >
                Send Request
              </button>
            )
          )}

          {r.status === "sent" && (
            <>
              <button
                onClick={() => onPaid(r)}
                disabled={isPending}
                className="flex-1 py-2 rounded-lg bg-green-700 text-white text-sm font-medium disabled:opacity-50"
              >
                ✓ Mark Paid
              </button>
              {payLink && (
                <a
                  href={payLink}
                  className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm text-center"
                >
                  Resend
                </a>
              )}
            </>
          )}

          <button
            onClick={() => onCancel(r)}
            disabled={isPending}
            className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default function Reimbursements() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<StatusTab>("all");

  const { data: allReimbursements = [], isLoading } = useQuery<Reimbursement[]>({
    queryKey: ["/api/reimbursements"],
    queryFn: () => apiRequest("GET", "/api/reimbursements").then(r => r.json()),
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("GET", "/api/clients").then(r => r.json()),
  });

  const { data: activity = [] } = useQuery<Activity[]>({
    queryKey: ["/api/activity"],
    queryFn: () => apiRequest("GET", "/api/activity").then(r => r.json()),
  });

  // Enrich client-side — avoids a new API endpoint
  const enriched: EnrichedReimbursement[] = allReimbursements.map(r => ({
    ...r,
    client: clients.find(c => c.id === r.clientId),
    activity: activity.find((a: Activity) => a.id === r.activityId),
  }));

  const filtered = tab === "all" ? enriched : enriched.filter(r => r.status === tab);
  const countByStatus = (s: string) => allReimbursements.filter(r => r.status === s).length;

  const totalOutstanding = enriched
    .filter(r => r.status === "draft" || r.status === "sent")
    .reduce((s, r) => s + r.amount, 0);

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/reimbursements/${id}`, updates).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/reimbursements"] });
      qc.invalidateQueries({ queryKey: ["/api/activity"] });
    },
    onError: () => toast({ title: "Error", description: "Could not update.", variant: "destructive" }),
  });

  function markSent(r: EnrichedReimbursement) {
    updateMutation.mutate({ id: r.id, updates: { status: "sent" } });
    toast({
      title: "Request sent 📬",
      description: `$${r.amount.toFixed(2)} logged for ${r.client?.name ?? "client"}.`,
    });
  }

  function markPaid(r: EnrichedReimbursement) {
    updateMutation.mutate({ id: r.id, updates: { status: "paid" } });
    toast({
      title: "Payment received! 🎉",
      description: `$${r.amount.toFixed(2)} from ${r.client?.name ?? "client"}.`,
    });
  }

  function cancelReimbursement(r: EnrichedReimbursement) {
    updateMutation.mutate({ id: r.id, updates: { status: "cancelled" } });
  }

  return (
    <div className="page-container pb-28">
      <header className="page-header">
        <h1 className="page-title">Reimbursements</h1>
        <p className="page-subtitle">Track what clients owe you</p>

        {totalOutstanding > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 bg-amber-900/30 border border-amber-700/40 rounded-xl px-4 py-2">
            <span className="text-amber-400 text-xl font-bold">${totalOutstanding.toFixed(2)}</span>
            <span className="text-amber-300/70 text-sm">outstanding</span>
          </div>
        )}
      </header>

      {/* Status filter tabs */}
      <div className="flex gap-2 mt-5 overflow-x-auto pb-1 no-scrollbar">
        {STATUS_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
            {t !== "all" && countByStatus(t) > 0 && (
              <span className="ml-1.5 opacity-70">{countByStatus(t)}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-4">
        {isLoading ? (
          <p className="text-muted-foreground text-center py-12">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-3xl">💸</p>
            <p className="text-muted-foreground">
              {tab === "all" ? "No reimbursements yet" : `No ${tab} reimbursements`}
            </p>
            {tab === "all" && (
              <p className="text-xs text-muted-foreground">
                Log a reimbursable spend on the <a href="#/spend" className="text-primary">Spend tab</a>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <ReimbursementRow
                key={r.id}
                r={r}
                onSend={markSent}
                onPaid={markPaid}
                onCancel={cancelReimbursement}
                isPending={updateMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
