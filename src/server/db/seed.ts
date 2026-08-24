import 'dotenv/config';
import { randomUUID, createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, closeDb } from './client';
import * as s from './schema';
import { hashPassword } from '../auth/password';
import { loadSnapshot } from '../services/snapshot';
import { computeBalances } from '../../core/ledger';
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

  // 3. Categories (hierarchical). Insert parents, then children, keep a name->id map.
  const catId = new Map<string, string>();
  async function addCat(name: string, kind: s.CategoryRow['kind'], parent?: string) {
    const [row] = await db
      .insert(s.categories)
      .values({ userId, name, kind, parentId: parent ? catId.get(parent)! : null })
      .returning();
    catId.set(name, row.id);
  }
  const TREE: [string, s.CategoryRow['kind'], string[]][] = [
    ['Income', 'INCOME', ['Salary', 'Bonus', 'Interest', 'Refund']],
    ['Housing', 'EXPENSE', ['Rent', 'Council Tax', 'Utilities', 'Water', 'Broadband']],
    ['Food', 'EXPENSE', ['Groceries', 'Restaurants', 'Takeaway']],
    ['Transport', 'EXPENSE', ['Public Transport', 'Fuel', 'Taxi']],
    ['Lifestyle', 'EXPENSE', ['Entertainment', 'Shopping', 'Subscriptions', 'Travel', 'Gym']],
    ['Financial', 'EXPENSE', ['Insurance', 'Bank Fees', 'Interest Charged']],
    ['Transfers', 'TRANSFER', ['Savings Transfer', 'ISA Contribution', 'Investment Contribution', 'Credit Card Payment', 'Account Transfer']],
  ];
  for (const [parent, kind] of TREE) await addCat(parent, kind);
  for (const [parent, kind, kids] of TREE) for (const kid of kids) await addCat(kid, kind, parent);

  // 4. Category rules (keyword -> category) used by the categorisation engine on CSV imports.
  const RULES: [string, string][] = [
    ['salary', 'Salary'], ['payroll', 'Salary'], ['bonus', 'Bonus'],
    ['tesco', 'Groceries'], ['sainsbury', 'Groceries'], ['aldi', 'Groceries'], ['lidl', 'Groceries'], ['waitrose', 'Groceries'], ['co-op', 'Groceries'],
    ['dishoom', 'Restaurants'], ['nando', 'Restaurants'], ['pizza express', 'Restaurants'], ['franco manca', 'Restaurants'], ['wagamama', 'Restaurants'], ['restaurant', 'Restaurants'],
    ['deliveroo', 'Takeaway'], ['uber eats', 'Takeaway'], ['just eat', 'Takeaway'],
    ['tfl', 'Public Transport'], ['trainline', 'Public Transport'],
    ['uber', 'Taxi'], ['bolt', 'Taxi'],
    ['shell', 'Fuel'], ['bp ', 'Fuel'], ['esso', 'Fuel'],
    ['netflix', 'Subscriptions'], ['spotify', 'Subscriptions'], ['disney', 'Subscriptions'], ['amazon prime', 'Subscriptions'], ['icloud', 'Subscriptions'], ['audible', 'Subscriptions'],
    ['puregym', 'Gym'], ['gym', 'Gym'],
    ['asos', 'Shopping'], ['amazon', 'Shopping'], ['john lewis', 'Shopping'], ['argos', 'Shopping'],
    ['ryanair', 'Travel'], ['easyjet', 'Travel'], ['booking.com', 'Travel'], ['airbnb', 'Travel'], ['british airways', 'Travel'],
    ['council tax', 'Council Tax'], ['thames water', 'Water'], ['octopus energy', 'Utilities'], ['british gas', 'Utilities'],
    ['bt broadband', 'Broadband'], ['virgin media', 'Broadband'],
    ['aviva', 'Insurance'], ['direct line', 'Insurance'], ['admiral', 'Insurance'],
    ['rent', 'Rent'],
  ];
  await db.insert(s.categoryRules).values(
    RULES.map(([pattern, cat], i) => ({
      userId, matchType: 'KEYWORD' as const, pattern, categoryId: catId.get(cat)!, priority: i, source: 'SEED' as const,
    })),
  );

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

  // 6. Transactions
  const txns: TxInsert[] = [];
  const dedupe = (accountId: string, date: string, amount: number, desc: string) =>
    createHash('sha256').update(`${accountId}|${date}|${amount}|${desc}`).digest('hex');

  function tx(accKey: string, date: string, amountPence: number, type: s.TransactionRow['transactionType'], cat: string, merchant: string, desc?: string) {
    const accountId = accId.get(accKey)!;
    const description = desc ?? merchant;
    txns.push({
      userId, accountId, date, amount: amountPence, currency: 'GBP', merchant, description,
      categoryId: catId.get(cat) ?? null, transactionType: type, status: 'POSTED',
      confidence: 100, source: 'SEED', dedupeKey: dedupe(accountId, date, amountPence, description),
    });
  }
  function transfer(fromKey: string, toKey: string, amountPence: number, date: string, type: s.TransactionRow['transactionType'], cat: string, desc: string) {
    const group = randomUUID();
    const from = accId.get(fromKey)!;
    const to = accId.get(toKey)!;
    txns.push({ userId, accountId: from, date, amount: -amountPence, currency: 'GBP', merchant: desc, description: desc, categoryId: catId.get(cat)!, transactionType: type, status: 'POSTED', transferGroupId: group, confidence: 100, source: 'SEED', dedupeKey: dedupe(from, date, -amountPence, desc) });
    txns.push({ userId, accountId: to, date, amount: amountPence, currency: 'GBP', merchant: desc, description: desc, categoryId: catId.get(cat)!, transactionType: type, status: 'POSTED', transferGroupId: group, confidence: 100, source: 'SEED', dedupeKey: dedupe(to, date, amountPence, desc) });
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
  console.log(`  ${txns.length} transactions across ${accId.size} accounts, ${MONTHS.length} months.`);

  // Self-check: derived balances + confirm no transaction is dated after asOf ("today").
  const check = await loadSnapshot(userId);
  const bals = new Map(computeBalances(check).map((b) => [b.accountId, b.balance]));
  const latest = check.transactions.reduce((mx, t) => (t.date > mx ? t.date : mx), '');
  console.log(`  asOf ${check.asOf}; latest txn ${latest}${latest > check.asOf ? '  <-- FUTURE!' : ' (ok)'}`);
  for (const a of check.accounts) {
    console.log(`    ${a.name.padEnd(24)} ${((bals.get(a.id) ?? 0) / 100).toFixed(2).padStart(11)}`);
  }
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
