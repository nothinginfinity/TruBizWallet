import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertReminderSchema, type Reminder, type Card, type InsertReminder } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Bell, CheckCircle2, Trash2, RefreshCw, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const REMINDER_TYPES = [
  { value: "payment",   label: "Payment Due",       dot: "#f87171" },
  { value: "spend",     label: "Spend Goal",         dot: "#60a5fa" },
  { value: "reporting", label: "Bureau Reporting",   dot: "#c084fc" },
  { value: "custom",    label: "Custom",             dot: "#94a3b8" },
];

const formSchema = insertReminderSchema.extend({
  amount: z.coerce.number().optional().nullable(),
  dueDay: z.coerce.number().min(1).max(31).optional().nullable(),
}).omit({ createdAt: true, completedAt: true, completed: true });

type FormData = z.infer<typeof formSchema>;

function getDaysUntil(dueDay: number | null | undefined): number | null {
  if (!dueDay) return null;
  const today = new Date();
  const day = today.getDate();
  if (dueDay >= day) return dueDay - day;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return (daysInMonth - day) + dueDay;
}

function typeInfo(type: string) {
  return REMINDER_TYPES.find(t => t.value === type) || REMINDER_TYPES[3];
}

function urgencyBadge(days: number | null) {
  if (days === null) return null;
  if (days === 0) return { label: "Today!", color: "#f87171" };
  if (days <= 2) return { label: `${days}d`, color: "#f87171" };
  if (days <= 5) return { label: `${days}d`, color: "#fbbf24" };
  return { label: `${days}d`, color: "#34d399" };
}

function AddReminderDialog({ cards }: { cards: Card[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cardId: null, type: "payment", title: "",
      dueDay: null, dueDate: null, amount: null, recurring: true,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: InsertReminder) => apiRequest("POST", "/api/reminders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/upcoming"] });
      setOpen(false);
      form.reset();
      toast({ title: "Reminder added" });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate({ ...data, completed: false, createdAt: new Date().toISOString() } as InsertReminder);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30"
          data-testid="button-add-reminder"
          aria-label="Add reminder"
        >
          <Plus className="w-5 h-5 text-primary-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-[#0f0f18] border border-white/10">
        <DialogHeader>
          <DialogTitle>New Reminder</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-1">
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-reminder-type"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {REMINDER_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Pay Chase balance in full…" data-testid="input-reminder-title" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="cardId" render={({ field }) => (
              <FormItem>
                <FormLabel>Card (optional)</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === "none" ? null : parseInt(v))}
                  defaultValue="none"
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-reminder-card"><SelectValue placeholder="All cards" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Global (all cards)</SelectItem>
                    {cards.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name} ••{c.last4}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="dueDay" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Day</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min={1} max={31}
                      value={field.value ?? ""}
                      onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="15"
                      data-testid="input-reminder-due-day"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ($)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      value={field.value ?? ""}
                      onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="0.00"
                      data-testid="input-reminder-amount"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="recurring" render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-xl bg-white/4 px-4 py-3">
                <div>
                  <FormLabel className="text-sm font-medium">Recurring monthly</FormLabel>
                  <p className="text-xs text-white/35">Repeats every month</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-recurring" />
                </FormControl>
              </FormItem>
            )} />

            <Button type="submit" className="w-full rounded-xl" disabled={mutation.isPending} data-testid="button-submit-reminder">
              {mutation.isPending ? "Saving…" : "Add Reminder"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ReminderRow({ reminder, cardName }: { reminder: Reminder; cardName?: string }) {
  const daysUntil = getDaysUntil(reminder.dueDay);
  const badge = urgencyBadge(daysUntil);
  const info = typeInfo(reminder.type);
  const { toast } = useToast();

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/reminders/${reminder.id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/upcoming"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/reminders/${reminder.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/upcoming"] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/reminders/${reminder.id}`, { completed: false, completedAt: null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/reminders"] }),
  });

  return (
    <div
      className={`ios-list-row gap-3 ${reminder.completed ? "opacity-50" : ""}`}
      data-testid={`reminder-item-${reminder.id}`}
    >
      {/* Type dot */}
      <div className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: info.dot }} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${reminder.completed ? "line-through text-white/30" : ""}`}>
          {reminder.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] text-white/35">{info.label}</span>
          {cardName && <span className="text-[10px] text-white/35">· {cardName}</span>}
          {reminder.recurring && (
            <span className="flex items-center gap-0.5 text-[10px] text-white/30">
              <RefreshCw className="w-2.5 h-2.5" /> Monthly
            </span>
          )}
          {reminder.dueDay && (
            <span className="text-[10px] text-white/35">· Day {reminder.dueDay}</span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0">
        {badge && !reminder.completed && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: badge.color, background: `${badge.color}20` }}>
            {badge.label}
          </span>
        )}
        {reminder.amount && (
          <span className="text-xs font-semibold text-primary">${Number(reminder.amount).toLocaleString()}</span>
        )}

        {/* Complete / reset */}
        <button
          onClick={() => reminder.completed ? resetMutation.mutate() : completeMutation.mutate()}
          className="w-6 h-6 rounded-full flex items-center justify-center"
          data-testid={`button-complete-${reminder.id}`}
          style={{ background: reminder.completed ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.06)" }}
        >
          {reminder.completed
            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            : <div className="w-3.5 h-3.5 rounded-full border-2 border-white/25" />}
        </button>

        {/* Delete */}
        <button
          onClick={() => deleteMutation.mutate()}
          className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center"
          data-testid={`button-delete-reminder-${reminder.id}`}
        >
          <Trash2 className="w-3 h-3 text-red-400" />
        </button>
      </div>
    </div>
  );
}

export default function Reminders() {
  const [tab, setTab] = useState<"pending" | "completed">("pending");

  const { data: reminders = [], isLoading } = useQuery<Reminder[]>({
    queryKey: ["/api/reminders"],
  });

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
  });

  const cardMap = Object.fromEntries(cards.map(c => [c.id, c.name]));
  const pending = reminders.filter(r => !r.completed);
  const completed = reminders.filter(r => r.completed);

  const sortedPending = [...pending].sort((a, b) => {
    const da = getDaysUntil(a.dueDay) ?? 99;
    const db = getDaysUntil(b.dueDay) ?? 99;
    return da - db;
  });

  if (isLoading) {
    return (
      <div className="page-content px-4 pt-14 space-y-3">
        <div className="skeleton h-6 w-32" />
        {[0,1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-2xl" />)}
      </div>
    );
  }

  const shownList = tab === "pending" ? sortedPending : completed;

  return (
    <div className="page-content px-4">
      {/* Header */}
      <div className="pt-14 pb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Reminders</h1>
          <p className="text-xs text-white/40 mt-0.5">
            {pending.length} pending · {completed.length} done
          </p>
        </div>
        <AddReminderDialog cards={cards} />
      </div>

      {/* Segment control (iOS style) */}
      <div className="flex gap-1 bg-white/6 rounded-[12px] p-1 mb-5">
        {(["pending", "completed"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-[9px] text-sm font-medium capitalize transition-all ${
              tab === t ? "bg-white/12 text-white shadow-sm" : "text-white/40"
            }`}
            data-testid={`tab-${t}`}
          >
            {t === "pending" ? `Pending ${pending.length > 0 ? `(${pending.length})` : ""}` : "Completed"}
          </button>
        ))}
      </div>

      {/* List */}
      {shownList.length === 0 ? (
        <div className="glass-panel p-10 flex flex-col items-center text-center gap-3">
          <Bell className="w-10 h-10 text-white/15" />
          <p className="text-sm text-white/30">
            {tab === "pending" ? "No pending reminders — you're on top of it" : "No completed reminders yet"}
          </p>
        </div>
      ) : (
        <div className="ios-list">
          {shownList.map(r => (
            <ReminderRow key={r.id} reminder={r} cardName={r.cardId ? cardMap[r.cardId] : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
