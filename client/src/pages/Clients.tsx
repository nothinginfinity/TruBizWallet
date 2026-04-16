import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Client } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const PAYMENT_METHODS = ["zelle", "venmo", "cash", "check"];

function ClientCard({ client, onSelect }: { client: Client; onSelect: (c: Client) => void }) {
  return (
    <button
      onClick={() => onSelect(client)}
      className="w-full text-left card-panel flex items-center justify-between gap-3 hover:border-primary/50 transition-colors"
    >
      <div>
        <p className="font-semibold">{client.name}</p>
        <p className="text-xs text-muted-foreground">{client.phone || client.email || "No contact"}</p>
      </div>
      <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{client.preferredPayment}</span>
    </button>
  );
}

function AddClientForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", phone: "", email: "", zelleHandle: "", venmoHandle: "", preferredPayment: "zelle", notes: "" });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("POST", "/api/clients", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client added!" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Could not add client.", variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    mutation.mutate({ ...form });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Add Client</h2>
          <button onClick={onClose} className="text-muted-foreground text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="field-input" placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input className="field-input" placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <input className="field-input" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <input className="field-input" placeholder="Zelle handle" value={form.zelleHandle} onChange={e => setForm(f => ({ ...f, zelleHandle: e.target.value }))} />
          <select className="field-input" value={form.preferredPayment} onChange={e => setForm(f => ({ ...f, preferredPayment: e.target.value }))}>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </select>
          <input className="field-input" placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <button type="submit" disabled={mutation.isPending} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50">
            {mutation.isPending ? "Saving…" : "Add Client"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ClientDetail({ client, onBack }: { client: Client; onBack: () => void }) {
  const { data } = useQuery<Client & { activity: any[] }>({
    queryKey: ["/api/clients", client.id],
    queryFn: () => apiRequest("GET", `/api/clients/${client.id}`).then(r => r.json()),
  });

  const totalOwed = (data?.activity ?? []).filter(a => a.reimbursementStatus !== "received").reduce((s: number, a: any) => s + (a.reimbursementAmount ?? a.amount), 0);

  return (
    <div className="page-container pb-28">
      <button onClick={onBack} className="text-primary text-sm mb-4">&larr; Back</button>
      <div className="card-panel mb-4">
        <h2 className="text-xl font-bold">{client.name}</h2>
        <p className="text-muted-foreground text-sm">{client.phone} {client.email}</p>
        <p className="text-muted-foreground text-xs mt-1">Prefers: {client.preferredPayment} {client.zelleHandle ? `· ${client.zelleHandle}` : ""}</p>
        {totalOwed > 0 && (
          <p className="mt-3 text-lg font-semibold text-amber-400">Outstanding: ${totalOwed.toFixed(2)}</p>
        )}
      </div>

      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Reimbursable Activity</h3>
      {(data?.activity ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">No reimbursable activity yet</p>
      ) : (
        <div className="space-y-2">
          {(data?.activity ?? []).map((a: any) => (
            <div key={a.id} className="card-panel flex items-center justify-between">
              <div>
                <p className="font-medium">{a.merchant}</p>
                <p className="text-xs text-muted-foreground">{a.date} · {a.merchantCategory}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">${a.amount.toFixed(2)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  a.reimbursementStatus === "received" ? "bg-green-900/40 text-green-400" :
                  a.reimbursementStatus === "pending" ? "bg-amber-900/40 text-amber-400" :
                  "bg-muted text-muted-foreground"
                }`}>{a.reimbursementStatus}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Clients() {
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("GET", "/api/clients").then(r => r.json()),
  });

  if (selected) return <ClientDetail client={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="page-container pb-28">
      <header className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Clients</h1>
            <p className="page-subtitle">Track who owes you reimbursements</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold"
          >+</button>
        </div>
      </header>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Loading…</p>
      ) : clients.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-muted-foreground">No clients yet</p>
          <button onClick={() => setShowAdd(true)} className="text-primary text-sm">Add your first client</button>
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          {clients.map(c => <ClientCard key={c.id} client={c} onSelect={setSelected} />)}
        </div>
      )}

      {showAdd && <AddClientForm onClose={() => setShowAdd(false)} />}
    </div>
  );
}
