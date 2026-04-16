import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Client, Activity } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const PAYMENT_METHODS = ["zelle", "venmo", "cash", "check"] as const;

const METHOD_ICONS: Record<string, string> = {
  zelle: "💙",
  venmo: "💸",
  cash: "💵",
  check: "📝",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-xl" : "w-10 h-10 text-sm";
  // Deterministic color from name
  const colors = ["bg-violet-700", "bg-blue-700", "bg-emerald-700", "bg-rose-700", "bg-amber-700", "bg-cyan-700"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${sizeClass} ${color} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials(name)}
    </div>
  );
}

// ── Client list card ────────────────────────────────────────────────────────
function ClientCard({
  client,
  outstanding,
  onSelect,
}: {
  client: Client;
  outstanding: number;
  onSelect: (c: Client) => void;
}) {
  return (
    <button
      onClick={() => onSelect(client)}
      className="w-full text-left card-panel flex items-center gap-3 hover:border-primary/50 transition-colors"
    >
      <Avatar name={client.name} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{client.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {client.phone || client.email || "No contact"}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">
          {METHOD_ICONS[client.preferredPayment]} {client.preferredPayment}
        </span>
        {outstanding > 0 && (
          <span className="text-xs font-semibold text-amber-400">
            ${outstanding.toFixed(2)} owed
          </span>
        )}
      </div>
    </button>
  );
}

// ── Add / Edit form (bottom sheet) ──────────────────────────────────────────
function ClientForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Client;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!initial;

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    zelleHandle: initial?.zelleHandle ?? "",
    venmoHandle: initial?.venmoHandle ?? "",
    preferredPayment: initial?.preferredPayment ?? "zelle",
    notes: initial?.notes ?? "",
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isEdit
        ? apiRequest("PATCH", `/api/clients/${initial!.id}`, data).then(r => r.json())
        : apiRequest("POST", "/api/clients", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: isEdit ? "Client updated!" : "Client added!" });
      onSaved?.();
      onClose();
    },
    onError: () =>
      toast({ title: "Error", description: "Could not save client.", variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    mutation.mutate({ ...form });
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-card rounded-t-2xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{isEdit ? "Edit Client" : "Add Client"}</h2>
          <button onClick={onClose} className="text-muted-foreground text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="field-label">Name *</label>
            <input
              className="field-input"
              placeholder="Alex Rivera"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Phone</label>
              <input
                className="field-input"
                placeholder="949-555-0101"
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input
                className="field-input"
                placeholder="alex@example.com"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="field-label">Preferred payment</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, preferredPayment: m }))}
                  className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                    form.preferredPayment === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {METHOD_ICONS[m]} {m}
                </button>
              ))}
            </div>
          </div>
          {(form.preferredPayment === "zelle" || form.zelleHandle) && (
            <div>
              <label className="field-label">Zelle handle (email or phone)</label>
              <input
                className="field-input"
                placeholder="alex@example.com"
                value={form.zelleHandle}
                onChange={e => setForm(f => ({ ...f, zelleHandle: e.target.value }))}
              />
            </div>
          )}
          {(form.preferredPayment === "venmo" || form.venmoHandle) && (
            <div>
              <label className="field-label">Venmo @handle</label>
              <input
                className="field-input"
                placeholder="alexrivera"
                value={form.venmoHandle}
                onChange={e => setForm(f => ({ ...f, venmoHandle: e.target.value }))}
              />
            </div>
          )}
          <div>
            <label className="field-label">Notes</label>
            <input
              className="field-input"
              placeholder="Optional notes"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50"
          >
            {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Client"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Client detail view ─────────────────────────────────────────────────────────
function ClientDetail({
  client,
  onBack,
}: {
  client: Client;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading } = useQuery<Client & { activity: Activity[] }>({
    queryKey: ["/api/clients", client.id],
    queryFn: () =>
      apiRequest("GET", `/api/clients/${client.id}`).then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiRequest("DELETE", `/api/clients/${client.id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client removed" });
      onBack();
    },
    onError: () =>
      toast({ title: "Error", description: "Could not delete client.", variant: "destructive" }),
  });

  const activityList: Activity[] = data?.activity ?? [];
  const outstanding = activityList
    .filter(a => (a as any).reimbursementStatus !== "received")
    .reduce((s, a) => s + ((a as any).reimbursementAmount ?? a.amount), 0);
  const totalReimbursed = activityList
    .filter(a => (a as any).reimbursementStatus === "received")
    .reduce((s, a) => s + ((a as any).reimbursementAmount ?? a.amount), 0);

  // Use live data from the detail endpoint so edits are reflected
  const live = data ?? client;
  const zelleLink = live.zelleHandle
    ? `zelle://send?recipient=${encodeURIComponent(live.zelleHandle)}`
    : null;
  const venmoLink = live.venmoHandle
    ? `venmo://paycharge?txn=charge&recipients=${encodeURIComponent(live.venmoHandle)}`
    : null;

  return (
    <div className="page-container pb-28">
      {/* Back + actions bar */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={onBack} className="text-primary text-sm flex items-center gap-1">
          ← Clients
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => setShowEdit(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Edit
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-red-500 hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Profile card */}
      <div className="card-panel mb-5">
        <div className="flex items-center gap-4">
          <Avatar name={live.name} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{live.name}</h2>
            <p className="text-sm text-muted-foreground">
              {[live.phone, live.email].filter(Boolean).join(" · ") || "No contact info"}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-muted/40 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className={`text-lg font-bold ${outstanding > 0 ? "text-amber-400" : "text-muted-foreground"}`}>
              ${outstanding.toFixed(2)}
            </p>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Reimbursed</p>
            <p className="text-lg font-bold text-green-400">${totalReimbursed.toFixed(2)}</p>
          </div>
        </div>

        {/* Payment handles + quick-action links */}
        {(zelleLink || venmoLink) && (
          <div className="flex gap-2 mt-3">
            {zelleLink && (
              <a
                href={zelleLink}
                className="flex-1 py-2 rounded-lg bg-blue-700/30 border border-blue-700/40 text-blue-300 text-xs font-medium text-center"
              >
                💙 Open Zelle
              </a>
            )}
            {venmoLink && (
              <a
                href={venmoLink}
                className="flex-1 py-2 rounded-lg bg-indigo-700/30 border border-indigo-700/40 text-indigo-300 text-xs font-medium text-center"
              >
                💸 Open Venmo
              </a>
            )}
            {live.phone && (
              <a
                href={`sms:${live.phone}`}
                className="flex-1 py-2 rounded-lg bg-muted border border-border text-muted-foreground text-xs font-medium text-center"
              >
                💬 Text
              </a>
            )}
          </div>
        )}

        {live.notes && (
          <p className="mt-3 text-xs text-muted-foreground italic">“{live.notes}”</p>
        )}
      </div>

      {/* Reimbursable activity */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Reimbursable Activity
        </h3>
        <a
          href="#/spend"
          className="text-xs text-primary"
        >
          + Log Spend
        </a>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm text-center py-8">Loading…</p>
      ) : activityList.length === 0 ? (
        <div className="text-center py-10 space-y-2">
          <p className="text-2xl">🧭</p>
          <p className="text-muted-foreground text-sm">No reimbursable activity yet</p>
          <a href="#/spend" className="text-primary text-sm">Log a spend for this client</a>
        </div>
      ) : (
        <div className="space-y-2">
          {activityList.map((a: any) => (
            <div key={a.id} className="card-panel flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{a.merchant}</p>
                <p className="text-xs text-muted-foreground">
                  {a.date} · {a.merchantCategory}
                </p>
              </div>
              <div className="text-right ml-3">
                <p className="font-semibold">${a.amount.toFixed(2)}</p>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    a.reimbursementStatus === "received"
                      ? "bg-green-900/40 text-green-400"
                      : a.reimbursementStatus === "pending"
                      ? "bg-amber-900/40 text-amber-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {a.reimbursementStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit sheet */}
      {showEdit && (
        <ClientForm
          initial={live as Client}
          onClose={() => setShowEdit(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["/api/clients", client.id] })}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="w-full bg-card rounded-t-2xl p-5 space-y-4">
            <h2 className="text-lg font-bold">Delete {live.name}?</h2>
            <p className="text-muted-foreground text-sm">
              This won’t delete their activity or reimbursements — just the client record.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 py-3 rounded-xl bg-red-700 text-white font-semibold disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Clients page ───────────────────────────────────────────────────────────
export default function Clients() {
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("GET", "/api/clients").then(r => r.json()),
  });

  // Fetch all reimbursable activity to compute outstanding per client
  const { data: reimbursableActivity = [] } = useQuery<Activity[]>({
    queryKey: ["/api/activity/reimbursable"],
    queryFn: () =>
      apiRequest("GET", "/api/activity/reimbursable").then(r => r.json()),
  });

  function outstandingFor(clientId: number) {
    return reimbursableActivity
      .filter(
        (a: any) =>
          a.clientId === clientId && a.reimbursementStatus !== "received"
      )
      .reduce(
        (s: number, a: any) => s + (a.reimbursementAmount ?? a.amount),
        0
      );
  }

  const totalOutstanding = clients.reduce(
    (s, c) => s + outstandingFor(c.id),
    0
  );

  if (selected)
    return (
      <ClientDetail client={selected} onBack={() => setSelected(null)} />
    );

  return (
    <div className="page-container pb-28">
      <header className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Clients</h1>
            <p className="page-subtitle">Track who owes you</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold"
          >
            +
          </button>
        </div>

        {/* Outstanding summary pill */}
        {totalOutstanding > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 bg-amber-900/30 border border-amber-700/40 rounded-xl px-4 py-2">
            <span className="text-amber-400 text-lg font-bold">
              ${totalOutstanding.toFixed(2)}
            </span>
            <span className="text-amber-300/70 text-sm">total outstanding</span>
          </div>
        )}
      </header>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Loading…</p>
      ) : clients.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-3xl">👥</p>
          <p className="text-muted-foreground">No clients yet</p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-primary text-sm"
          >
            Add your first client
          </button>
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          {clients.map(c => (
            <ClientCard
              key={c.id}
              client={c}
              outstanding={outstandingFor(c.id)}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      {showAdd && <ClientForm onClose={() => setShowAdd(false)} />}
    </div>
  );
}
