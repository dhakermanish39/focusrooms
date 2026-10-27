# FocusRooms — React + Supabase

Live co-study rooms: shared pomodoro timer, realtime chat and presence ("who is here").

**Supabase features used:** Auth (email/password), Postgres + Row Level Security, Realtime (postgres_changes + Presence).

## Setup
1. supabase.com par naya project banao.
2. SQL Editor me `supabase/schema.sql` run karo.
3. `cp .env.example .env` aur URL + anon key daalo (Project Settings > API).
4. Authentication > Providers > Email me "Confirm email" off kar do (testing ke liye).
5. `npm install` then `npm run dev`

## Flow
Sign up > create room > dusre users same room join karein > owner Start session dabaye > timer sabke screen par sync chalta hai.

## Ideas to extend
Study streaks, leaderboard, room passwords, Google login, deploy on Vercel.
