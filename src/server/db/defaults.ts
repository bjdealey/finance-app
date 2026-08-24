import { db } from './client';
import * as s from './schema';
import type { CategoryKind } from '../../core/types';

// Default UK category hierarchy + keyword rules, seeded for EVERY new user so categorisation and the
// essential/discretionary split work out of the box. The demo seed (seed.ts) imports these too, so
// the demo and a fresh account share one canonical taxonomy.

export const CATEGORY_TREE: [string, CategoryKind, string[]][] = [
  ['Income', 'INCOME', ['Salary', 'Bonus', 'Interest', 'Refund']],
  ['Housing', 'EXPENSE', ['Rent', 'Council Tax', 'Utilities', 'Water', 'Broadband']],
  ['Food', 'EXPENSE', ['Groceries', 'Restaurants', 'Takeaway']],
  ['Transport', 'EXPENSE', ['Public Transport', 'Fuel', 'Taxi']],
  ['Lifestyle', 'EXPENSE', ['Entertainment', 'Shopping', 'Subscriptions', 'Travel', 'Gym']],
  ['Financial', 'EXPENSE', ['Insurance', 'Bank Fees', 'Interest Charged']],
  ['Transfers', 'TRANSFER', ['Savings Transfer', 'ISA Contribution', 'Investment Contribution', 'Credit Card Payment', 'Account Transfer']],
];

export const CATEGORY_KEYWORD_RULES: [string, string][] = [
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

// Insert the default categories (parents then children) and keyword rules for a user; returns a
// name -> id map. Shared by the demo seed and new-user registration.
export async function seedCategoriesAndRules(userId: string): Promise<Map<string, string>> {
  const catId = new Map<string, string>();
  for (const [parent, kind] of CATEGORY_TREE) {
    const [row] = await db.insert(s.categories).values({ userId, name: parent, kind, parentId: null }).returning();
    catId.set(parent, row.id);
  }
  for (const [parent, kind, kids] of CATEGORY_TREE) {
    for (const kid of kids) {
      const [row] = await db.insert(s.categories).values({ userId, name: kid, kind, parentId: catId.get(parent)! }).returning();
      catId.set(kid, row.id);
    }
  }
  if (CATEGORY_KEYWORD_RULES.length) {
    await db.insert(s.categoryRules).values(
      CATEGORY_KEYWORD_RULES.map(([pattern, cat], i) => ({
        userId, matchType: 'KEYWORD' as const, pattern, categoryId: catId.get(cat)!, priority: i, source: 'SEED' as const,
      })),
    );
  }
  return catId;
}

// Full starting setup for a newly-registered user: the category taxonomy + rules, plus one sensible
// default user-rule (a 3-month emergency-fund target). No accounts or transactions — the user adds
// their own; those are what make the account theirs rather than a template.
export async function seedUserDefaults(userId: string): Promise<void> {
  await seedCategoriesAndRules(userId);
  await db.insert(s.userRules).values([{ userId, ruleType: 'EMERGENCY_MONTHS', params: { months: 3 } }]);
}
