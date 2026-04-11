import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCardSchema, type Card, type InsertCard, type Activity } from "@shared/schema";
import { z } from "zod";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Trash2, CreditCard, DollarSign, ArrowDownCircle,
  ArrowUpCircle, ChevronDown, ChevronUp, Layers
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const CARD_COLORS = [
  { label: "Navy", value: "#1a2f5a" },
  { label: "Purple", value: "#5b21b6" },
  { label: "Amber", value: "#b45309" },
  { label: "Teal", value: "#0d9488" },
  { label: "Slate", value: "#475569" },
  { label: "Emerald", value: "#059669" },
  { label: "Rose", value: "#be123c" },
  { label: "Indigo", value: "#3730a3" },
];

const formSchema = insertCardSchema.extend({
  creditLimit: z.coerce.number().min(100, "Minimum $100"),
  currentBalance: z.coerce.number().min(0),
  usageGoalPct: z.coerce.number().min(1).max(30),
  dueDay: z.coerce.number().min(1).max(31),
  reportingDay: z.coerce.number().min(1).max(31),
  layer: z.coerce.number().min(1).max(7),
  last4: z.string().length(4, "Must be exactly 4 digits").regex(/^\d{4}$/),
});

type FormData = z.infer<typeof formSchema>;

function utilColor(util: number, goal: number) {
  if (util <= goal) return "#10b981";
  if (util <= goal * 1.5) return "#f59e0b";
  return "#ef4444";
}

function CreditCardDisplay({ card }: { card: Card }) {
  const util = card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0;
  return (
    <div
      className="relative rounded-2xl p-5 text-white overflow-hidden w-full aspect-[1.7/1] max-w-sm flex flex-col justify-between"
      style={{ background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}cc 100%)` }}
    >
      {/* Shine overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-xs opacity-70 font-medium">Layer {card.layer}</p>
          <p className="text-sm font-semibold mt-0.5 leading-tight">{card.name}</p>
        </div>
        <svg viewBox="0 0 40 28" className="w-10 h-7 opacity-90" fill="none">
          <circle cx="15" cy="14" r="10" fill="#fff" opacity="0.5"/>
          <circle cx="25" cy="14" r="10" fill="#fff" opacity="0.8"/>
        </svg>
      </div>

      <div className="relative z-10">
        <p className="text-base font-mono tracking-widest opacity-90">•••• •••• •••• {card.last4}</p>
        <div className="flex justify-between items-end mt-2">
          <div>
            <p className="text-xs opacity-60">Balance</p>
            <p className="text-lg font-bold">${card.currentBalance.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-60">Limit</p>
            <p className="text-sm font-semibold opacity-90">${card.creditLimit.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddCardDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "", issuer: "", last4: "", cardType: "visa",
      color: "#1a2f5a", creditLimit: 5000, currentBalance: 0,
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
      toast({ title: "Card added", description: "Your card has been added to the wallet." });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate({ ...data, createdAt: new Date().toISOString() });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-add-card">
          <Plus className="w-4 h-4 mr-2" /> Add Card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Credit Card</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
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
                  <FormLabel>Payment Due Day</FormLabel>
                  <FormControl><Input {...field} type="number" min={1} max={31} data-testid="input-due-day" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="layer" render={({ field }) => (
                <FormItem>
                  <FormLabel>TrueBuild Layer (1-7)</FormLabel>
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
                  <div className="flex gap-2 flex-wrap">
                    {CARD_COLORS.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        className={`w-8 h-8 rounded-full transition-transform ${field.value === c.value ? "scale-125 ring-2 ring-offset-2 ring-foreground" : ""}`}
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
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-card">
              {mutation.isPending ? "Adding..." : "Add Card"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function LogActivityDialog({ card, onLogged }: { card: Card; onLogged: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"spend" | "payment">("spend");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (data: object) => apiRequest("POST", "/api/activity", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scores"] });
      setOpen(false);
      setAmount("");
      setMerchant("");
      onLogged();
      toast({ title: type === "payment" ? "Payment recorded" : "Spending recorded" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    mutation.mutate({
      cardId: card.id, type, amount: parseFloat(amount),
      merchant: merchant || null, note: null,
      date: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`button-log-activity-${card.id}`}>
          Log Activity
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Activity — {card.issuer} ••{card.last4}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("spend")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${type === "spend" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
              data-testid="button-type-spend"
            >
              <ArrowUpCircle className="w-4 h-4" /> Spend
            </button>
            <button
              type="button"
              onClick={() => setType("payment")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${type === "payment" ? "bg-emerald-600 text-white border-emerald-600" : "border-border text-muted-foreground hover:bg-secondary"}`}
              data-testid="button-type-payment"
            >
              <ArrowDownCircle className="w-4 h-4" /> Payment
            </button>
          </div>
          <div>
            <Label htmlFor="log-amount">Amount</Label>
            <Input
              id="log-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="mt-1"
              required
              data-testid="input-activity-amount"
            />
          </div>
          {type === "spend" && (
            <div>
              <Label htmlFor="log-merchant">Merchant (optional)</Label>
              <Input
                id="log-merchant"
                value={merchant}
                onChange={e => setMerchant(e.target.value)}
                placeholder="Amazon Business, Staples..."
                className="mt-1"
                data-testid="input-merchant"
              />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-activity">
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CardRow({ card, onDeleted }: { card: Card; onDeleted: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const util = card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0;
  const onGoal = util <= card.usageGoalPct;

  const { data: cardActivity = [] } = useQuery<Activity[]>({
    queryKey: ["/api/activity", card.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/activity?cardId=${card.id}`);
      return res.json();
    },
    enabled: expanded,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/cards/${card.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scores"] });
      onDeleted();
    },
  });

  return (
    <UICard className="overflow-hidden" data-testid={`wallet-card-${card.id}`}>
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-4">
          {/* Mini card preview */}
          <div
            className="w-12 h-8 rounded-md shrink-0 flex items-center justify-center text-white text-xs font-bold"
            style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}aa)` }}
          >
            {card.issuer.slice(0,2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate">{card.name}</p>
              <Badge variant="outline" className="text-xs shrink-0">Layer {card.layer}</Badge>
              <Badge
                variant={onGoal ? "default" : "destructive"}
                className={`text-xs shrink-0 ${onGoal ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" : ""}`}
              >
                {onGoal ? "On Goal" : "Over Goal"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              ••••{card.last4} · ${card.currentBalance.toLocaleString()} / ${card.creditLimit.toLocaleString()} · Due day {card.dueDay}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Progress value={Math.min(util, 100)} className="h-1 flex-1" />
              <span className="text-xs font-semibold shrink-0" style={{ color: utilColor(util, card.usageGoalPct) }}>
                {util.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <LogActivityDialog card={card} onLogged={() => {}} />
            <button
              onClick={() => deleteMutation.mutate()}
              className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
              data-testid={`button-delete-card-${card.id}`}
              aria-label="Delete card"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              data-testid={`button-expand-card-${card.id}`}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded activity log */}
        {expanded && (
          <div className="border-t border-border px-4 pb-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-3 mb-2">Recent Activity</p>
            {cardActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">No activity logged yet</p>
            ) : (
              <div className="space-y-1.5">
                {cardActivity.slice(0, 10).map(a => (
                  <div key={a.id} className="flex items-center justify-between text-sm" data-testid={`activity-row-${a.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {a.type === "payment"
                        ? <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        : <ArrowUpCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                      <span className="truncate text-muted-foreground">{a.merchant || a.note || a.type}</span>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <span className={`font-medium ${a.type === "payment" ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                        {a.type === "payment" ? "-" : "+"}${a.amount.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground block">{format(new Date(a.date), "MMM d")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </UICard>
  );
}

export default function Wallet() {
  const { data: cards = [], isLoading } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const { toast } = useToast();

  const totalCredit = cards.reduce((s, c) => s + c.creditLimit, 0);
  const totalBalance = cards.reduce((s, c) => s + c.currentBalance, 0);
  const totalAvailable = totalCredit - totalBalance;

  // Group by layer
  const byLayer = cards.reduce((acc, card) => {
    if (!acc[card.layer]) acc[card.layer] = [];
    acc[card.layer].push(card);
    return acc;
  }, {} as Record<number, Card[]>);

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-8 bg-secondary rounded w-32" />
        <div className="space-y-3">
          {[0,1,2].map(i => <div key={i} className="h-20 bg-secondary rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Wallet</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {cards.length} cards · ${totalCredit.toLocaleString()} total credit
          </p>
        </div>
        <AddCardDialog onAdded={() => {}} />
      </div>

      {/* Summary strip */}
      {cards.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <UICard>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Credit</p>
              <p className="text-lg font-bold">${totalCredit.toLocaleString()}</p>
            </CardContent>
          </UICard>
          <UICard>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
              <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">${totalBalance.toLocaleString()}</p>
            </CardContent>
          </UICard>
          <UICard>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Available</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${totalAvailable.toLocaleString()}</p>
            </CardContent>
          </UICard>
        </div>
      )}

      {/* Cards list by layer */}
      {cards.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No cards yet. Add your first card to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byLayer).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([layer, layerCards]) => (
            <div key={layer}>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Layer {layer}
                </span>
              </div>
              <div className="space-y-2">
                {layerCards.map(card => (
                  <CardRow key={card.id} card={card} onDeleted={() => {
                    toast({ title: "Card removed" });
                  }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
