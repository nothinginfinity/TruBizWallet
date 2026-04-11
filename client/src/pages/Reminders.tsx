import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertReminderSchema, type Reminder, type Card, type InsertReminder } from "@shared/schema";
import { z } from "zod";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Bell, CheckCircle2, Circle, Trash2, CreditCard,
  Calendar, DollarSign, RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const REMINDER_TYPES = [
  { value: "payment", label: "Payment Due", color: "bg-red-500/10 text-red-700 dark:text-red-400" },
  { value: "spend", label: "Spend Goal", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  { value: "reporting", label: "Bureau Reporting", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  { value: "custom", label: "Custom", color: "bg-secondary text-muted-foreground" },
];

const formSchema = insertReminderSchema.extend({
  amount: z.coerce.number().optional().nullable(),
  dueDay: z.coerce.number().min(1).max(31).optional().nullable(),
}).omit({ createdAt: true, completedAt: true, completed: true });

type FormData = z.infer<typeof formSchema>;

function typeStyle(type: string) {
  return REMINDER_TYPES.find(t => t.value === type)?.color || "bg-secondary text-muted-foreground";
}
function typeLabel(type: string) {
  return REMINDER_TYPES.find(t => t.value === type)?.label || type;
}

function getDaysUntil(dueDay: number | null | undefined): number | null {
  if (!dueDay) return null;
  const today = new Date();
  const day = today.getDate();
  if (dueDay >= day) return dueDay - day;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return (daysInMonth - day) + dueDay;
}

function urgencyColor(days: number | null): string {
  if (days === null) return "";
  if (days <= 2) return "border-red-500/40 bg-red-50/50 dark:bg-red-950/20";
  if (days <= 5) return "border-yellow-500/40 bg-yellow-50/50 dark:bg-yellow-950/20";
  return "";
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
    mutation.mutate({
      ...data,
      completed: false,
      createdAt: new Date().toISOString(),
    } as InsertReminder);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-add-reminder">
          <Plus className="w-4 h-4 mr-2" /> Add Reminder
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Reminder</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
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
                  <Input {...field} placeholder="Pay Chase balance in full..." data-testid="input-reminder-title" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="cardId" render={({ field }) => (
              <FormItem>
                <FormLabel>Card (optional)</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === "none" ? null : parseInt(v))}
                  defaultValue={field.value ? String(field.value) : "none"}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-reminder-card"><SelectValue placeholder="All cards / Global" /></SelectTrigger>
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
                  <FormLabel>Due Day of Month</FormLabel>
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
              <FormItem className="flex items-center justify-between">
                <div>
                  <FormLabel>Recurring monthly</FormLabel>
                  <p className="text-xs text-muted-foreground">Repeats every month</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-recurring" />
                </FormControl>
              </FormItem>
            )} />

            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-reminder">
              {mutation.isPending ? "Saving..." : "Add Reminder"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ReminderItem({ reminder, cardName }: { reminder: Reminder; cardName?: string }) {
  const daysUntil = getDaysUntil(reminder.dueDay);
  const { toast } = useToast();

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/reminders/${reminder.id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/upcoming"] });
      toast({ title: "Marked complete ✓" });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
    },
  });

  return (
    <UICard
      className={`overflow-hidden transition-all ${urgencyColor(daysUntil)} ${reminder.completed ? "opacity-60" : ""}`}
      data-testid={`reminder-item-${reminder.id}`}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <button
          onClick={() => reminder.completed ? resetMutation.mutate() : completeMutation.mutate()}
          className="shrink-0"
          data-testid={`button-complete-${reminder.id}`}
        >
          {reminder.completed
            ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            : <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-medium ${reminder.completed ? "line-through text-muted-foreground" : ""}`}>
              {reminder.title}
            </p>
            <Badge className={`text-xs ${typeStyle(reminder.type)}`}>
              {typeLabel(reminder.type)}
            </Badge>
            {reminder.recurring && (
              <Badge variant="outline" className="text-xs gap-1">
                <RefreshCw className="w-2.5 h-2.5" /> Monthly
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {cardName && (
              <span className="flex items-center gap-1">
                <CreditCard className="w-3 h-3" /> {cardName}
              </span>
            )}
            {reminder.dueDay && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Day {reminder.dueDay}
                {daysUntil !== null && (
                  <span className={daysUntil <= 2 ? "text-red-500 font-semibold" : daysUntil <= 5 ? "text-yellow-600 dark:text-yellow-400 font-semibold" : ""}>
                    ({daysUntil === 0 ? "today!" : `${daysUntil}d away`})
                  </span>
                )}
              </span>
            )}
            {reminder.amount && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> ${reminder.amount.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => deleteMutation.mutate()}
          className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
          data-testid={`button-delete-reminder-${reminder.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </CardContent>
    </UICard>
  );
}

export default function Reminders() {
  const { data: reminders = [], isLoading } = useQuery<Reminder[]>({
    queryKey: ["/api/reminders"],
  });

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
  });

  const cardMap = Object.fromEntries(cards.map(c => [c.id, c.name]));
  const pending = reminders.filter(r => !r.completed);
  const completed = reminders.filter(r => r.completed);

  // Sort pending by urgency (lowest daysUntil first)
  const sortedPending = [...pending].sort((a, b) => {
    const da = getDaysUntil(a.dueDay) ?? 99;
    const db = getDaysUntil(b.dueDay) ?? 99;
    return da - db;
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-8 bg-secondary rounded w-36" />
        <div className="space-y-3">
          {[0,1,2,3].map(i => <div key={i} className="h-16 bg-secondary rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[800px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Reminders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pending.length} pending · {completed.length} completed
          </p>
        </div>
        <AddReminderDialog cards={cards} />
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending {pending.length > 0 && <Badge className="ml-2 text-xs">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6 space-y-2">
          {sortedPending.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No pending reminders. Great job staying on top of things!</p>
              <p className="text-xs mt-1">Add reminders to track payments and spending goals.</p>
            </div>
          ) : (
            sortedPending.map(r => (
              <ReminderItem key={r.id} reminder={r} cardName={r.cardId ? cardMap[r.cardId] : undefined} />
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6 space-y-2">
          {completed.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No completed reminders yet.
            </div>
          ) : (
            completed.map(r => (
              <ReminderItem key={r.id} reminder={r} cardName={r.cardId ? cardMap[r.cardId] : undefined} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
