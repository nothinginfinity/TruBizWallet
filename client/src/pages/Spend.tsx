import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Card, Client } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = [
  { value: "gas",       label: "⛽ Gas" },
  { value: "restaurant",label: "🍽 Restaurant" },
  { value: "supplies",  label: "📦 Supplies" },
  { value: "other",     label: "💼 Other" },
];

export default function Spend() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
    queryFn: () => apiRequest("GET", "/api/cards").then(r => r.json()),
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("GET", "/api/clients").then(r => r.json()),
  });

  const [form, setForm] = useState({
    cardId: "",
    amount: "",
    merchant: "",
    merchantCategory: "other",
    note: "",
    clientId: "",
    reimbursable: false,
  });

  const suggestedCard = cards.length > 0
    ? [...cards]
        .filter(c => c.creditLimit > 0)
        .sort((a, b) => {
          const uA = (a.currentBalance / a.creditLimit) * 100;
          const uB = (b.currentBalance / b.creditLimit) * 100;
          return uA - uB;
        })[0]
    : null;

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("POST", "/api/activity", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/activity"] });
      qc.invalidateQueries({ queryKey: ["/api/reimbursements"] });
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({ title: "Spend logged!", description: form.reimbursable ? "Reimbursement request created." : undefined });
      setForm({ cardId: "", amount: "", merchant: "", merchantCategory: "other", note: "", clientId: "", reimbursable: false });
    },
    onError: () => toast({ title: "Error", description: "Could not log spend.", variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cardId || !form.amount || !form.merchant) {
      toast({ title: "Missing fields", description: "Card, amount, and merchant are required.", variant: "destructive" });
      return;
    }
    mutation.mutate({
      cardId: parseInt(form.cardId),
      type: "spend",
      amount: parseFloat(form.amount),
      merchant: form.merchant,
      merchantCategory: form.merchantCategory,
      note: form.note || null,
      clientId: form.clientId ? parseInt(form.clientId) : null,
      reimbursable: form.reimbursable,
      reimbursementStatus: form.reimbursable ? "pending" : "none",
      date: new Date().toISOString(),
    });
  }

  const selectedCard = cards.find(c => c.id === parseInt(form.cardId));
  const utilPct = selectedCard
    ? Math.round((selectedCard.currentBalance / selectedCard.creditLimit) * 100)
    : null;

  return (
    <div className="page-container pb-28">
      <header className="page-header">
        <h1 className="page-title">New Spend</h1>
        <p className="page-subtitle">Log a business expense and optionally request reimbursement</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5 mt-4">

        {/* Amount */}
        <div className="card-panel">
          <label className="field-label">Amount ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="field-input text-2xl font-bold"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
        </div>

        {/* Merchant + Category */}
        <div className="card-panel space-y-3">
          <div>
            <label className="field-label">Merchant</label>
            <input
              type="text"
              placeholder="e.g. True Foods Kitchen"
              className="field-input"
              value={form.merchant}
              onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))}
            />
          </div>
          <div>
            <label className="field-label">Category</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, merchantCategory: cat.value }))}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    form.merchantCategory === cat.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card selector */}
        <div className="card-panel">
          <label className="field-label">Card</label>
          {suggestedCard && !form.cardId && (
            <p className="text-xs text-muted-foreground mb-2">
              Suggested: <span className="text-primary font-medium">{suggestedCard.name}</span> ({Math.round((suggestedCard.currentBalance / suggestedCard.creditLimit) * 100)}% util)
            </p>
          )}
          <select
            className="field-input"
            value={form.cardId}
            onChange={e => setForm(f => ({ ...f, cardId: e.target.value }))}
          >
            <option value="">Select a card…</option>
            {cards.map(c => {
              const util = Math.round((c.currentBalance / c.creditLimit) * 100);
              return (
                <option key={c.id} value={c.id}>
                  {c.name} ••{c.last4} — {util}% util
                </option>
              );
            })}
          </select>
          {utilPct !== null && (
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  utilPct > 30 ? "bg-destructive" : "bg-primary"
                }`}
                style={{ width: `${Math.min(utilPct, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Client + Reimbursable */}
        <div className="card-panel space-y-3">
          <div>
            <label className="field-label">Client <span className="text-muted-foreground">(optional)</span></label>
            <select
              className="field-input"
              value={form.clientId}
              onChange={e => setForm(f => ({ ...f, clientId: e.target.value, reimbursable: !!e.target.value && f.reimbursable }))}
            >
              <option value="">No client</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {form.clientId && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Reimbursable?</p>
                <p className="text-xs text-muted-foreground">Client will be sent a payment request</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, reimbursable: !f.reimbursable }))}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  form.reimbursable ? "bg-primary" : "bg-muted"
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                  form.reimbursable ? "left-6" : "left-0.5"
                }`} />
              </button>
            </div>
          )}
        </div>

        {/* Note */}
        <div className="card-panel">
          <label className="field-label">Note <span className="text-muted-foreground">(optional)</span></label>
          <input
            type="text"
            placeholder="e.g. Post-session lunch"
            className="field-input"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base disabled:opacity-50"
        >
          {mutation.isPending ? "Logging…" : form.reimbursable ? "Log & Request Reimbursement" : "Log Spend"}
        </button>
      </form>
    </div>
  );
}
