import { describe, it, expect } from 'vitest';
import {
  MockPaymentExecutionProvider,
  ExecutionDisabledError,
  executePayment,
  paymentProvider,
  type PaymentInstruction,
} from './execution';

const instruction: PaymentInstruction = {
  sourceAccountId: 'main',
  destinationAccountId: 'saver',
  amountPence: 20_000,
  reference: 'rec-1',
};

// Spec §47: execution is a hard, enforced boundary, not just prose in the UI.
describe('payment execution boundary', () => {
  it('the wired provider is disabled', () => {
    expect(paymentProvider.enabled).toBe(false);
  });

  it('routing a payment through the single chokepoint is refused', async () => {
    await expect(executePayment(instruction)).rejects.toBeInstanceOf(ExecutionDisabledError);
  });

  it('the mock provider always throws — it never returns a result', async () => {
    await expect(new MockPaymentExecutionProvider().execute(instruction)).rejects.toThrow(/disabled/i);
  });
});
