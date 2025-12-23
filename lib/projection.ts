import {
  Account,
  CreditCard,
  LifeEvent,
  Paycheck,
  Scenario,
} from './types';
import {
  addDays,
  differenceInCalendarDays,
  formatISO,
  parseISO,
} from 'date-fns';

type ProjectionInput = {
  accounts: Account[];
  paychecks: Paycheck[];
  creditCards: CreditCard[];
  lifeEvents: LifeEvent[];
  scenarios: Scenario[];
  selectedScenarioId: string | null;
  horizonDays?: number;
};

export type ProjectionPoint = {
  date: string;
  balance: number;
  inflow: number;
  outflow: number;
};

export type ProjectionResult = {
  series: ProjectionPoint[];
  lowestBalance: number;
  lowestDate: string | null;
  endingBalance: number;
};

function isIncomeLifeEvent(type: string) {
  const incomeWords = ['income', 'raise', 'bonus', 'gift', 'refund'];
  return incomeWords.some((word) => type.toLowerCase().includes(word));
}

function expandPaychecks(paychecks: Paycheck[], horizonDays: number) {
  const events: { date: string; amount: number }[] = [];
  const today = new Date();

  paychecks.forEach((p) => {
    let cursor = parseISO(p.next_date);
    const schedule = p.schedule.toLowerCase();
    const horizonDate = addDays(today, horizonDays);

    while (cursor <= horizonDate) {
      events.push({ date: formatISO(cursor, { representation: 'date' }), amount: p.amount });
      switch (schedule) {
        case 'weekly':
          cursor = addDays(cursor, 7);
          break;
        case 'biweekly':
        case 'bi-weekly':
        case 'fortnightly':
          cursor = addDays(cursor, 14);
          break;
        case 'semimonthly':
        case 'semi-monthly':
          cursor = addDays(cursor, 15);
          break;
        case 'quarterly':
          cursor = addDays(cursor, 90);
          break;
        default:
          cursor = addDays(cursor, 30);
          break;
      }
    }
  });

  return events;
}

function expandLifeEvents(events: LifeEvent[], horizonDays: number) {
  const items: { date: string; amount: number }[] = [];
  const today = new Date();
  const horizon = addDays(today, horizonDays);

  events.forEach((e) => {
    let cursor = parseISO(e.start_date);
    const end = e.end_date ? parseISO(e.end_date) : horizon;
    const recurrence = (e.recurrence || '').toLowerCase();
    const sign = isIncomeLifeEvent(e.type) ? 1 : -1;

    while (cursor <= horizon && cursor <= end) {
      items.push({
        date: formatISO(cursor, { representation: 'date' }),
        amount: sign * e.amount,
      });
      switch (recurrence) {
        case 'weekly':
          cursor = addDays(cursor, 7);
          break;
        case 'biweekly':
        case 'bi-weekly':
          cursor = addDays(cursor, 14);
          break;
        case 'monthly':
          cursor = addDays(cursor, 30);
          break;
        case 'yearly':
        case 'annually':
          cursor = addDays(cursor, 365);
          break;
        default:
          cursor = addDays(cursor, horizonDays + 1); // break loop
          break;
      }
    }
  });

  return items;
}

function expandCreditCards(cards: CreditCard[], horizonDays: number) {
  const charges: { date: string; amount: number }[] = [];
  const today = new Date();
  const horizon = addDays(today, horizonDays);

  cards.forEach((c) => {
    let cursor = parseISO(c.next_due_date);
    let first = true;
    while (cursor <= horizon) {
      charges.push({
        date: formatISO(cursor, { representation: 'date' }),
        amount: -(first ? c.next_due_amount : c.avg_future_amount),
      });
      cursor = addDays(cursor, 30);
      first = false;
    }
  });

  return charges;
}

export function buildProjection({
  accounts,
  paychecks,
  creditCards,
  lifeEvents,
  horizonDays = 120,
}: ProjectionInput): ProjectionResult {
  const startBalance = accounts.reduce(
    (sum, account) => sum + (account.current_balance || 0),
    0
  );
  const today = new Date();
  const horizon = addDays(today, horizonDays);
  const points: ProjectionPoint[] = [];

  const paycheckEvents = expandPaychecks(paychecks, horizonDays);
  const lifeEventEntries = expandLifeEvents(lifeEvents, horizonDays);
  const cardCharges = expandCreditCards(creditCards, horizonDays);

  let balance = startBalance;
  let lowestBalance = startBalance;
  let lowestDate: string | null = formatISO(today, { representation: 'date' });

  for (
    let cursor = today;
    differenceInCalendarDays(horizon, cursor) >= 0;
    cursor = addDays(cursor, 1)
  ) {
    const dateKey = formatISO(cursor, { representation: 'date' });
    const inflow =
      paycheckEvents
        .filter((p) => p.date === dateKey)
        .reduce((s, p) => s + p.amount, 0) +
      lifeEventEntries
        .filter((e) => e.date === dateKey && e.amount > 0)
        .reduce((s, e) => s + e.amount, 0);

    const outflow =
      cardCharges
        .filter((c) => c.date === dateKey)
        .reduce((s, c) => s + Math.abs(c.amount), 0) +
      lifeEventEntries
        .filter((e) => e.date === dateKey && e.amount < 0)
        .reduce((s, e) => s + Math.abs(e.amount), 0);

    balance = balance + inflow - outflow;

    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestDate = dateKey;
    }

    points.push({
      date: dateKey,
      balance: Math.round(balance * 100) / 100,
      inflow,
      outflow,
    });
  }

  return {
    series: points,
    lowestBalance,
    lowestDate,
    endingBalance: balance,
  };
}

