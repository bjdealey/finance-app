// Regulatory execution boundary (spec §47). Moving money is a REGULATED activity this MVP does not
// perform. Rather than relying on the mere absence of payment code, "we never move money" is made a
// structural guarantee: every hypothetical payment must pass through a PaymentExecutionProvider, and
// the only provider wired here is a mock that is DISABLED and refuses. One locked door, and it's locked.
//
// To enable real execution later, add a provider that integrates a payment-initiation API TOGETHER with
// the regulatory controls the spec separates out (explicit authorisation, advice-vs-guidance boundary,
// audit trail) — and route it through executePayment. Never by loosening this mock.

export interface PaymentInstruction {
  sourceAccountId: string;
  destinationAccountId: string;
  amountPence: number;
  reference: string;
}

export interface ExecutionResult {
  executedAt: string;
  providerRef: string;
}

// Thrown by any attempt to move money while execution is disabled. A distinct type so callers (and
// tests) can assert the boundary held, rather than catching a generic Error.
export class ExecutionDisabledError extends Error {
  constructor() {
    super(
      'Payment execution is disabled: this product provides financial planning guidance only and does not move money. Enabling execution requires a regulated payment provider.',
    );
    this.name = 'ExecutionDisabledError';
  }
}

export interface PaymentExecutionProvider {
  readonly enabled: boolean;
  execute(instruction: PaymentInstruction): Promise<ExecutionResult>;
}

// The only provider wired in this MVP. Disabled by construction — execute() always throws, so no code
// path, present or future, can move money without deliberately replacing this provider.
export class MockPaymentExecutionProvider implements PaymentExecutionProvider {
  readonly enabled = false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(_instruction: PaymentInstruction): Promise<ExecutionResult> {
    throw new ExecutionDisabledError();
  }
}

// The single money-movement chokepoint the rest of the app must route through. Swapping this provider
// is the ONLY way execution could ever happen; the wired provider refuses.
export const paymentProvider: PaymentExecutionProvider = new MockPaymentExecutionProvider();

export function executePayment(instruction: PaymentInstruction): Promise<ExecutionResult> {
  return paymentProvider.execute(instruction);
}

// Single source of truth for the user-facing statement of the boundary (used in the recommendations UI).
export const EXECUTION_DISABLED_NOTICE =
  'Approving records your intent — it never moves money. Execution is a disabled boundary in this MVP.';
