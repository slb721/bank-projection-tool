'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BoltIcon,
  PlusIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { getSupabaseClient } from '../lib/supabaseClient';
import { buildProjection, ProjectionPoint } from '../lib/projection';
import {
  Account,
  CreditCard,
  LifeEvent,
  Paycheck,
  Profile,
  Scenario,
} from '../lib/types';

const supabase = getSupabaseClient();

type FormState<T> = T & { submitting?: boolean; error?: string | null };

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paychecks, setPaychecks] = useState<Paycheck[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  // Simple email magic-link login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginSending, setLoginSending] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [scenarioForm, setScenarioForm] = useState<FormState<{ name: string }>>({
    name: '',
    submitting: false,
    error: null,
  });
  const [paycheckForm, setPaycheckForm] = useState<FormState<Omit<Paycheck, 'id' | 'user_id' | 'scenario_id'>>>({
    name: '',
    amount: 2500,
    schedule: 'biweekly',
    next_date: new Date().toISOString().slice(0, 10),
    updated_at: undefined,
    created_at: undefined,
    submitting: false,
    error: null,
  });
  const [accountForm, setAccountForm] = useState<FormState<Omit<Account, 'id' | 'user_id' | 'scenario_id'>>>({
    current_balance: 15000,
    created_at: undefined,
    updated_at: undefined,
    submitting: false,
    error: null,
  });
  const [cardForm, setCardForm] = useState<FormState<Omit<CreditCard, 'id' | 'user_id' | 'scenario_id'>>>({
    name: 'Primary Card',
    next_due_date: new Date().toISOString().slice(0, 10),
    next_due_amount: 500,
    avg_future_amount: 450,
    created_at: undefined,
    updated_at: undefined,
    submitting: false,
    error: null,
  });
  const [eventForm, setEventForm] = useState<
    FormState<Omit<LifeEvent, 'id' | 'user_id' | 'scenario_id'>>
  >({
    type: 'expense',
    label: 'Rent',
    amount: 1800,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: null,
    recurrence: 'monthly',
    created_at: undefined,
    related_paycheck_id: null,
    submitting: false,
    error: null,
  });

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginMessage(null);

    if (!loginEmail) {
      setLoginError('Please enter your email.');
      return;
    }

    setLoginSending(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    setLoginSending(false);

    if (error) {
      setLoginError(error.message);
    } else {
      setLoginMessage(
        'Magic link sent. Check your email and open the link on this device to continue.'
      );
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      await loadProfiles(user.id);
      await loadScenarios(user.id);
      setLoading(false);
    };
    bootstrap();
  }, []);

  useEffect(() => {
    if (userId && selectedScenarioId) {
      loadScenarioData(userId, selectedScenarioId);
    }
  }, [userId, selectedScenarioId]);

  const loadProfiles = async (uid: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid);
    if (!error && data) setProfiles(data as Profile[]);
  };

  const loadScenarios = async (uid: string) => {
    const { data, error } = await supabase
      .from('scenarios')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: true });

    if (error) {
      setStatus(error.message);
      return;
    }

    if (data && data.length > 0) {
      setScenarios(data as Scenario[]);
      setSelectedScenarioId(data[0].id);
    } else {
      // Auto-create a starter scenario for first-time users
      const { data: created, error: createError } = await supabase
        .from('scenarios')
        .insert({ name: 'Personal', user_id: uid })
        .select()
        .single();
      if (createError || !created) {
        setStatus(createError?.message ?? 'Unable to create starter scenario');
        return;
      }
      setScenarios([created as Scenario]);
      setSelectedScenarioId(created.id);
    }
  };

  const loadScenarioData = async (uid: string, scenarioId: string) => {
    setDataLoading(true);
    const [accountsRes, paychecksRes, cardsRes, eventsRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', uid).eq('scenario_id', scenarioId),
      supabase.from('paychecks').select('*').eq('user_id', uid).eq('scenario_id', scenarioId),
      supabase.from('credit_cards').select('*').eq('user_id', uid).eq('scenario_id', scenarioId),
      supabase.from('life_events').select('*').eq('user_id', uid).eq('scenario_id', scenarioId),
    ]);

    if (accountsRes.data) setAccounts(accountsRes.data as Account[]);
    if (paychecksRes.data) setPaychecks(paychecksRes.data as Paycheck[]);
    if (cardsRes.data) setCreditCards(cardsRes.data as CreditCard[]);
    if (eventsRes.data) setLifeEvents(eventsRes.data as LifeEvent[]);

    const error =
      accountsRes.error || paychecksRes.error || cardsRes.error || eventsRes.error;
    if (error) setStatus(error.message);
    setDataLoading(false);
  };

  const projection = useMemo(() => {
    return buildProjection({
      accounts,
      paychecks,
      creditCards,
      lifeEvents,
      scenarios,
      selectedScenarioId,
      horizonDays: 150,
    });
  }, [accounts, paychecks, creditCards, lifeEvents, scenarios, selectedScenarioId]);

  const handleCreateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setScenarioForm((s) => ({ ...s, submitting: true, error: null }));
    const { data, error } = await supabase
      .from('scenarios')
      .insert({ name: scenarioForm.name || 'New Scenario', user_id: userId })
      .select()
      .single();
    if (error || !data) {
      setScenarioForm((s) => ({ ...s, submitting: false, error: error?.message || 'Error' }));
      return;
    }
    const next = [...scenarios, data as Scenario];
    setScenarios(next);
    setSelectedScenarioId(data.id);
    setScenarioForm({ name: '', submitting: false, error: null });
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !selectedScenarioId) return;
    setAccountForm((f) => ({ ...f, submitting: true, error: null }));
    const { error } = await supabase.from('accounts').insert({
      ...accountForm,
      user_id: userId,
      scenario_id: selectedScenarioId,
    });
    if (error) {
      setAccountForm((f) => ({ ...f, submitting: false, error: error.message }));
      return;
    }
    setAccountForm((f) => ({ ...f, submitting: false, error: null }));
    loadScenarioData(userId, selectedScenarioId);
  };

  const handleCreatePaycheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !selectedScenarioId) return;
    setPaycheckForm((f) => ({ ...f, submitting: true, error: null }));
    const { error } = await supabase.from('paychecks').insert({
      ...paycheckForm,
      user_id: userId,
      scenario_id: selectedScenarioId,
    });
    if (error) {
      setPaycheckForm((f) => ({ ...f, submitting: false, error: error.message }));
      return;
    }
    setPaycheckForm((f) => ({ ...f, submitting: false, error: null }));
    loadScenarioData(userId, selectedScenarioId);
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !selectedScenarioId) return;
    setCardForm((f) => ({ ...f, submitting: true, error: null }));
    const { error } = await supabase.from('credit_cards').insert({
      ...cardForm,
      user_id: userId,
      scenario_id: selectedScenarioId,
    });
    if (error) {
      setCardForm((f) => ({ ...f, submitting: false, error: error.message }));
      return;
    }
    setCardForm((f) => ({ ...f, submitting: false, error: null }));
    loadScenarioData(userId, selectedScenarioId);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !selectedScenarioId) return;
    setEventForm((f) => ({ ...f, submitting: true, error: null }));
    const { error } = await supabase.from('life_events').insert({
      ...eventForm,
      user_id: userId,
      scenario_id: selectedScenarioId,
    });
    if (error) {
      setEventForm((f) => ({ ...f, submitting: false, error: error.message }));
      return;
    }
    setEventForm((f) => ({ ...f, submitting: false, error: null }));
    loadScenarioData(userId, selectedScenarioId);
  };

  const handleDelete = async (table: string, id: string) => {
    if (!userId || !selectedScenarioId) return;
    await supabase.from(table).delete().eq('id', id).eq('user_id', userId);
    loadScenarioData(userId, selectedScenarioId);
  };

  const heroName = profiles[0]?.email?.split('@')[0] || 'There';

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-slate-200">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <ArrowPathIcon className="h-5 w-5 animate-spin" />
          Booting dashboard...
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="card max-w-md w-full p-8">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-200">
            <ShieldCheckIcon className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold mb-2 text-center">
            Sign in to use your projections
          </h1>
          <p className="text-slate-400 mb-6 text-sm text-center">
            Enter your email and we&apos;ll send you a secure magic link. Open it on this device to
            load your scenarios, accounts, paychecks, and events.
          </p>

          <form onSubmit={handleMagicLinkSignIn} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full"
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loginSending}
            >
              {loginSending ? 'Sending magic link…' : 'Send magic link'}
            </button>
          </form>

          {loginMessage && (
            <p className="mt-4 text-xs text-emerald-300 text-center">{loginMessage}</p>
          )}
          {loginError && (
            <p className="mt-4 text-xs text-amber-300 text-center">{loginError}</p>
          )}

          <div className="mt-6 flex justify-center">
            <div className="pill mx-auto w-fit text-[11px]">
              Supabase-secured • Row Level Security enforced
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 pb-24">
      <div className="mx-auto max-w-6xl space-y-10 pt-10">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="pill mb-3 w-fit">
              <BoltIcon className="h-4 w-4 text-purple-300" />
              Live cash runway
            </p>
            <h1 className="text-3xl font-semibold text-slate-50">
              Welcome back, {heroName}
            </h1>
            <p className="text-slate-400">
              Project your cash, credit cards, and life events across scenarios.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              className="btn-ghost border border-white/10"
              onClick={() => loadScenarioData(userId, selectedScenarioId!)}
            >
              <ArrowPathIcon className="h-5 w-5 mr-2" /> Refresh
            </button>
            <button className="btn-primary" onClick={() => window.scrollTo({ top: 9999, behavior: 'smooth' })}>
              <PlusIcon className="h-5 w-5 mr-2" /> Add Data
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="card p-4">
            <label className="mb-2 block">Scenario</label>
            <select
              value={selectedScenarioId ?? ''}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
              className="w-full"
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <form className="mt-4 space-y-2" onSubmit={handleCreateScenario}>
              <input
                value={scenarioForm.name}
                onChange={(e) => setScenarioForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="New scenario name"
              />
              <button className="btn-primary w-full" disabled={scenarioForm.submitting}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Create scenario
              </button>
              {scenarioForm.error && (
                <p className="text-xs text-amber-300">{scenarioForm.error}</p>
              )}
            </form>
          </div>

          <StatCard
            title="Current balance"
            value={accounts.reduce((s, a) => s + a.current_balance, 0)}
            subtitle="Sum of all accounts in scenario"
            icon={<BanknotesIcon className="h-5 w-5" />}
          />
          <StatCard
            title="Projected 30d delta"
            value={
              projection.series.length > 30
                ? projection.series[29].balance - accounts.reduce((s, a) => s + a.current_balance, 0)
                : 0
            }
            subtitle="Change over next 30 days"
            icon={<ArrowTrendingUpIcon className="h-5 w-5" />}
          />
        </section>

        <section className="card p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="section-title">
                Cash Projection
                <span className="pill text-xs">
                  {projection.series.length} days • Lowest {currency(projection.lowestBalance)}
                </span>
              </h2>
              <p className="text-slate-400 text-sm">
                Combines paychecks, credit card dues, and life events to project net cash.
              </p>
            </div>
            <div className="pill">
              <ArrowTrendingUpIcon className="h-4 w-4" />
              Ending: {currency(projection.endingBalance)}
            </div>
          </div>
          <div className="mt-6 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projection.series}>
                <defs>
                  <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => format(parseISO(d), 'MMM d')}
                  stroke="#94a3b8"
                />
                <YAxis stroke="#94a3b8" tickFormatter={currency} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine
                  y={0}
                  stroke="#475569"
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#a855f7"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#balanceFill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <DataCard
            title="Accounts"
            subtitle="Starting cash balances"
            items={accounts.map((a) => ({
              id: a.id,
              title: currency(a.current_balance),
              meta: a.scenario_id ? 'Scenario linked' : 'Unlinked',
              description: a.updated_at ? `Updated ${format(parseISO(a.updated_at), 'PP')}` : '',
            }))}
            onDelete={(id) => handleDelete('accounts', id)}
            form={
              <form className="space-y-2" onSubmit={handleCreateAccount}>
                <label>Current balance</label>
                <input
                  type="number"
                  value={accountForm.current_balance}
                  onChange={(e) =>
                    setAccountForm((f) => ({ ...f, current_balance: Number(e.target.value) }))
                  }
                />
                <button className="btn-primary w-full" disabled={accountForm.submitting}>
                  <PlusIcon className="h-4 w-4 mr-1" /> Add account
                </button>
                {accountForm.error && (
                  <p className="text-xs text-amber-300">{accountForm.error}</p>
                )}
              </form>
            }
          />

          <DataCard
            title="Paychecks"
            subtitle="Recurring income streams"
            items={paychecks.map((p) => ({
              id: p.id,
              title: `${p.name || 'Paycheck'} • ${currency(p.amount)}`,
              meta: `${p.schedule} • next ${format(parseISO(p.next_date), 'PP')}`,
              description: '',
            }))}
            onDelete={(id) => handleDelete('paychecks', id)}
            form={
              <form className="space-y-2" onSubmit={handleCreatePaycheck}>
                <label>Name</label>
                <input
                  value={paycheckForm.name ?? ''}
                  onChange={(e) =>
                    setPaycheckForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Paycheck label"
                />
                <label>Amount</label>
                <input
                  type="number"
                  value={paycheckForm.amount}
                  onChange={(e) =>
                    setPaycheckForm((f) => ({ ...f, amount: Number(e.target.value) }))
                  }
                />
                <label>Schedule</label>
                <select
                  value={paycheckForm.schedule}
                  onChange={(e) =>
                    setPaycheckForm((f) => ({ ...f, schedule: e.target.value }))
                  }
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="semimonthly">Semi-monthly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <label>Next date</label>
                <input
                  type="date"
                  value={paycheckForm.next_date}
                  onChange={(e) =>
                    setPaycheckForm((f) => ({ ...f, next_date: e.target.value }))
                  }
                />
                <button className="btn-primary w-full" disabled={paycheckForm.submitting}>
                  <PlusIcon className="h-4 w-4 mr-1" /> Add paycheck
                </button>
                {paycheckForm.error && (
                  <p className="text-xs text-amber-300">{paycheckForm.error}</p>
                )}
              </form>
            }
          />

          <DataCard
            title="Credit cards"
            subtitle="Next dues and typical cycles"
            items={creditCards.map((c) => ({
              id: c.id,
              title: `${c.name} • ${currency(c.next_due_amount)} due`,
              meta: `Next: ${format(parseISO(c.next_due_date), 'PP')} • Future avg ${currency(
                c.avg_future_amount
              )}`,
              description: '',
            }))}
            onDelete={(id) => handleDelete('credit_cards', id)}
            form={
              <form className="space-y-2" onSubmit={handleCreateCard}>
                <label>Card name</label>
                <input
                  value={cardForm.name}
                  onChange={(e) => setCardForm((f) => ({ ...f, name: e.target.value }))}
                />
                <label>Next due date</label>
                <input
                  type="date"
                  value={cardForm.next_due_date}
                  onChange={(e) =>
                    setCardForm((f) => ({ ...f, next_due_date: e.target.value }))
                  }
                />
                <label>Next due amount</label>
                <input
                  type="number"
                  value={cardForm.next_due_amount}
                  onChange={(e) =>
                    setCardForm((f) => ({ ...f, next_due_amount: Number(e.target.value) }))
                  }
                />
                <label>Avg future amount</label>
                <input
                  type="number"
                  value={cardForm.avg_future_amount}
                  onChange={(e) =>
                    setCardForm((f) => ({ ...f, avg_future_amount: Number(e.target.value) }))
                  }
                />
                <button className="btn-primary w-full" disabled={cardForm.submitting}>
                  <PlusIcon className="h-4 w-4 mr-1" /> Add card
                </button>
                {cardForm.error && <p className="text-xs text-amber-300">{cardForm.error}</p>}
              </form>
            }
          />
        </div>

        <section className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="section-title">Life events</h2>
              <p className="text-slate-400 text-sm">
                One-off or recurring expenses/income (e.g., rent, daycare, bonus).
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              {lifeEvents.length === 0 && (
                <div className="pill bg-white/10 text-slate-300">No life events yet</div>
              )}
              {lifeEvents.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{e.label}</p>
                    <p className="text-xs text-slate-400">
                      {e.type} • {currency(e.amount)} • {e.recurrence} • starts{' '}
                      {format(parseISO(e.start_date), 'PP')}
                    </p>
                  </div>
                  <button
                    className="text-xs text-slate-400 hover:text-red-300"
                    onClick={() => handleDelete('life_events', e.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <form className="space-y-3" onSubmit={handleCreateEvent}>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label>Label</label>
                  <input
                    value={eventForm.label}
                    onChange={(e) => setEventForm((f) => ({ ...f, label: e.target.value }))}
                  />
                </div>
                <div>
                  <label>Type</label>
                  <input
                    value={eventForm.type}
                    onChange={(e) => setEventForm((f) => ({ ...f, type: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label>Amount</label>
                  <input
                    type="number"
                    value={eventForm.amount}
                    onChange={(e) =>
                      setEventForm((f) => ({ ...f, amount: Number(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <label>Recurrence</label>
                  <select
                    value={eventForm.recurrence}
                    onChange={(e) =>
                      setEventForm((f) => ({ ...f, recurrence: e.target.value }))
                    }
                  >
                    <option value="once">Once</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label>Start date</label>
                  <input
                    type="date"
                    value={eventForm.start_date}
                    onChange={(e) =>
                      setEventForm((f) => ({ ...f, start_date: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label>End date (optional)</label>
                  <input
                    type="date"
                    value={eventForm.end_date ?? ''}
                    onChange={(e) =>
                      setEventForm((f) => ({ ...f, end_date: e.target.value || null }))
                    }
                  />
                </div>
              </div>
              <button className="btn-primary w-full" disabled={eventForm.submitting}>
                <PlusIcon className="h-4 w-4 mr-2" /> Add life event
              </button>
              {eventForm.error && <p className="text-xs text-amber-300">{eventForm.error}</p>}
            </form>
          </div>
        </section>

        {status && (
          <div className="card border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            {status}
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="pill bg-white/5">{icon}</div>
        <div className="text-xs uppercase tracking-wide text-slate-400">{title}</div>
      </div>
      <div className="mt-3 text-2xl font-semibold text-slate-50">{currency(value)}</div>
      <p className="text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const point: ProjectionPoint = payload[0].payload;
  return (
    <div className="glass rounded-xl p-3 text-xs">
      <p className="text-slate-200 font-semibold">{format(parseISO(label), 'PPP')}</p>
      <p className="text-slate-300">Balance: {currency(point.balance)}</p>
      <p className="text-emerald-300">Inflow: {currency(point.inflow)}</p>
      <p className="text-rose-300">Outflow: {currency(point.outflow)}</p>
    </div>
  );
}

function DataCard({
  title,
  subtitle,
  items,
  onDelete,
  form,
}: {
  title: string;
  subtitle: string;
  items: { id: string; title: string; meta?: string; description?: string }[];
  onDelete: (id: string) => void;
  form: React.ReactNode;
}) {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="section-title">{title}</h3>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-xs text-slate-500">Nothing yet.</p>}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
          >
            <div>
              <p className="text-sm text-slate-100 font-semibold">{item.title}</p>
              {item.meta && <p className="text-xs text-slate-400">{item.meta}</p>}
            </div>
            <button
              className="text-xs text-slate-400 hover:text-red-300"
              onClick={() => onDelete(item.id)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-white/5">{form}</div>
    </div>
  );
}

function currency(value: number) {
  if (Number.isNaN(value)) return '$0';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}
