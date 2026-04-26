import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCardSchema, type Card, type InsertCard, type Activity, type ScoreSnapshot } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle, X } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import CreditCardFace from "@/components/CreditCardFace";

const CARD_COLORS = [
  { label: "Navy",    value: "#1a1a2e" },
  { label: "Dark Blue", value: "#16213e" },
  { label: "Blue",    value: "#0f3460" },
  { label: "Purple",  value: "#533483" },
  { label: "Slate",   value: "#1b1b2f" },
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

// Score tier helpers
function sbssTier(v: number): { label: string; color: string } {
  if (v >= 200) return { label: "Excellent", color: "#34d399" };
  if (v >= 160) return { label: "Good", color: "#38bdf8" };
  if (v >= 120) return { label: "Fair", color: "#fbbf24" };
  return { label: "Needs Work", color: "#f87171" };
}

function paydexTier(v: number): { label: string; color: string } {
  if (v >= 80) return { label: "Excellent", color: "#34d399" };
  if (v >= 70) return { label: "Good", color: "#38bdf8" };
  if (v >= 50) return { label: "Fair", color: "#fbbf24" };
  return { label: "Needs Work", color: "#f87171" };
}

function intelliscoreTier(v: number): { label: string; color: string } {
  if (v >= 76) return { label: "Low Risk", color: "#34d399" };
  if (v >= 51) return { label: "Medium", color: "#38bdf8" };
  if (v >= 26) return { label: "High Risk", color: "#fbbf24" };
  return { label: "Very High", color: "#f87171" };
}

function ScoreTile({ label, value, maxVal, tier }: { label: string; value: number | null; maxVal: number; tier: { label: string; color: string } }) {
  if (value === null) return null;
  const pct = Math.min((value / maxVal) * 100, 100);
  return (
    <div className="flex-1 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="text-2xl font-bold" style={{ color: tier.color, fontFamily: "var(--font-display)" }}>{value}</p>
      <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{label}</p>
      <div className="mt-3 h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: tier.color }}
        />
      </div>
      <span className="text-[9px] font-semibold mt-1.5 inline-block px-1.5 py-0.5 rounded-full"
        style={{ color: tier.color, background: `${tier.color}18` }}>
        {tier.label}
      </span>
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
          {/* Card visual */}
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
                {cardActivity.slice(0, 15).map((a) => (
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
      color: "#1a1a2e", creditLimit: 5000, currentBalance: 0,
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
                  <FormControl><Input {...field} placeholder="TrueBuild Starter Visa" data-testid="input-card-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="issuer" render={({ field }) => (
                <FormItem>
                  <FormLabel>Issuer</FormLabel>
                  <FormControl><Input {...field} placeholder="Visa" data-testid="input-issuer" /></FormControl>
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
                        data-testid={`color-${c.label.toLowerCase().replace(/\s+/g, "-")}`}
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

  const { data: scores = [] } = useQuery<ScoreSnapshot[]>({
    queryKey: ["/api/scores"],
  });

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/seed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scores"] });
    },
  });

  const totalCredit   = cards.reduce((s, c) => s + c.creditLimit, 0);
  const totalBalance  = cards.reduce((s, c) => s + c.currentBalance, 0);
  const totalAvailable = totalCredit - totalBalance;

  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null;

  if (isLoading) {
    return (
      <div className="page-content px-4 pt-14 space-y-3" style={{ background: "#0d0d0d", minHeight: "100dvh" }}>
        <div className="skeleton h-8 w-32" />
        <div className="skeleton h-48 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  const PEEK = 52;

  return (
    <div className="page-content" style={{ background: "#0d0d0d", minHeight: "100dvh" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Wallet</h1>
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
            <div key={p.label} className="flex-shrink-0 px-4 py-2.5 flex flex-col items-center gap-0.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[9px] text-white/35 uppercase tracking-widest">{p.label}</p>
              <p className={`text-sm font-bold ${p.color}`}>{p.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Apple Wallet card stack */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
              <rect x="2" y="6" width="20" height="14" rx="2.5"/>
              <path d="M2 10h20"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold text-white mb-1">No cards yet</p>
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

      {/* Score panel — SBSS, Paydex, Intelliscore */}
      {latestScore && (latestScore.sbss !== null || latestScore.paydex !== null || latestScore.intelliscore !== null) && (
        <div className="px-5 mt-6 mb-6">
          <p className="section-label mb-3 text-white/50">Bureau Scores</p>
          <div className="flex gap-3">
            {latestScore.sbss !== null && (
              <ScoreTile
                label="SBSS"
                value={latestScore.sbss}
                maxVal={300}
                tier={sbssTier(latestScore.sbss)}
              />
            )}
            {latestScore.paydex !== null && (
              <ScoreTile
                label="Paydex"
                value={latestScore.paydex}
                maxVal={100}
                tier={paydexTier(latestScore.paydex)}
              />
            )}
            {latestScore.intelliscore !== null && (
              <ScoreTile
                label="Intelliscore"
                value={latestScore.intelliscore}
                maxVal={100}
                tier={intelliscoreTier(latestScore.intelliscore)}
              />
            )}
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
