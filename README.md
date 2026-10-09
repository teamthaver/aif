# AIF Platform

Alternative investment fund administration on **Next.js 15 (App Router), Server Actions, shadcn/ui, Tailwind CSS v4, MySQL (`mysql2`) and JWT cookies**.

```
System admin  ->  Organization  ->  Organization users
                                    org admin · fund manager · compliance manager · auditor · investor
```

## Run it

```bash
# 1. a database (MySQL 8.0.16+)
mysql -uroot -p -e "CREATE DATABASE aif_platform CHARACTER SET utf8mb4;
  CREATE USER 'aif'@'localhost' IDENTIFIED BY 'YourStrongPassword1';
  CREATE USER 'aif'@'%'         IDENTIFIED BY 'YourStrongPassword1';
  GRANT ALL ON aif_platform.* TO 'aif'@'localhost'; GRANT ALL ON aif_platform.* TO 'aif'@'%';"

# 2. the app
cp .env.example .env.local      # set DATABASE_URL, SESSION_SECRET, DATA_ENCRYPTION_KEY, SYSTEM_ADMIN_*
npm install
npm run db:migrate              # tables + audit triggers
npm run db:seed                 # the first system admin  (db:seed:demo also adds a sample organization)
npm run dev                     # http://localhost:3000
npm test                        # integration tests. WIPES the database in DATABASE_URL: use a throwaway one
```
Use a **new database** (`aif_platform`). This schema is different from the earlier `aif_admin` project.
Generate the two secrets with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` (SESSION_SECRET) and `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` (DATA_ENCRYPTION_KEY).
`db/aif_platform_mysql.sql` is the same schema as one file, if you prefer to import it with the mysql client.

## Who can do what

| | System admin | Org admin | Fund manager | Compliance | Auditor | Investor |
|---|---|---|---|---|---|---|
| Panel | `/system` | `/admin` | `/manager` | `/compliance` | `/auditor` | `/investor` |
| Signs in at | `/system/login` | `/login` (shared) | `/login` | `/login` | `/login` | `/login` |
| Create organizations (a name + the first org admin) | yes | | | | | |
| Set the organization's **type** and registration number | no | **yes (own organization)** | | | | |
| Create users | org admins only | **any role, including fund managers** | **investors only** | | | |
| Suspend / reactivate users | org admins | any org user | investors | | | |
| View funds, investors, KYC, audit | **no** (never sees them) | **everything** | funds, investors, KYC | funds, investors, KYC, audit | funds, investors, audit | own only |
| Create / edit funds | | **no (view only)** | **yes** | | | |
| Assign and maintain investors in funds | | | **yes** | | | |
| Verify or reject investor KYC | | | **yes** | **yes** | | |
| Open KYC documents and full PAN / bank number | | yes | yes | yes | **masked, no documents** | own |

**Admins create fund managers. Fund managers create funds and investors, and never admins or other fund managers.**

**The organization's type (AIF manager, Fund administrator, Trustee, Custodian) is chosen by the organization itself**, in its Organization page, not by the system admin who creates it. A new organization shows "Not set yet" until its org admin picks one, and the org admin is reminded on their overview.

The whole table lives in one place: `lib/rbac.ts` (see `CREATABLE_ROLES`). Change a role there and every page and action follows.

## Signing in

- **Two pages only.** Everyone except the system admin uses the shared `/login`. The system admin has a page of their own at `/system/login` (it is not linked from the shared page). Credentials for one cannot be used on the other, and the error is the same as a wrong password, so nothing reveals which page an account belongs to.
- **Password, then a one-time code.** After the password is accepted a random 6-digit code is sent to the person's email. Only then is a session issued.
- **The code is never fixed.** It comes from `crypto.randomInt`, is stored only as a keyed hash (HMAC) and is single use. There is no `123456` anywhere, and a test greps the sign-in code to keep it that way.
- **3 attempts, in total.** Three wrong codes lock that sign-in for good: even the right code is then refused and the person starts again from the password. A resend does not reset the count.
- **5 minutes**, then the code expires. A code can be re-sent after 30 seconds, at most twice. Starting a new sign-in replaces the old one.
- **Rate limits:** 5 wrong passwords per email and 20 per IP per 15 minutes; at most 5 codes requested for one account per 15 minutes (so nobody can flood a victim's inbox).
- **After sign-in the role is read from the database** and the person is sent to their own panel (`HOME` in `lib/rbac.ts`).

### The session
| | |
|---|---|
| Lifetime | **8 hours from sign-in**, a hard stop that activity does not extend (`SESSION_TTL_HOURS`) |
| Storage | `aif_session`: httpOnly, SameSite=Lax, `Secure` in production. The sign-in step uses a separate short-lived `aif_otp` cookie |
| Claims | `sub` (user id), `iss`, `aud`, `jti` (unique id), `iat`, `exp`, `sv` (token version), `role`, `org` |
| Not trusted | `role` and `org` are a tripwire, not the source of truth: every request re-reads them from MySQL and the token is rejected if they differ, so changing someone's role ends their old session at once |
| Revoking | suspend the person or organization, or bump `users.token_version` to sign someone out everywhere |
| When it ends | pages redirect to the right login page with a "session has ended" notice (`/system/login` for the system admin, `/login` for everyone else); a Server Action returns `UNAUTHENTICATED` and the page sends the person to sign in |

## The investor journey (KYC)
1. A fund manager or org admin creates the investor. They get a one-time invite link and set a password.
2. They sign in (password, then code). **The first sign-in lands on the KYC page. Nothing else in the investor panel opens**, and every investor action except KYC returns `KYC_REQUIRED` until verification passes.
3. The investor completes personal details, address, financial profile, PEP/FATCA declarations and bank account, uploads 4 documents (PAN card, address proof, bank proof, photograph) and signs a declaration.
4. On submit the system runs automatic checks (PAN format and individual type, age 18+, IFSC, duplicate PAN in the organization, bank-holder name vs PAN name, PEP and US-person flags) and shows them to the reviewer.
5. A fund manager **or** compliance manager reviews the documents, ticks a 5-point checklist, then verifies or sends it back with a reason. The investor fixes it and resubmits; every decision is kept in history.
6. While `submitted` or `verified`, the investor cannot edit anything. Only **verified** investors can be assigned to a fund, and only then can they confirm commitments.

What is protected: PAN and bank account numbers are encrypted (AES-256-GCM), only the last 4 digits are readable in SQL, a keyed hash blocks duplicate PANs, the full Aadhaar number is never collected, uploaded files are validated by their actual bytes (PDF/JPG/PNG, 3 MB), and every time someone other than the owner opens a document it is written to the audit log.

> **Important:** there is no live identity-provider integration. The automatic checks are format and consistency checks, and a human reviewer is the real control. `lib/kyc/provider.ts` is the interface to plug in PAN verification, CKYC lookup, penny-drop bank checks or Aadhaar e-KYC. Until then those checks show as "skipped".

## Shared logic = a shared action with role validation

When two places need the same thing, there is **one action** and the roles allowed to call it are decided by the `authorize()` line inside it. There is no separate "data" layer.

| Shared action | Roles allowed (from `lib/rbac.ts`) | Used by |
|---|---|---|
| `listFundsAction`, `getFundAction` | org admin, fund manager, compliance, auditor (`funds:view`) | 4 panels |
| `listInvestorsAction` | org admin, fund manager, compliance, auditor (`investors:view`) | 4 panels |
| `getInvestorKycAction` | the same four (`kyc:view`). It returns the **full** record to roles with `kyc:documents` and a **masked** one to the auditor | 4 panels |
| `listAuditAction` | system admin, org admin, compliance, auditor (`audit:view`). The system admin sees all organizations, the others only their own | 4 panels + "Load more" in the browser |
| `orgStatsAction` | org admin, fund manager, compliance, auditor | 4 overviews |
| `listUsersAction` | system admin (names an organization), org admin, fund manager (investors only) | 3 panels |
| `listOrgsAction`, `getOrgAction`, `platformStatsAction` | system admin (org admin: own organization only) | system panel |
| `listAssignableInvestorsAction` | fund manager only (`assignments:manage`) | fund page |
| `getOwnKycAction`, `listMyFundsAction`, `investorSummaryAction` | investor only (the last two need verified KYC) | investor panel |

Server pages call these through `pageData(...)`, which turns a failed read into the right redirect (session ended -> login, suspended -> notice, wrong role -> own panel, unverified investor -> KYC, not found or malformed id -> 404).

> **Anything exported from a `'use server'` file is a public endpoint**, so shared logic only becomes a shared action when it is a real operation or read that carries its own role check. Internal helpers that must never be callable from the browser stay plain, unexported functions: `createInvite` (`lib/invites.ts`, used by the organization and user actions and the seed script), `authorize`, `runAction` and the notification senders. Helpers used by two actions in the *same* file (such as the KYC profile mapper) are private to that file. A test fails if a `'use server'` file exports anything other than async functions.

## Architecture (the rules you asked for)

| Rule | Where it is applied |
|---|---|
| Static data on the server page | Every `page.tsx` is a server component that guards, reads by calling a shared read action (e.g. `listFundsAction`) through `pageData`, and renders. No page is marked `'use client'`. |
| Interactivity in `/components` | Dialogs, forms, buttons and the KYC form are small client components in `components/*` that receive data as props. |
| Server Actions in `/lib/actions` | One `'use server'` file per area. **Each action holds its own logic**: it starts with `authorize(...)`, then validates its input, runs its queries and audit entry, and returns the result. There is no services layer between an action and the database. |
| Each role route has its own layout with a session check | `app/system`, `admin`, `manager`, `compliance`, `auditor`, `investor` each have a `layout.tsx` calling `requireRole(...)`. The investor panel has a nested `(verified)` layout that enforces KYC. |
| Types in `/utils/types` | `utils/types/*.ts`, exported from `utils/types/index.ts`. |
| JWT + cookies for sessions | `lib/auth/jwt.ts` (jose, HS256) and `lib/auth/session.ts` (httpOnly, SameSite=Lax, Secure in production cookie). |
| Session and user validated every time | See below. |
| Theme | Your `:root` tokens in `app/globals.css`, mapped to Tailwind v4 with `@theme inline`. `components.json` is included so `npx shadcn add` works. |

```
app/                 routes: (auth), session/end, system, admin, manager, compliance, auditor, investor
components/          ui/ (shadcn) | admin, system, investor (components only that role uses, plus its sidebar.tsx nav)
                     funds, kyc, audit, users, layout, shared, auth (used by several roles)
                     SearchComponent.tsx, paginationComponent.tsx (URL-driven ?search= and ?page=)
lib/actions/         'use server' Server Actions with their logic inline, including the shared reads (auth, organizations, users, funds, kyc, audit, stats)
lib/sessionCheck.ts  page guards: requireRole, requirePage, pageData, redirectIfSignedIn
lib/auth/            jwt, session cookie, authorize() for actions, core checks against the database
utils/db/            mysqlPool.ts (the pool and query helpers)
utils/types/         shared types          lib/validators/   Zod schemas
lib/kyc/             KYC rules + provider  lib/rbac.ts       roles and permissions
db/migrations/       schema                db/triggers.sql   append-only audit
```

List pages (users, funds, investors) read `?page`, `?limit` and `?search` from the URL, pass them to the shared list action, and render the page with `SearchComponent` and `Pagination`. The action validates the values and does the paging in SQL.

When a session is rejected, pages redirect through `/session/end`, which deletes the stale cookie and then lands on the login page. Without that, a cookie with a valid signature that the database rejects could loop forever.

### How every request is validated
The cookie carries only `{ user id, token version }`. On **every page render and every Server Action** the app re-reads the person and their organization from MySQL: the account must exist and be active, the token version must match, the organization must be active, and the role comes from the database, never from the token. Then the role, the permission and (for investors) KYC status are checked, then the input is validated with Zod, then the handler runs. Suspending a person or an organization takes effect on their very next click even though their cookie is still a valid JWT.

Every action begins with the same line, so the check is visible where the logic is:

```ts
export async function createFundAction(input: z.input<typeof createFundSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ need: 'funds:create' });   // session + role + permission, from the database
    const b = createFundSchema.parse(input);                 // then the input
    ...queries and audit, written right here...
    return { id };
  });
}
```

`runAction` only turns a thrown error into `{ ok: false, error, code }` and refreshes the pages; it holds no business logic. A test fails the build if any exported action does not call `authorize()` before its first query, other than the public sign-in actions (login, system login, verify code, resend code, accept invite, log out). `middleware.ts` is only a quick first gate for the cookie; it is never trusted for access.

## Before production
- **HTTPS** (the cookie is `Secure` in production) and a real `SESSION_SECRET` / `DATA_ENCRYPTION_KEY` from a secrets manager. Losing the encryption key makes stored PAN and bank numbers unreadable: back it up.
- **Invite emails and sign-in codes:** both are delivered from `lib/notify.ts`. Replace `notifyInvite` and fill in `providerSender` with your email/SMS provider. Outside production the invite link is also shown in the UI (a toast); in production it is withheld.
- **Audit triggers:** `npm run db:migrate` warns if MySQL refuses them (needs TRIGGER, and SUPER or `log_bin_trust_function_creators=1` when binary logging is on). The app still works and the hash chain still detects tampering, but the database will not block edits.
- **Sign-in codes need a delivery provider.** With `OTP_DELIVERY=console` the code is printed in the server log: fine for development, never for production (a warning is logged). In production with no provider configured, sign-in fails safely instead of falling back. Implement `providerSender` in `lib/notify.ts`.
- **KYC provider** (see above) and **forgot password** (not built). The email OTP is a second factor, not an authenticator app; add TOTP or passkeys if your policy needs a stronger one.
- Documents are stored in MySQL (up to 3 MB each). For larger volumes move them to encrypted object storage.
- Sign-in throttling uses `x-forwarded-for`: make your proxy set it and strip client-supplied values.
- MySQL has no row-level security. Isolation lives in the service layer (every query filters by the organization in the validated session), and it is covered by tests; keep them in CI.
- Have your compliance counsel review the KYC flow, retention periods and the DPDP Act obligations before go-live.

## Tests
`npm test`: 26 integration tests against MySQL that call the **real Server Actions in-process** (only Next's cookie and header plumbing is stubbed) (hierarchy, creation matrix, isolation, KYC end to end, document visibility, fund rules, session re-validation, one-time codes and the 3-attempt lock, separate login portals, token claims, audit chain, a test that every shared read allows exactly the roles it should, paging and search, the session-end cookie clearing, and the guard test that no action can skip the session check).


## Code style
Lines are kept to about 100 characters, one statement per line, with SQL written one clause per line. `.prettierrc` holds the settings and `npm run format` re-applies them. Comments sit on their own line above the code they explain.
