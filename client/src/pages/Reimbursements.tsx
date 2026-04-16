import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

const STATUS_TABS = ["all", "draft", "sent", "paid", "cancelled"] as const;
type StatusTab = typeof STATUS_TABS[number];

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-muted text-muted-foreground",
  sent:      "bg-amber-900/40 text-amber-400",
  paid:      "bg-green-900/40 text-green-400",
  cancelled: "bg-red-900/40 text-red-400",
};

export default function Reimbursements() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<StatusTab>("all");

  const { data: all = [], isLoading } = useQuery<Reimbursement[]>({
    queryKey: ["/api/reimbursements"],
    queryFn: () => apiRequest("GET", "/api/reimbursements").then(r => r.json()),
  });

  const filtered = tab === "all" ? all : all.filter(r => r.status === tab);

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/reimbursements/${id}`, updates).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/reimbursements"] });
      qc.invalidateQueries({ queryKey: ["/api/activity"] });
    },
    onError: () => toast({ title: "Error", description: "Could not update.", variant: "destructive" }),
  });

  function markSent(r: Reimbursement) {
    updateMutation.mutate({ id: r.id, updates: { status: "sent" } });
    toast({ title: "Marked as sent", description: `$${r.amount.toFixed(2)} request sent to client.` });
  }

  function markPaid(r: Reimbursement) {
    updateMutation.mutate({ id: r.id, updates: { status: "paid" } });
    toast({ title: "Payment received!", description: `$${r.amount.toFixed(2)} marked as paid.` });
  }

  function cancelReimbursement(r: Reimbursement) {
    updateMutation.mutate({ id: r.id, updates: { status: "cancelled" } });
  }

  const totalOutstanding = all
    .filter(r => r.status === "draft" || r.status === "sent")
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="page-container pb-28">
      <header className="page-header">
        <h1 className="page-title">Reimbursements</h1>
        {totalOutstanding > 0 && (
          <p className="text-amber-400 font-semibold mt-1">
            ${totalOutstanding.toFixed(2)} outstanding
          </p>
        )}
      </header>

      {/* Status tabs */}
      <div className="flex gap-2 mt-4 overflow-x-auto pb-1 no-scrollbar">
        {STATUS_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t !== "all" && (
              <span className="ml-1.5 opacity-70">
                {all.filter(r => r.status === t).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No reimbursements here</p>
      ) : (
        <div className="space-y-3 mt-4">
          {filtered.map(r => (
            <div key={r.id} className="card-panel space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-lg">${r.amount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    via {r.method} · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                  {r.notes && <p className="text-xs text-muted-foreground mt-0.5">{r.notes}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[r.status] ?? "bg-muted text-muted-foreground"}`}>
                  {r.status}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {r.status === "draft" && (
                  <button
                    onClick={() => markSent(r)}
                    disabled={updateMutation.isPending}
                    className="flex-1 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    Send Request
                  </button>
                )}
                {r.status === "sent" && (
                  <button
                    onClick={() => markPaid(r)}
                    disabled={updateMutation.isPending}
                    className="flex-1 py-1.5 rounded-lg bg-green-700 text-white text-sm font-medium disabled:opacity-50"
                  >
                    Mark Paid
                  </button>
                )}
                {(r.status === "draft" || r.status === "sent") && (
                  <button
                    onClick={() => cancelReimbursement(r)}
                    disabled={updateMutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
