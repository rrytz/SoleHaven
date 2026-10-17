#!/usr/bin/env node
/**
 * SoleHaven order-query regression suite.
 *
 * Dependency-free: uses only Node's stdlib plus the @tanstack/query-core build that
 * the app already depends on. No test framework is introduced.
 *
 *   node scripts/regression/run.cjs            # full suite
 *   node scripts/regression/run.cjs --no-diff  # skip the provenance section
 *
 * Exit code 0 = all checks passed, 1 = at least one failure.
 *
 * DESIGN NOTES (learned from the earlier ad-hoc harnesses)
 * ------------------------------------------------------
 * 1. Line endings. Git blobs in this repo are LF; the Windows worktree is CRLF. Any
 *    comparison that slices a physical line MUST strip a trailing "\r" first, or it
 *    reports a phantom difference. `logicalLine()` / `norm()` below are the only
 *    sanctioned primitives for this.
 * 2. Do not assert by reconstructing the expected source text. That approach has to
 *    guess the exact new code, the comment style and the apostrophe character, so it
 *    broke repeatedly. Source checks here are structural: presence, counts, and
 *    *ordering* (index comparisons), which survive comment and whitespace churn.
 * 3. Behavioural checks drive the real QueryObserver. Those are the durable ones and
 *    are the reason this suite will not rot the way string-matching did.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const COMMIT_WITH_FIXES = '4a3c94cad8caeb576d6c54bb73fc7908192a255f';
const BASE_FOR_PROVENANCE = '924a143'; // parent of COMMIT_WITH_FIXES

const AP = 'src/components/store/AccountPages.tsx';
const CC = 'src/components/store/CartCheckout.tsx';
const OID = 'src/routes/orders.$id.tsx';
const CONF = 'src/routes/order-confirmation.$id.tsx';

let pass = 0;
const failures = [];
let section = '';

const head = (s) => console.log('\n\x1b[1m' + s + '\x1b[0m');
function group(s) { section = s; head(s); }
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  \x1b[32mPASS\x1b[0m  ' + name); }
  else {
    failures.push(section + ' :: ' + name + (detail ? '  [' + detail + ']' : ''));
    console.log('  \x1b[31mFAIL\x1b[0m  ' + name + (detail ? '\n        ' + detail : ''));
  }
}

// ---------------------------------------------------------------- primitives
const readWork = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const readBlob = (rev, rel) =>
  execSync('git show ' + rev + ':' + rel, { cwd: REPO, encoding: 'utf8', maxBuffer: 64e8 });

/** Strip a trailing CR so a physical line compares equal across LF/CRLF. */
const logicalLine = (src, needle) => {
  const l = src.split('\n').find((x) => x.includes(needle));
  return l === undefined ? null : l.replace(/\r$/, '');
};
const norm = (s) => s.replace(/\r\n/g, '\n');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n\r]*/g, '');

/** Longest common prefix/suffix -> the single changed span. */
function span(before, after) {
  let p = 0;
  while (p < before.length && p < after.length && before[p] === after[p]) p++;
  let s = 0;
  while (s < before.length - p && s < after.length - p &&
         before[before.length - 1 - s] === after[after.length - 1 - s]) s++;
  return { removed: before.slice(p, before.length - s), added: after.slice(p, after.length - s) };
}

const idx = (hay, needle, from = 0) => hay.indexOf(needle, from);

// ================================================================ 1. BEHAVIOUR
function behaviourSection() {
  group('1. BEHAVIOUR - real @tanstack/query-core state machine');
  const {
    QueryClient, QueryObserver,
  } = require(path.join(REPO, 'node_modules', '@tanstack', 'query-core', 'build', 'modern', 'index.cjs'));

  const KEY = ['my-orders', 'user-1'];
  const BEFORE = [{ id: 'order-A' }];
  const AFTER = [{ id: 'order-A' }, { id: 'order-B' }];
  const TARGET = 'order-B'; // requested but absent from the cached list

  const tick = () => new Promise((r) => setImmediate(r));
  const mk = () => {
    const pending = [];
    const qc = new QueryClient(); // same bare defaults as src/router.tsx
    return { qc, pending, opts: { queryKey: KEY, enabled: true, queryFn: () => new Promise((res, rej) => pending.push({ res, rej })) } };
  };

  // Exact translation of the OrdersPage branch order in AccountPages.tsx.
  const renderOrdersPage = (r, id) => {
    if (r.isFetching) return 'LOADING';
    if (r.isError) return 'ERROR';
    const orders = id ? r.data?.filter((o) => o.id === id) : r.data;
    return !orders?.length ? 'ORDER NOT FOUND' : 'ORDER DETAILS';
  };
  // The pre-4a3c94c version, kept so the suite proves the bug it guards is real.
  const renderOrdersPageLegacy = (r, id) => {
    if (r.isLoading) return 'LOADING';
    const orders = id ? r.data?.filter((o) => o.id === id) : r.data;
    return !orders?.length ? 'ORDER NOT FOUND' : 'ORDER DETAILS';
  };

  return (async () => {
    // --- warm cache, background refetch, order absent from cache
    {
      const { qc, pending, opts } = mk();
      const w = new QueryObserver(qc, opts); const u1 = w.subscribe(() => {});
      await tick(); pending.shift().res(BEFORE); await tick(); await tick();
      const n = new QueryObserver(qc, opts); const u2 = n.subscribe(() => {});
      await tick(); await tick();
      const r = n.getCurrentResult();
      check('precondition: stale data present AND a refetch is in flight',
        r.data !== undefined && r.isFetching === true && r.isLoading === false,
        'hasData=' + (r.data !== undefined) + ' isFetching=' + r.isFetching + ' isLoading=' + r.isLoading);
      check('warm cache + background refetch does NOT yield a not-found verdict',
        renderOrdersPage(r, TARGET) === 'LOADING', renderOrdersPage(r, TARGET));
      check('the legacy isLoading gate DID yield a false not-found (test is meaningful)',
        renderOrdersPageLegacy(r, TARGET) === 'ORDER NOT FOUND', renderOrdersPageLegacy(r, TARGET));
      pending.shift().res(AFTER); await tick(); await tick(); await tick();
      check('once the refetch resolves, the real order renders',
        renderOrdersPage(n.getCurrentResult(), TARGET) === 'ORDER DETAILS');
      u1(); u2();
    }

    // --- cold cache
    {
      const { qc, pending, opts } = mk();
      const o = new QueryObserver(qc, opts); const u = o.subscribe(() => {});
      await tick();
      check('cold cache shows loading', renderOrdersPage(o.getCurrentResult(), TARGET) === 'LOADING');
      pending.shift().res(AFTER); await tick(); await tick(); await tick();
      check('cold cache resolves to the order', renderOrdersPage(o.getCurrentResult(), TARGET) === 'ORDER DETAILS');
      u();
    }

    // --- refetch failure over warm cache
    {
      const { qc, pending, opts } = mk();
      const w = new QueryObserver(qc, opts); const u1 = w.subscribe(() => {});
      await tick(); pending.shift().res(BEFORE); await tick(); await tick();
      const n = new QueryObserver(qc, opts); const u2 = n.subscribe(() => {});
      await tick(); await tick();
      pending.shift().rej(new Error('network down')); await tick(); await tick(); await tick();
      const r = n.getCurrentResult();
      check('failed refetch yields the retryable ERROR state, never a not-found verdict',
        renderOrdersPage(r, TARGET) === 'ERROR', renderOrdersPage(r, TARGET) + ' isError=' + r.isError);
      check('legacy gate would have claimed not-found on failure (test is meaningful)',
        renderOrdersPageLegacy(r, TARGET) === 'ORDER NOT FOUND');
      u1(); u2();
    }

    // --- genuine not-found must still work
    {
      const { qc, pending, opts } = mk();
      const o = new QueryObserver(qc, opts); const u = o.subscribe(() => {});
      await tick(); pending.shift().res(BEFORE); await tick(); await tick(); await tick();
      check('settled + genuinely absent still reports not found',
        renderOrdersPage(o.getCurrentResult(), TARGET) === 'ORDER NOT FOUND');
      check('settled list view renders the list',
        renderOrdersPage(o.getCurrentResult(), undefined) === 'ORDER DETAILS');
      u();
    }

    // --- confirmation route gate, and why invalidation is complementary not sufficient
    {
      const { qc, pending, opts } = mk();
      const w = new QueryObserver(qc, opts); const u1 = w.subscribe(() => {});
      await tick(); pending.shift().res(BEFORE); await tick(); await tick();
      const n = new QueryObserver(qc, opts); const u2 = n.subscribe(() => {});
      await tick(); await tick();
      const r = n.getCurrentResult();
      const confVerdict = (rr) =>
        rr.data?.some((o) => o.id === TARGET) ? 'RECEIPT' : rr.isFetching ? 'LOADING' : rr.isError ? 'ERROR' : 'ORDER NOT FOUND';
      check('confirmation route waits out the refetch (isFetching gate)',
        confVerdict(r) === 'LOADING', confVerdict(r));
      pending.shift().res(AFTER); await tick(); await tick(); await tick();
      check('confirmation route then shows the receipt', confVerdict(n.getCurrentResult()) === 'RECEIPT');
      u1(); u2();
    }
    {
      const { qc, pending, opts } = mk();
      const w = new QueryObserver(qc, opts); const u1 = w.subscribe(() => {});
      await tick(); pending.shift().res(BEFORE); await tick(); await tick();
      const before = w.getCurrentResult().isStale;
      qc.invalidateQueries({ queryKey: ['my-orders'] });
      await tick();
      check('invalidateQueries marks the entry stale, but with staleTime=0 it was already stale',
        before === true, 'isStale ' + before + ' -> ' + w.getCurrentResult().isStale);
      console.log('        (documented: invalidation alone cannot prevent the one-paint stale');
      console.log('         render on a later mount - only the isFetching gate does that)');
      u1();
    }
  })();
}

// ================================================================ 2. STRUCTURE
function structureSection() {
  group('2. STRUCTURE - stable source invariants (comment/line-ending tolerant)');
  const ap = readWork(AP);
  const cc = readWork(CC);
  const oid = readWork(OID);
  const conf = readWork(CONF);

  const ordersPage = logicalLine(ap, 'export function OrdersPage');
  check('OrdersPage located', ordersPage !== null);

  // ordering is the real invariant; exact text is not
  const iAuth = idx(ordersPage, 'if(authReady&&!user)');
  const iFetch = idx(ordersPage, 'if(query.isFetching)');
  const iErr = idx(ordersPage, 'if(query.isError)');
  const iOrders = idx(ordersPage, 'const orders=id?');
  const iNotFound = idx(ordersPage, "'Order not found'");
  check('signed-out (authReady) check is first', iAuth === 0 || (iAuth > -1 && iAuth < iFetch), 'authReady@' + iAuth);
  check('authReady + user still destructured from the store',
    /const \{user,authReady\}=useStore\(\);/.test(ordersPage));
  check('signed-out early return still returns before any query branch',
    iAuth > -1 && iAuth < iFetch);
  check('loading gate is on isFetching', iFetch > -1);
  check('the legacy isLoading gate is gone', !/if\(query\.isLoading\)/.test(ordersPage));
  check('error branch sits between the loading gate and the verdict',
    iFetch > -1 && iErr > iFetch && iOrders > iErr, 'isFetching@' + iFetch + ' isError@' + iErr + ' verdict@' + iOrders);
  check('error branch offers a retry via refetch', /if\(query\.isError\)[\s\S]{0,400}query\.refetch\(\)/.test(ordersPage));
  check('error branch is not reachable before the query has been attempted',
    iErr > iFetch);
  check('genuine not-found verdict still exists after the refetch settles', iNotFound > iOrders);
  check('query key / fn / enabled unchanged',
    /queryKey:\['my-orders',user\?\.id\],queryFn:\(\)=>getMyOrders\(\),enabled:!!user/.test(ordersPage));
  check('empty-list branch preserved', /!orders\?\.length\?/.test(ordersPage));
  check('order list rendering preserved', /orders\.map\(o=><article className="order-record"/.test(ordersPage));
  check('statuses constant intact',
    logicalLine(ap, 'const statuses=') ===
      "const statuses=['Order Placed','Payment Confirmed','Processing','Packed','Shipped','Out for Delivery','Delivered'];");
  for (const sym of ['export function AuthPage', 'export function WishlistPage', 'export function AccountPage']) {
    check(sym.replace('export function ', '') + ' still present', idx(ap, sym) > -1);
  }
  check('signOut busy guard preserved', /if\(signingOut\)return;/.test(logicalLine(ap, 'const signOut=')));
  check('signOut failure still surfaces via toast', /toast\.error\('Signed out on this device/.test(logicalLine(ap, 'const signOut=')));

  // ---- checkout
  const submit = logicalLine(cc, 'const submit=async');
  check('submit() located', submit !== null);
  const nInv = (cc.match(/invalidateQueries/g) || []).length;
  check('exactly one invalidateQueries call in CartCheckout.tsx', nInv === 1, 'count=' + nInv);
  check('useQueryClient imported', /import \{ useSuspenseQuery, useQueryClient \} from '@tanstack\/react-query'/.test(cc));
  check('query client created exactly once', (cc.match(/const qc=useQueryClient\(\);/g) || []).length === 1);
  check('query client only created in CheckoutPage, not CartPage',
    idx(cc, 'const qc=useQueryClient();') > idx(cc, 'export function CheckoutPage'));
  const iGuest = idx(submit, 'guestPlaceOrder(');
  const iGuestRet = idx(submit, '}catch(e){const msg=e instanceof Error', iGuest);
  const iAuthCall = idx(submit, 'await placeOrder(');
  const iInv = idx(submit, 'invalidateQueries');
  check('invalidation is after the authenticated placeOrder resolves', iInv > iAuthCall,
    'placeOrder@' + iAuthCall + ' invalidate@' + iInv);
  check('invalidation is after the guest branch early-returns', iInv > iGuestRet);
  check('no invalidation inside the guest branch',
    submit.slice(iGuest, iAuthCall).indexOf('invalidateQueries') === -1);
  check('payload still carries the idempotency key',
    /idempotencyKey:submissionKey\(\)/.test(submit));
  check('payload keys otherwise unchanged',
    /const payload=\{\.\.\.customer,address,delivery,payment,idempotencyKey:submissionKey\(\),items:/.test(submit));
  check('idempotency key still memoised in a ref across retries',
    /const submissionKey=\(\)=>\{if\(!idemRef\.current\)\{/.test(cc));
  check('idempotency ref cleared on guest success',
    /JSON\.stringify\(receipt\)\)\}catch\{\}idemRef\.current=null/.test(submit));
  check('idempotency ref cleared on authenticated success',
    /invalidateQueries\(\{queryKey:\['my-orders'\]\}\);idemRef\.current=null/.test(submit));
  check('guest receipt still written to localStorage',
    /localStorage\.setItem\('sh-last-guest-order',JSON\.stringify\(receipt\)\)/.test(submit));
  check('guest still navigates using receipt.id', /params:\{id:receipt\.id\}/.test(submit));
  check('authenticated still navigates using the returned id',
    /navigate\(\{to:'\/order-confirmation\/\$id',params:\{id\}\}\)\}/.test(submit));
  check('cart still cleared', /clearCart\(\)/.test(submit));
  check('success toast preserved', /toast\.success\('Order placed'\)/.test(submit));
  check('guest error copy preserved',
    /Guest checkout is not available yet\. Please sign in to place your order\./.test(submit));
  check('orderMessage error mapper preserved',
    /const orderMessage=\(e:unknown\)=>\{/.test(cc) && /return 'We could not place your order\. Please try again\.'/.test(cc));

  // ---- order detail metadata
  check('order-detail title is neutral', /title:'Order status — Solehaven'/.test(oid));
  check('order-detail og:title is neutral', /property:'og:title',content:'Order status — Solehaven'/.test(oid));
  check('order-detail description is neutral',
    /name:'description',content:'Check the status of your Solehaven order\.'/.test(oid));
  check('order-detail og:description is neutral',
    /property:'og:description',content:'Check the status of your Solehaven order\.'/.test(oid));
  check('the old implying metadata is gone',
    !/Track your Solehaven order/.test(oid) && !/Order details — Solehaven/.test(oid));
  check('og:type and twitter:card untouched',
    /property:'og:type',content:'website'\},\{name:'twitter:card',content:'summary_large_image'/.test(oid));
  check('route component wiring untouched',
    /component:\(\)=>\{const \{id\}=Route\.useParams\(\);return <OrdersPage id=\{id\}\/>\}\}\);/.test(oid.trim()));

  // ---- confirmation route (earlier fix, still guarded)
  check('confirmation route still gates on isFetching',
    /if\(!authReady\|\|\(\!\!\!user&&query\.isFetching\)\)/.test(conf) ||
    /query\.isFetching\)/.test(conf));
  check('confirmation route has no isLoading gate', !/query\.isLoading\)/.test(conf));
  check('no false success copy anywhere in src',
    !fs.readdirSync(path.join(REPO, 'src'), { recursive: true })
      .filter((f) => /\.(ts|tsx)$/.test(String(f)))
      .some((f) => /ORDER CONFIRMED/.test(readWork(path.join('src', String(f))))));
}

// ================================================================ 3. PROVENANCE
function provenanceSection() {
  group('3. PROVENANCE - exact edit shape vs ' + BASE_FOR_PROVENANCE);
  // NOTE: do not use "<rev>^{commit}" here. execSync goes through cmd.exe on Windows,
  // where "^" is the escape character, so the rev gets silently mangled.
  let baseOk = false;
  try {
    baseOk = execSync('git cat-file -t ' + BASE_FOR_PROVENANCE, { cwd: REPO, encoding: 'utf8' }).trim() === 'commit';
  } catch (e) { baseOk = false; }
  if (!baseOk) {
    console.log('  \x1b[33mSKIP\x1b[0m  base commit ' + BASE_FOR_PROVENANCE + ' not present; '
      + 'run with --no-diff on a shallow clone');
    return;
  }
  const files = execSync('git diff --name-only ' + BASE_FOR_PROVENANCE + ' ' + COMMIT_WITH_FIXES,
    { cwd: REPO, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  check('exactly three files changed by the fix commit',
    files.length === 3 && files.sort().join(',') === [AP, CC, OID].sort().join(','),
    files.join(', '));

  // AccountPages: the single changed span, comment-stripped
  {
    const d = span(
      logicalLine(readBlob(BASE_FOR_PROVENANCE, AP), 'export function OrdersPage'),
      logicalLine(readWork(AP), 'export function OrdersPage'));
    // The common suffix starts at "</div>;const orders=...", so `removed` ends at
    // "Loading orders..." and `added` ends at "Try again</Button>". The trailing
    // "</div>" of each gate is shared text, so it is not part of either span.
    const OLD = 'if(query.isLoading)return <div className="container-wide page-space">Loading orders...';
    const NEW = 'if(query.isFetching)return <div className="container-wide page-space">Loading orders...</div>;'
      + 'if(query.isError)return <div className="container-wide empty-state"><Package size={36}/>'
      + '<h2>We couldn’t load your orders</h2><p>Please try again in a moment.</p>'
      + '<Button onClick={()=>void query.refetch()}>Try again</Button>';
    check('OrdersPage removed exactly the old isLoading gate',
      d.removed === OLD, 'removed=' + JSON.stringify(d.removed) + ' (' + d.removed.length + ' chars)');
    check('OrdersPage added exactly the new gate + error branch (comments aside)',
      stripComments(d.added) === NEW, 'added=' + stripComments(d.added).length + ' chars');
  }

  // CartCheckout submit: insert-only
  {
    const d = span(
      logicalLine(readBlob(BASE_FOR_PROVENANCE, CC), 'const submit=async'),
      logicalLine(readWork(CC), 'const submit=async'));
    check('submit() removed zero characters', d.removed === '', 'removed=' + JSON.stringify(d.removed));
    check('submit() added only a comment plus the invalidation',
      /^(\/\*[\s\S]*?\*\/)?qc\.invalidateQueries\(\{queryKey:\['my-orders'\]\}\);$/.test(d.added.trim()),
      'added=' + d.added.length + ' chars');
  }

  // order detail: only the four metadata strings
  {
    const restored = readWork(OID)
      .replace(/Order status — Solehaven/g, 'Order details — Solehaven')
      .replace(/Check the status of your Solehaven order\./g, 'Track your Solehaven order.');
    check('orders.$id.tsx differs from base only in the four metadata strings',
      norm(restored) === norm(readBlob(BASE_FOR_PROVENANCE, OID)));
  }

  // The three files under test must be exactly as committed. This catches a
  // half-applied edit (e.g. a mutation-test run that failed to restore) and is
  // independent of whatever else is uncommitted in the tree.
  for (const f of [AP, CC, OID, CONF]) {
    let clean = true;
    try {
      execSync('git diff --quiet HEAD -- "' + f + '"', { cwd: REPO, stdio: 'ignore' });
    } catch (e) { clean = false; }
    check(f + ' matches its committed content', clean);
  }
}

// ================================================================ main
(async () => {
  const skipDiff = process.argv.includes('--no-diff');
  console.log('\x1b[1mSoleHaven order-query regression suite\x1b[0m');
  console.log('repo: ' + REPO);
  console.log('HEAD: ' + execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim());

  await behaviourSection();
  structureSection();
  if (!skipDiff) provenanceSection();

  head('RESULT');
  console.log('  ' + pass + ' passed, ' + failures.length + ' failed');
  if (failures.length) {
    console.log('');
    for (const f of failures) console.log('  \x1b[31m- ' + f + '\x1b[0m');
    process.exitCode = 1;
  } else {
    console.log('  \x1b[32mall checks passed\x1b[0m');
  }
})().catch((e) => { console.error('SUITE ERROR:', e); process.exitCode = 1; });