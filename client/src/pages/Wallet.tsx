import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCardSchema, type Card, type InsertCard, type Activity } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowDownCircle, ArrowUpCircle, X } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const CARD_COLORS = [
  { label: "Navy",    value: "#1e3a6e" },
  { label: "Purple",  value: "#6d28d9" },
  { label: "Gold",    value: "#c9a227" },
  { label: "Teal",    value: "#0d9488" },
  { label: "Slate",   value: "#475569" },
  { label: "Emerald", value: "#059669" },
  { label: "Rose",    value: "#be123c" },
  { label: "Indigo",  value: "#4f46e5" },
];

const formSchema = insertCardSchema.extend({
  creditLimit:    z.coerce.number().min(100, "Minimum $100"),
  currentBalance: z.coerce.number().min(0),
  usageGoalPct:   z.coerce.number().min(1).max(30),
  dueDay:         z.coerce.number().min(1).max(31),
  reportingDay:   z.coerce.number().min(1).max(31),
  layer:          z.coerce.number().min(1).max(7),
  last4:          z.string().length(4, "Must be 4 digits").regex(/^\d{4}$/),
});

type FormData = z.infer<typeof formSchema>;

function utilColor(util: number, goal: number) {
  if (util <= goal) return "#34d399";
  if (util <= goal * 1.5) return "#fbbf24";
  return "#f87171";
}

// Full-size credit card visual (Apple Wallet style)
function CreditCardFace({ card, onClick }: { card: Card; onClick?: () => void }) {
  const util = card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0;
  const pct = Math.min(util, 100);
  // Derive a second gradient color (darken)
  const baseColor = card.color;

  return (
    <div
      className="credit-card"
      style={{ background: `linear-gradient(135deg, ${baseColor} 0%, ${baseColor}cc 50%, ${baseColor}99 100%)` }}
      onClick={onClick}
      data-testid={`card-face-${card.id}`}
    >
      {/* Shine overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-transparent pointer-events-none" />
      {/* Gloss bar */}
      <div className="absolute top-0 left-0 right-0 h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-t-[18px] pointer-events-none" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-between p-5 text-white">
        {/* Top row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-medium opacity-60 tracking-widest uppercase">Layer {card.layer}</p>
            <p className="text-sm font-semibold mt-0.5 leading-tight max-w-[180px]">{card.name}</p>
          </div>
          {/* Mastercard-style circles */}
          <svg viewBox="0 0 40 28" className="w-11 h-8 opacity-80" fill="none">
            <circle cx="14" cy="14" r="11" fill="rgba(255,255,255,0.35)"/>
            <circle cx="26" cy="14" r="11" fill="rgba(255,255,255,0.55)"/>
          </svg>
        </div>

        {/* Chip */}
        <div
          className="w-10 h-8 rounded-[5px] flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.4))" }}
        >
          <div className="grid grid-cols-2 gap-[2px]">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-[7px] h-[7px] rounded-[1px]" style={{ background: "rgba(0,0,0,0.15)" }} />
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div>
          <p className="font-mono text-sm tracking-[0.25em] opacity-80">•••• •••• •••• {card.last4}</p>
          <div className="flex justify-between items-end mt-2">
            <div>
              <p className="text-[9px] opacity-50 uppercase tracking-widest">Balance</p>
              <p className="text-lg font-bold leading-none">${card.currentBalance.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] opacity-50 uppercase tracking-widest">Limit</p>
              <p className="text-sm font-semibold opacity-80">${card.creditLimit.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] opacity-50 uppercase tracking-widest">Due day</p>
              <p className="text-sm font-semibold opacity-80">{card.dueDay}</p>
            </div>
          </div>

          {/* Util bar */}
          <div className="mt-3 relative">
            <div className="h-[3px] rounded-full bg-white/20">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: utilColor(util, card.usageGoalPct) }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] opacity-50">{util.toFixed(1)}% used</span>
              <span className="text-[9px] opacity-50">Goal: {card.usageGoalPct}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Card detail sheet shown when a card is tapped
function CardDetailSheet({ card, onClose }: { card: Card; onClose: () => void }) {
  const [activityType, setActivityType] = useState<"spend" | "payment">("spend");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const { toast } = useToast();

  const { data: cardActivity = [], isLoading: actLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activity", card.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/activity?cardId=${card.id}`);
      return res.json();
    },
  });

  const logMutation = useMutation({
    mutationFn: (data: object) => apiRequest("POST", "/api/activity", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity", card.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/scores"] });
      setAmount("");
      setMerchant("");
      toast({ title: activityType === "payment" ? "Payment recorded" : "Spend recorded" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/cards/${card.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scores"] });
      onClose();
      toast({ title: "Card removed" });
    },
  });

  const handleLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    logMutation.mutate({
      cardId: card.id, type: activityType,
      amount: parseFloat(amount),
      merchant: merchant || null, note: null,
      date: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
      <div
        className="flex-1"
        onClick={onClose}
      />
      <div className="bg-[#0f0f18] rounded-t-[24px] overflow-hidden" style={{ maxHeight: "88dvh", display: "flex", flexDirection: "column" }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <div>
            <h2 className="text-base font-semibold">{card.name}</h2>
            <p className="text-xs text-white/40">••••{card.last4} · {card.issuer}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => deleteMutation.mutate()}
              className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center text-red-400"
              data-testid={`button-delete-card-${card.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              data-testid="button-close-sheet"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pb-8 space-y-5">
          {/* Card visual (small) */}
          <CreditCardFace card={card} />

          {/* Log activity */}
          <div>
            <p className="section-label mb-3">Log Activity</p>
            <form onSubmit={handleLog} className="glass-panel p-4 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActivityType("spend")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                    activityType === "spend"
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/6 text-white/50"
                  }`}
                  data-testid="button-type-spend"
                >
                  <ArrowUpCircle className="w-4 h-4" /> Spend
                </button>
                <button
                  type="button"
                  onClick={() => setActivityType("payment")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                    activityType === "payment"
                      ? "bg-emerald-600 text-white"
                      : "bg-white/6 text-white/50"
                  }`}
                  data-testid="button-type-payment"
                >
                  <ArrowDownCircle className="w-4 h-4" /> Payment
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-medium">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white/6 rounded-xl py-2.5 pl-7 pr-4 text-sm border border-white/8 focus:outline-none focus:border-primary/50 placeholder:text-white/25"
                  required
                  data-testid="input-activity-amount"
                />
              </div>
              {activityType === "spend" && (
                <input
                  type="text"
                  value={merchant}
                  onChange={e => setMerchant(e.target.value)}
                  placeholder="Merchant (optional)"
                  className="w-full bg-white/6 rounded-xl py-2.5 px-4 text-sm border border-white/8 focus:outline-none focus:border-primary/50 placeholder:text-white/25"
                  data-testid="input-merchant"
                />
              )}
              <Button type="submit" className="w-full rounded-xl" disabled={logMutation.isPending} data-testid="button-submit-activity">
                {logMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </form>
          </div>

          {/* Activity log */}
          <div>
            <p className="section-label mb-3">Recent Activity</p>
            {actLoading ? (
              <div className="space-y-2">
                {[0,1,2].map(i => <div key={i} className="skeleton h-12" />)}
              </div>
            ) : cardActivity.length === 0 ? (
              <div className="glass-panel p-6 text-center text-white/30 text-sm">No activity yet</div>
            ) : (
              <div className="ios-list">
                {cardActivity.slice(0, 15).map((a, idx) => (
                  <div key={a.id} className="ios-list-row" data-testid={`activity-row-${a.id}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${a.type === "payment" ? "bg-emerald-500/15" : "bg-blue-500/15"}`}>
                      {a.type === "payment"
                        ? <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
                        : <ArrowUpCircle className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.merchant || a.note || (a.type === "payment" ? "Payment" : "Spend")}</p>
                      <p className="text-xs text-white/35">{format(new Date(a.date), "MMM d, yyyy")}</p>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${a.type === "payment" ? "text-emerald-400" : "text-white/80"}`}>
                      {a.type === "payment" ? "-" : "+"}${Number(a.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddCardSheet({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "", issuer: "", last4: "", cardType: "visa",
      color: "#1e3a6e", creditLimit: 5000, currentBalance: 0,
      statementBalance: 0, usageGoalPct: 10, dueDay: 15,
      reportingDay: 10, layer: 3, notes: "",
      createdAt: new Date().toISOString(),
    },
  });

  const mutation = useMutation({
    mutationFn: (data: InsertCard) => apiRequest("POST", "/api/cards", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scores"] });
      setOpen(false);
      form.reset();
      onAdded();
      toast({ title: "Card added" });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate({ ...data, createdAt: new Date().toISOString() });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30"
          data-testid="button-add-card"
          aria-label="Add card"
        >
          <Plus className="w-6 h-6 text-primary-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto bg-[#0f0f18] border border-white/10">
        <DialogHeader>
          <DialogTitle>Add Card</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Card Name</FormLabel>
                  <FormControl><Input {...field} placeholder="Chase Ink Business Cash" data-testid="input-card-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="issuer" render={({ field }) => (
                <FormItem>
                  <FormLabel>Issuer</FormLabel>
                  <FormControl><Input {...field} placeholder="Chase" data-testid="input-issuer" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="last4" render={({ field }) => (
                <FormItem>
                  <FormLabel>Last 4 Digits</FormLabel>
                  <FormControl><Input {...field} placeholder="4821" maxLength={4} data-testid="input-last4" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="creditLimit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Credit Limit ($)</FormLabel>
                  <FormControl><Input {...field} type="number" data-testid="input-credit-limit" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="currentBalance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Balance ($)</FormLabel>
                  <FormControl><Input {...field} type="number" data-testid="input-balance" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="usageGoalPct" render={({ field }) => (
                <FormItem>
                  <FormLabel>Usage Goal (%)</FormLabel>
                  <FormControl><Input {...field} type="number" min={1} max={30} data-testid="input-usage-goal" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dueDay" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Day</FormLabel>
                  <FormControl><Input {...field} type="number" min={1} max={31} data-testid="input-due-day" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="layer" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>TrueBuild Layer</FormLabel>
                  <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={String(field.value)}>
                    <FormControl><SelectTrigger data-testid="select-layer"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {[1,2,3,4,5,6,7].map(l => (
                        <SelectItem key={l} value={String(l)}>Layer {l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="color" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Card Color</FormLabel>
                  <div className="flex gap-2.5 flex-wrap">
                    {CARD_COLORS.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        className={`w-9 h-9 rounded-full transition-all ${field.value === c.value ? "scale-125 ring-2 ring-offset-2 ring-offset-background ring-white/60" : "opacity-70"}`}
                        style={{ backgroundColor: c.value }}
                        onClick={() => field.onChange(c.value)}
                        data-testid={`color-${c.label.toLowerCase()}`}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <Button type="submit" className="w-full rounded-xl" disabled={mutation.isPending} data-testid="button-submit-card">
              {mutation.isPending ? "Adding…" : "Add Card"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Wallet() {
  const { data: cards = [], isLoading } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
  });

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/seed"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cards"] }),
  });

  const totalCredit   = cards.reduce((s, c) => s + c.creditLimit, 0);
  const totalBalance  = cards.reduce((s, c) => s + c.currentBalance, 0);
  const totalAvailable = totalCredit - totalBalance;

  if (isLoading) {
    return (
      <div className="page-content px-4 pt-14 space-y-3">
        <div className="skeleton h-8 w-32" />
        <div className="skeleton h-48 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  // Card fan: each card peeks at the bottom like Apple Wallet
  const PEEK = 52; // px each card peeks below the previous

  return (
    <div className="page-content">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Wallet</h1>
          <p className="text-xs text-white/40 mt-0.5">{cards.length} cards · ${totalCredit.toLocaleString()} total credit</p>
        </div>
        <AddCardSheet onAdded={() => {}} />
      </div>

      {/* Summary pills */}
      {cards.length > 0 && (
        <div className="flex gap-2 px-5 mb-5 overflow-x-auto no-scrollbar">
          {[
            { label: "Credit",    value: `$${totalCredit.toLocaleString()}`,    color: "text-white/70" },
            { label: "Balance",   value: `$${totalBalance.toLocaleString()}`,   color: "text-yellow-400" },
            { label: "Available", value: `$${totalAvailable.toLocaleString()}`, color: "text-emerald-400" },
          ].map(p => (
            <div key={p.label} className="glass-panel flex-shrink-0 px-4 py-2.5 flex flex-col items-center gap-0.5">
              <p className="text-[9px] text-white/35 uppercase tracking-widest">{p.label}</p>
              <p className={`text-sm font-bold ${p.color}`}>{p.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Apple Wallet card fan */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
              <rect x="2" y="6" width="20" height="14" rx="2.5"/>
              <path d="M2 10h20"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold mb-1">No cards yet</p>
            <p className="text-sm text-white/40">Add your TrueBuild cards to start tracking utilization and building credit.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()}>
              Load demo
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-5">
          {/* Fan stack — each card peeks PEEK px below the previous */}
          <div
            className="relative w-full"
            style={{ height: `calc(${(cards.length - 1) * PEEK}px + (100vw - 40px) / 1.586)` }}
          >
            {cards.map((card, idx) => (
              <div
                key={card.id}
                className="card-fan-item"
                style={{ top: `${idx * PEEK}px`, zIndex: idx + 1 }}
                data-testid={`wallet-card-${card.id}`}
              >
                <CreditCardFace
                  card={card}
                  onClick={() => setSelectedCard(card)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card detail sheet */}
      {selectedCard && (
        <CardDetailSheet
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}
