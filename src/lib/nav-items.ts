export type NavItem = { href: string; label: string };

// The 12 app routes, in the money story's order: overview → holdings → history → future → action.
// PRIMARY sits in the desktop bar; MORE lives under "More" and in the mobile drawer. Shared here so
// the command palette and the nav stay in lockstep — one source of truth, add a page in one place.
export const PRIMARY: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/forecast', label: 'Forecast' },
  { href: '/recommendations', label: 'Recommendations' },
];

export const MORE: NavItem[] = [
  { href: '/goals', label: 'Goals' },
  { href: '/behaviour', label: 'Behaviour' },
  { href: '/scenarios', label: 'What if?' },
  { href: '/health', label: 'Health' },
  { href: '/assistant', label: 'Assistant' },
  { href: '/categories', label: 'Categories' },
  { href: '/settings', label: 'Settings' },
];

export const NAV_ITEMS: NavItem[] = [...PRIMARY, ...MORE];
