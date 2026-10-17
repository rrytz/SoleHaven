# Authenticated browser testing — order-query consistency fixes

## What is automated vs. what needs a browser session

| | coverage | needs | writes to the DB? |
|---|---|---|---|
| `npm test` (`run.cjs`) | the order-query state machine and the structural invariants behind the `4a3c94c` fixes — warm-cache refetch, failed refetch, cold cache, genuine not-found, gate ordering, invalidation placement | nothing: Node only | **no** |
| this document (S1–S5) | the same fixes end to end in a real browser, including the account dashboard after a real checkout | an authorized session | **S5 does** — see §3 S5 |

The two suites overlap on purpose: `run.cjs` is fast, hermetic and CI-shaped; the
scenarios below confirm the wiring that only a signed-in browser exercises. **A green
`npm test` is not evidence that S1–S5 were run.**

Nothing here has been executed yet: there is no authorized session, and no credentials
are stored in this repository. See "Blockers" at the end.

---

## 0. Which account

Read-only check of the target project, counts only (identifiers deliberately not
recorded here, since this repository is public):

| confirmed | auth orders | last order |
|---|---|---|
| yes | **13** | 2026-10-03 |
| yes | 0 | never |

There are two auth accounts and **exactly one owns orders** — the 13-order account above.
Scenarios 3–5 must be run as that account; signing in with the zero-order account cannot
exercise the order pages at all.

To re-derive which one it is without recording it, query `auth.users` joined to a count
of `public.orders` per `user_id`, and keep the result out of version control:

```sql
select u.id,
       (select count(*) from public.orders o where o.user_id = u.id) as orders
  from auth.users u
 order by orders desc;
```

Pick the row where `orders` is non-zero.

## 1. Getting a session (no credential exposure)

Preferred, and the only option that needs no database write:

> **The operator signs in manually** at `http://127.0.0.1:8096/login` in the shared
> browser tab, then says so. The session lands in `localStorage` under
> `sb-<project-ref>-auth-token`, `StoreProvider` hydrates `user` via `getUser()`
> (`src/lib/store.tsx:17`), and the agent proceeds from there. The password never
> enters the transcript.

Rejected alternatives:

- **Handing the password to the agent** — works, but the secret is then present in tool
  calls and logs. Avoid.
- **Creating a user with the service-role key** — that writes to `auth.users`. Out of
  bounds without explicit approval, and unnecessary given the option above.
- **Resetting the password** — explicitly prohibited.

Session plumbing, for reference: the client persists to `localStorage`
(`src/integrations/supabase/client.ts`, `persistSession: true`); `getMyOrders` is a
server function behind `requireSupabaseAuth`
(`src/integrations/supabase/auth-middleware.ts`), which requires a real `Bearer` JWT and
calls `getClaims`. There is no way to fake this client-side — which is good.

---

## 2. Why the network is not the bottleneck

The build uses `staleTime: 0` and a bare `new QueryClient()` (`src/router.tsx:6`), so:

- cached data is **always** stale (`query.js:214 isStaleByTime(staleTime = 0)`);
- `refetchOnMount` fires even when data exists (`queryObserver.js:434`);
- **every window refocus refetches** (`query.js:221` → `queryCache.onFocus()`).

Consequences for the plan:

- A cached `['my-orders', userId]` is refetched constantly, so the race window reopens
  on every focus change. That is how scenarios 3 and 4 are triggered without writing.
- There is no network-throttling or request-blocking tool available in this harness, so
  the window is widened with a **runtime-only** `fetch` patch (below). It changes nothing
  on disk and vanishes on reload.

---

## 3. Scenario-by-scenario

### S1 — Sign in, and S2 — warm the cache

Operator signs in (above). Then:

```
GET /account          # mounts useQuery(['my-orders', userId]) and populates the cache
```

Assertions: `/account` renders "My account" with a non-zero **Orders** tile and a
"Recent orders" list. That proves the session works and the key is warm.

### S3 — an existing order never flashes `ORDER NOT FOUND`

**Feasibility caveat, and it matters.** With a warm cache that *already contains* the
order, the old `isLoading` gate would have rendered the order correctly — the filter
finds it, so there is nothing to get wrong. The defect only appears when the cached list
**predates** the order, i.e. the post-checkout window. So "visit an existing order with a
warm cache" is not by itself a regression test for this bug.

Two ways to reach the real condition:

- **(a) After S5.** The freshly placed order is not in the cache yet. This is the honest
  end-to-end test. Requires approval.
- **(b) Seed a deliberately stale cache at runtime.** Requires a handle on the
  `QueryClient`, which the router puts in its context but does **not** expose on
  `window`. Reachability is unproven, so treat (b) as a fallback, not a plan.

If only a weak version is wanted: with a warm cache, trigger a refetch (below) while on
`/orders/<id>` and confirm the page never shows `ORDER NOT FOUND` *during* the fetch.
That is a valid smoke test, but it would also have passed pre-fix, so it must not be
reported as covering the defect.

### S4 — order-query failure shows the retryable error state

Reachable read-only. On `/orders` or `/orders/<id>` the only server function is
`getMyOrders`, so patching every `/_serverFn/` request is precise enough.

Install the patch, then trigger a refetch by dispatching `focus`:

```js
(() => {
  if (window.__solehavenProbe) return 'already installed';
  const real = window.fetch;
  window.__solehavenProbe = { mode: 'fail' };
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.includes('/_serverFn/') && window.__solehavenProbe.mode === 'fail') {
      throw new TypeError('Failed to fetch');
    }
    return real(input, init);
  };
  window.__solehavenProbeRestore = () => { window.fetch = real; };
  return 'installed';
})();
```

```js
window.dispatchEvent(new Event('focus'));   // triggers refetchOnWindowFocus
```

Assertions: heading **"We couldn't load your orders"**, a **Try again** button, and
**no** "Order not found". Then set `window.__solehavenProbe.mode = 'pass'`, click
**Try again**, and assert the real data returns — proving the retry works.

Cleanup is mandatory: `window.__solehavenProbeRestore()`, or just reload.

### S5 — authenticated checkout refreshes the account count

**Blocked — needs approval.** Placing an order executes `place_order`, inserts a row in
`orders` and `order_items`, and **decrements `product_variants.stock`**. That is a real
write to the target project, which this task prohibits.

When approved:

1. Confirm a baseline: `orders` count, total stock, and that `orders_idempotency_uq` has
   no duplicates (read-only).
2. Add a real, cheap item to the bag and complete the five checkout steps as the
   signed-in user.
3. On the confirmation page, click through to `/account`.
4. Assert the **Orders** tile is `baseline + 1` and the new order is in **Recent orders**.
5. Re-run S3 immediately — this is the window where the cached list predates the order,
   i.e. the only real test of the `isFetching` gate.
6. Re-check the baseline to confirm exactly one order was added and stock moved by the
   expected quantity.

A note on what this cannot prove: `invalidateQueries` only marks the entry stale, and
with `staleTime: 0` it was *already* stale. So invalidation improves freshness for active
observers but does **not** prevent the one-paint stale render on a later mount. Only the
`isFetching` gate does that. `run.cjs` asserts both facts separately.

---

## 4. Blockers

1. **No authorized session.** Required before S1–S4. Resolution: operator signs in
   manually at `http://127.0.0.1:8096/login` and confirms. No credential needs to be
   shared.
2. **S5 needs explicit approval** because it writes to Supabase (order rows + stock).
3. **S3 cannot be fully satisfied without S5**, or without an unproven `QueryClient`
   handle for runtime cache seeding. Do not report a warm-cache visit as covering it.
4. Registration by email is unavailable (rate-limited, no SMTP), so a fresh disposable
   account is not currently an option.

## 5. Rules for whoever runs this

- Never print passwords, session tokens, `sb-…-auth-token` contents, order numbers,
  addresses, or emails. Mask emails; refer to counts.
- Runtime browser patches are allowed; **editing application source is not**.
- After any run, confirm `git status` is unchanged and re-check the Supabase baseline
  (`orders` count, total stock, duplicate idempotency keys = 0).