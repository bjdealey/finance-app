import 'dotenv/config';
import { randomUUID, createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, closeDb } from './client';
import * as s from './schema';
import { seedCategoriesAndRules } from './defaults';
import { hashPassword } from '../auth/password';
import { loadSnapshot } from '../services/snapshot';
import { computeBalances } from '../../core/ledger';
import { detectTransfers } from '../../core/transfers';
import type { Transaction } from '../../core/types';
import { mulberry32, randInt, pick } from '../../core/prng';
import { poundsToPence as gbp } from '../../core/money';

// Deterministic demo dataset for a fictional UK user (spec §34). Financial VALUES are PRNG-driven
// so re-seeding reproduces the same patterns. Idempotent: wipes the demo user first.

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'demo12345';
const rng = mulberry32(20260824);

const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Months to generate: Jul 2025 .. Aug 2026 (13 full months + partial current month).
const MONTHS: { y: number; m: number; maxDay: number }[] = [];
for (let i = 0; i < 14; i++) {
  const y = 2025 + Math.floor((6 + i) / 12);
  const m = ((6 + i) % 12) + 1;
  MONTHS.push({ y, m, maxDay: i === 13 ? 20 : 28 });
}

type TxInsert = typeof s.transactions.$inferInsert;

async function main() {
  // 1. Reset demo user (cascade clears all children).
  await db.delete(s.users).where(eq(s.users.email, DEMO_EMAIL));

  // 2. User
  const [user] = await db
    .insert(s.users)
    .values({ name: 'Alex Demo', email: DEMO_EMAIL, passwordHash: await hashPassword(DEMO_PASSWORD) })
    .returning();
  const userId = user.id;

  // 3 + 4. Categories (hierarchical) + keyword categorisation rules — shared with new-user
  // registration via seedCategoriesAndRules, which returns a category-name -> id map.
  const catId = await seedCategoriesAndRules(userId);

  // 5. Accounts
  const accId = new Map<string, string>();
  async function addAcc(key: string, v: Omit<typeof s.accounts.$inferInsert, 'userId' | 'openingBalanceDate'> & { name: string }) {
    const [row] = await db
      .insert(s.accounts)
      .values({ ...v, userId, openingBalanceDate: '2025-06-30' })
      .returning();
    accId.set(key, row.id);
  }
  await addAcc('main', { name: 'Main Current Account', institution: 'Barclays', accountType: 'CURRENT', accessType: 'INSTANT', openingBalance: gbp(4200), purpose: 'Everyday & salary' });
  await addAcc('secondary', { name: 'Everyday Spending', institution: 'Monzo', accountType: 'CURRENT', accessType: 'INSTANT', openingBalance: gbp(500), purpose: 'Discretionary spending' });
  await addAcc('joint', { name: 'Joint Account', institution: 'NatWest', accountType: 'CURRENT', accessType: 'INSTANT', openingBalance: gbp(700), purpose: 'Shared bills' });
  await addAcc('easy', { name: 'Easy Access Saver', institution: 'Marcus', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 475, openingBalance: gbp(5200), purpose: 'General savings' });
  await addAcc('fixed', { name: 'Fixed Saver (1yr)', institution: 'Shawbrook', accountType: 'SAVINGS', accessType: 'FIXED_TERM', interestRateBps: 520, openingBalance: gbp(4000), purpose: 'Locked savings' });
  await addAcc('emergency', { name: 'Emergency Fund', institution: 'Chase', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 410, openingBalance: gbp(6000), purpose: 'Emergency reserve' });
  await addAcc('holiday', { name: 'Holiday Pot', institution: 'Monzo', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 350, openingBalance: gbp(900), purpose: 'Holiday goal' });
  await addAcc('cashisa', { name: 'Cash ISA', institution: 'Nationwide', accountType: 'CASH_ISA', accessType: 'NOTICE', interestRateBps: 490, taxWrapper: 'CASH_ISA', openingBalance: gbp(8000), purpose: 'Tax-free savings' });
  await addAcc('ssisa', { name: 'Stocks & Shares ISA', institution: 'Vanguard', accountType: 'INVESTMENT', accessType: 'RESTRICTED', taxWrapper: 'STOCKS_SHARES_ISA', openingBalance: gbp(11000), purpose: 'Long-term investing' });
  await addAcc('amex', { name: 'Amex Rewards', institution: 'American Express', accountType: 'CREDIT_CARD', accessType: 'UNKNOWN', interestRateBps: 2290, creditLimit: gbp(5000), minimumPayment: gbp(25), paymentDueDay: 15, statementDay: 1, openingBalance: gbp(-620) });
  await addAcc('barclaycard', { name: 'Barclaycard', institution: 'Barclays', accountType: 'CREDIT_CARD', accessType: 'UNKNOWN', interestRateBps: 2490, creditLimit: gbp(3000), minimumPayment: gbp(25), paymentDueDay: 20, statementDay: 5, openingBalance: gbp(-180) });
  // A car loan carried as metadata only (no payment history), so the forecast schedules its committed
  // minimum payment (source KNOWN) and the debt engine projects its payoff — engine paths a card-only
  // demo never exercised. See the KNOWN-loan branch in core/forecast.ts and debtSummary in core/debt.ts.
  await addAcc('carloan', { name: 'Car Loan', institution: 'Black Horse', accountType: 'LOAN', accessType: 'UNKNOWN', interestRateBps: 690, minimumPayment: gbp(245), paymentDueDay: 5, openingBalance: gbp(-7800) });

  // 6. Transactions
  const txns: TxInsert[] = [];
  const dedupe = (accountId: string, date: string, amount: number, desc: string) =>
    createHash('sha256').update(`${accountId}|${date}|${amount}|${desc}`).digest('hex');

  function tx(accKey: string, date: string, amountPence: number, type: s.TransactionRow['transactionType'], cat: string, merchant: string, desc?: string) {
    const accountId = accId.get(accKey)!;
    const description = desc ?? merchant;
    txns.push({
      id: randomUUID(), userId, accountId, date, amount: amountPence, currency: 'GBP', merchant, description,
      categoryId: catId.get(cat) ?? null, transactionType: type, status: 'POSTED',
      confidence: 100, source: 'SEED', dedupeKey: dedupe(accountId, date, amountPence, description),
    });
  }
  function transfer(fromKey: string, toKey: string, amountPence: number, date: string, type: s.TransactionRow['transactionType'], cat: string, desc: string) {
    const from = accId.get(fromKey)!;
    const to = accId.get(toKey)!;
    const categoryId = catId.get(cat)!;
    const leg = (accountId: string, amount: number) => ({
      id: randomUUID(), userId, accountId, date, amount, currency: 'GBP' as const, merchant: desc, description: desc,
      categoryId, status: 'POSTED' as const, confidence: 100, source: 'SEED' as const, dedupeKey: dedupe(accountId, date, amount, desc),
    });
    if (type === 'CARD_PAYMENT') {
      // Card payments stay explicitly grouped + typed: the detector skips grouped txns, and the
      // credit-card behaviour signal keys off CARD_PAYMENT.
      const group = randomUUID();
      txns.push({ ...leg(from, -amountPence), transactionType: 'CARD_PAYMENT', transferGroupId: group });
      txns.push({ ...leg(to, amountPence), transactionType: 'CARD_PAYMENT', transferGroupId: group });
    } else {
      // Genuine account-to-account transfer: emit UNTAGGED (type UNKNOWN, no group) so detectTransfers
      // has to pair the two legs on the demo, exactly as it does for imported bank data (spec §7).
      txns.push({ ...leg(from, -amountPence), transactionType: 'UNKNOWN' });
      txns.push({ ...leg(to, amountPence), transactionType: 'UNKNOWN' });
    }
  }

  const SUBS: [string, number, number][] = [ // merchant, day, £
    ['Netflix', 12, 15.99], ['Spotify', 5, 11.99], ['Disney+', 18, 7.99],
    ['Amazon Prime', 22, 8.99], ['iCloud+', 2, 2.99], ['Audible', 8, 7.99],
  ];
  const GROCERS = ['Tesco', 'Sainsburys', 'Aldi', 'Waitrose', 'Co-op'];
  const RESTAURANTS = ['Dishoom', 'Franco Manca', 'Nandos', 'Pizza Express', 'Wagamama', 'The Ivy'];

  for (const { y, m, maxDay } of MONTHS) {
    // Emit helpers that SKIP anything dated past the month's cutoff, so the final partial month
    // stops at "today" — no future-dated salary/transfers inflating current balances.
    type TT = s.TransactionRow['transactionType'];
    const T = (accKey: string, day: number, amt: number, type: TT, catName: string, merchant: string, desc?: string) => {
      if (day <= maxDay) tx(accKey, ymd(y, m, day), amt, type, catName, merchant, desc);
    };
    const X = (from: string, to: string, amt: number, day: number, type: TT, catName: string, desc: string) => {
      if (day <= maxDay) transfer(from, to, amt, ymd(y, m, day), type, catName, desc);
    };

    // Income — salary (payday 25th) with slight variation; occasional bonus.
    T('main', 25, gbp(3900 + randInt(rng, -50, 50)), 'INCOME', 'Salary', 'ACME Ltd Payroll', 'Salary');
    if (m === 12) T('main', 20, gbp(2000), 'INCOME', 'Bonus', 'ACME Ltd Bonus', 'Annual bonus');
    if (m === 3) T('main', 25, gbp(650), 'INCOME', 'Bonus', 'ACME Ltd Bonus', 'Quarterly bonus');

    // Housing
    T('main', 1, gbp(-1450), 'EXPENSE', 'Rent', 'Property Management', 'Monthly rent');
    if (m !== 2 && m !== 3) T('main', 3, gbp(-182), 'EXPENSE', 'Council Tax', 'Council Tax', 'Council tax');
    const winter = m <= 2 || m >= 11;
    T('main', 6, gbp(-(winter ? randInt(rng, 140, 175) : randInt(rng, 95, 130))), 'EXPENSE', 'Utilities', 'Octopus Energy', 'Gas & electric');
    T('main', 6, gbp(-38), 'EXPENSE', 'Water', 'Thames Water', 'Water');
    T('main', 14, gbp(-32), 'EXPENSE', 'Broadband', 'BT Broadband', 'Broadband');

    // Subscriptions + gym (run from the everyday spending account)
    for (const [name, day, amt] of SUBS) T('secondary', day, gbp(-amt), 'EXPENSE', 'Subscriptions', name, name);
    T('secondary', 3, gbp(-45), 'EXPENSE', 'Gym', 'PureGym', 'Gym membership');

    // Groceries — weekly, variable
    for (const day of [4, 11, 18, 25]) T('secondary', day, gbp(-randInt(rng, 58, 96)), 'EXPENSE', 'Groceries', pick(rng, GROCERS), 'Weekly shop');

    // Restaurants — behavioural overspend + post-payday spike (days 26-27).
    const restCount = randInt(rng, 3, 4);
    for (let i = 0; i < restCount; i++) T('amex', randInt(rng, 6, 24), gbp(-randInt(rng, 24, 52)), 'EXPENSE', 'Restaurants', pick(rng, RESTAURANTS), 'Dinner out');
    T('amex', 26, gbp(-randInt(rng, 55, 85)), 'EXPENSE', 'Restaurants', pick(rng, RESTAURANTS), 'Payday dinner');
    T('amex', 27, gbp(-randInt(rng, 22, 38)), 'EXPENSE', 'Takeaway', 'Deliveroo', 'Takeaway');

    // Transport
    T('secondary', 2, gbp(-randInt(rng, 110, 155)), 'EXPENSE', 'Public Transport', 'TfL Travel', 'Travel');
    if (rng() < 0.6) T('amex', randInt(rng, 12, 24), gbp(-randInt(rng, 9, 26)), 'EXPENSE', 'Taxi', 'Uber', 'Taxi');

    // Shopping — irregular
    if (rng() < 0.7) T('amex', randInt(rng, 8, 24), gbp(-randInt(rng, 25, 160)), 'EXPENSE', 'Shopping', pick(rng, ['ASOS', 'Amazon', 'John Lewis', 'Argos']), 'Shopping');

    // Travel — summer spike (Jun-Aug)
    if (m >= 6 && m <= 8) T('amex', 15, gbp(-randInt(rng, 220, 480)), 'EXPENSE', 'Travel', pick(rng, ['Ryanair', 'Booking.com', 'Airbnb']), 'Summer travel');

    // Annual insurance (car Sep, home Feb)
    if (m === 9) T('main', 10, gbp(-684), 'EXPENSE', 'Insurance', 'Direct Line', 'Car insurance (annual)');
    if (m === 2) T('main', 12, gbp(-212), 'EXPENSE', 'Insurance', 'Aviva', 'Home insurance (annual)');

    // A refund now and then
    if (rng() < 0.25) T('amex', randInt(rng, 10, 24), gbp(randInt(rng, 20, 70)), 'REFUND', 'Refund', 'ASOS', 'Returned item refund');

    // Interest credits on savings (month end)
    for (const [k, bal, rate] of [['easy', 5300, 475], ['fixed', 4000, 520], ['emergency', 6100, 410], ['holiday', 1200, 350], ['cashisa', 8100, 490]] as const) {
      T(k, 28, gbp(Math.round((bal * rate) / 10000 / 12 * 100) / 100), 'INTEREST', 'Interest', 'Interest', 'Interest');
    }

    // Savings transfer (26th) + a withdrawal back (behavioural: save £500, withdraw ~£280).
    X('main', 'easy', gbp(500), 26, 'TRANSFER', 'Savings Transfer', 'Transfer to savings');
    if (rng() < 0.7) X('easy', 'main', gbp(randInt(rng, 180, 360)), randInt(rng, 8, 22), 'TRANSFER', 'Savings Transfer', 'Withdrawal from savings');

    // ISA + investment + holiday contributions (27th)
    X('main', 'cashisa', gbp(300), 27, 'TRANSFER', 'ISA Contribution', 'Cash ISA contribution');
    X('main', 'ssisa', gbp(250), 27, 'TRANSFER', 'Investment Contribution', 'S&S ISA contribution');
    X('main', 'holiday', gbp(150), 27, 'TRANSFER', 'Savings Transfer', 'Holiday pot top-up');
    // Fund the everyday spending account
    X('main', 'secondary', gbp(600), 24, 'TRANSFER', 'Account Transfer', 'Top up spending account');

    // Credit card payment (Main -> Amex) — sometimes partial, so a balance carries (high-cost debt).
    const payFull = rng() < 0.6;
    X('main', 'amex', gbp(payFull ? randInt(rng, 260, 420) : randInt(rng, 90, 160)), 15, 'CARD_PAYMENT', 'Credit Card Payment', 'Amex payment');
    if (!payFull) T('amex', 1, gbp(-randInt(rng, 8, 22)), 'INTEREST', 'Interest Charged', 'Amex', 'Interest charged');
  }

  // Classify internal transfers with the SAME detector the CSV importer uses (spec §7): genuine
  // account-to-account legs were left untagged (type UNKNOWN); detectTransfers pairs them by
  // opposite-sign/near-equal/cross-account/within-a-few-days, so the demo exercises this path end to
  // end instead of pre-labelling it. Fails loudly if any leg is left unpaired (would become phantom spend).
  const byId = new Map(txns.map((t) => [t.id as string, t]));
  let transferPairs = 0;
  for (const [a, b] of detectTransfers(txns.filter((t) => t.transactionType === 'UNKNOWN') as unknown as Transaction[])) {
    const group = randomUUID();
    for (const id of [a, b]) {
      const t = byId.get(id)!;
      t.transferGroupId = group;
      t.transactionType = 'TRANSFER';
    }
    transferPairs++;
  }
  const orphanLegs = txns.filter((t) => t.transactionType === 'UNKNOWN').length;
  if (orphanLegs > 0) throw new Error(`Transfer detection left ${orphanLegs} legs unpaired (expected 0) — adjust seed transfer amounts/dates.`);

  // A planned future expense the user has entered: PENDING + future-dated + source MANUAL. Exercises
  // the USER_ENTERED forecast source and the "planned" badge, neither of which an all-POSTED demo hit.
  // Dated ~12 days out from the real seed date so it lands inside the 30-day forecast horizon.
  const plannedDate = new Date(Date.now() + 12 * 86_400_000).toISOString().slice(0, 10);
  const mainId = accId.get('main')!;
  txns.push({
    id: randomUUID(), userId, accountId: mainId, date: plannedDate, amount: gbp(-1250), currency: 'GBP',
    merchant: 'DFS', description: 'Planned sofa purchase', categoryId: catId.get('Shopping') ?? null,
    transactionType: 'EXPENSE', status: 'PENDING', confidence: 100, source: 'MANUAL',
    dedupeKey: dedupe(mainId, plannedDate, gbp(-1250), 'Planned sofa purchase'),
  });

  // Batch insert transactions
  for (let i = 0; i < txns.length; i += 200) {
    await db.insert(s.transactions).values(txns.slice(i, i + 200));
  }

  // 7. Goals + user rules
  await db.insert(s.goals).values([
    { userId, name: 'Summer Holiday', targetAmount: gbp(4000), targetDate: '2027-07-01', linkedAccountId: accId.get('holiday')!, priority: 20 },
    { userId, name: 'Emergency Fund', targetAmount: gbp(9000), targetDate: null, linkedAccountId: accId.get('emergency')!, priority: 10 },
    { userId, name: 'House Deposit', targetAmount: gbp(20000), targetDate: '2028-09-01', linkedAccountId: accId.get('cashisa')!, priority: 30 },
  ]);
  await db.insert(s.userRules).values([
    { userId, ruleType: 'MIN_CURRENT_BALANCE', params: { accountKey: 'main', amountPence: gbp(1500) } },
    { userId, ruleType: 'EMERGENCY_MONTHS', params: { months: 3 } },
    { userId, ruleType: 'PREFER_INSTANT_ACCESS', params: {} },
  ]);

  console.log(`Seeded demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  ${txns.length} transactions across ${accId.size} accounts, ${MONTHS.length} months; ${transferPairs} transfers detected.`);

  // Self-check: derived balances + confirm no SETTLED (POSTED) transaction is dated after asOf
  // ("today") — a future POSTED row would inflate balances. Future PENDING rows are planned items.
  const check = await loadSnapshot(userId);
  const bals = new Map(computeBalances(check).map((b) => [b.accountId, b.balance]));
  const latestPosted = check.transactions.filter((t) => t.status === 'POSTED').reduce((mx, t) => (t.date > mx ? t.date : mx), '');
  const pending = check.transactions.filter((t) => t.status === 'PENDING').length;
  console.log(`  asOf ${check.asOf}; latest POSTED txn ${latestPosted}${latestPosted > check.asOf ? '  <-- FUTURE!' : ' (ok)'}; ${pending} planned (pending) item(s)`);
  for (const a of check.accounts) {
    console.log(`    ${a.name.padEnd(24)} ${((bals.get(a.id) ?? 0) / 100).toFixed(2).padStart(11)}`);
  }
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
