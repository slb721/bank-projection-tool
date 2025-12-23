# Bank Cash Projections

Scenario-based cash runway dashboard powered by Next.js 13 (app router), Tailwind, Recharts, and Supabase with RLS.

## Setup
1) Install dependencies
```bash
npm install
```

2) Configure environment
Create `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```
RLS is already enforced in Supabase; the client uses the anon key and the active session for auth.

3) Run locally
```bash
npm run dev
```
Visit http://localhost:3000.

## Supabase tables used
- `profiles`: user identity (id = auth.uid()).
- `scenarios`: named projection sets per user.
- `accounts`: starting balances per scenario.
- `paychecks`: recurring income streams.
- `credit_cards`: next dues and typical cycle amounts.
- `life_events`: recurring/one-off expenses or income.

## Projection model
The projection engine combines:
- Starting balances from `accounts`.
- Paychecks expanded by schedule (`weekly`, `biweekly`, `semimonthly`, `monthly`).
- Credit card dues (next due, then monthly average).
- Life events (income/expense, recurring or once).
It outputs a 150-day series with inflow/outflow and balance, plus lowest/ending balance.

## Deploy to Vercel
1) Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel project env vars.
2) Deploy via Vercel (git or CLI). No serverless functions required.

## Notes
- If you sign out, the dashboard will prompt to sign back in.
- All CRUD operations are scoped to the selected scenario and the signed-in user; RLS policies are respected automatically.
