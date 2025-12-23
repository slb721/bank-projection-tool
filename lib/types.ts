export type Scenario = {
  id: string;
  user_id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type Account = {
  id: string;
  user_id: string | null;
  scenario_id: string | null;
  current_balance: number;
  updated_at?: string | null;
  created_at?: string | null;
};

export type Paycheck = {
  id: string;
  user_id: string | null;
  scenario_id: string | null;
  name?: string | null;
  amount: number;
  schedule: string;
  next_date: string;
  updated_at?: string | null;
  created_at?: string | null;
};

export type CreditCard = {
  id: string;
  user_id: string | null;
  scenario_id: string | null;
  name: string;
  next_due_date: string;
  next_due_amount: number;
  avg_future_amount: number;
  updated_at?: string | null;
  created_at?: string | null;
};

export type LifeEvent = {
  id: string;
  user_id: string;
  scenario_id: string | null;
  related_paycheck_id?: string | null;
  type: string;
  label: string;
  amount: number;
  start_date: string;
  end_date?: string | null;
  recurrence: string;
  created_at?: string | null;
};

export type Profile = {
  id: string;
  email: string;
  created_at?: string | null;
};

