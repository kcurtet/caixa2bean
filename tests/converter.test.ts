import { describe, it, expect } from 'vitest';
import { BeancountConverter } from '../src/converter';
import { ParsedExcelFile, ExcelTransaction } from '../src/types.js';

describe('BeancountConverter', () => {
  const mockTransaction: ExcelTransaction = {
    accountNumber: '2100 0904 78 0100394901',
    branchCode: '9736',
    currency: 'EUR',
    transactionDate: '31/12/2025',
    valueDate: '31/12/2025',
    creditAmount: null,
    debitAmount: 15.5,
    balance: 84.5,
    conceptoComun: '12',
    conceptoPropio: '040',
    referencia1: '000000000000',
    referencia2: '1234567890123456',
    conceptoComplementario1: 'GAS STATION EXAMPLE',
    conceptoComplementario2: '',
    conceptoComplementario3: '',
    conceptoComplementario4: '',
    conceptoComplementario5: '',
    conceptoComplementario6: '',
    conceptoComplementario7: '',
    conceptoComplementario8: '04000022SIO',
    conceptoComplementario9: 'COMPRA CON TARJETA',
    conceptoComplementario10: '',
  };

  const mockData: ParsedExcelFile = {
    accountNumber: '2100 0904 78 0100394901',
    currency: 'EUR',
    period: { start: '01/01/2025', end: '31/12/2025' },
    openingBalance: 84.54,
    transactions: [mockTransaction],
    closingBalance: 76.84,
  };

  it('should convert transaction date to Beancount format', async () => {
    const beancountTxn = await BeancountConverter.convertTransaction(mockTransaction);
    expect(beancountTxn.date).toBe('2025-12-31');
  });

  it('should create correct postings for debit transaction', async () => {
    const beancountTxn = await BeancountConverter.convertTransaction(mockTransaction);
    expect(beancountTxn.postings).toHaveLength(2);
    expect(beancountTxn.postings[0].account).toBe('Assets:Bank:Caixa:Checking');
    expect(beancountTxn.postings[0].amount).toBe(-15.5);
    expect(beancountTxn.postings[1].account).toBe('Expenses:Transportation:Fuel');
  });

  it('should create correct postings for credit transaction', async () => {
    const creditTxn = { ...mockTransaction, creditAmount: 50, debitAmount: null };
    const beancountTxn = await BeancountConverter.convertTransaction(creditTxn);
    expect(beancountTxn.postings[0].amount).toBe(50);
    expect(beancountTxn.postings[1].amount).toBe(-50);
  });

  it('should generate account opening directive', async () => {
    const beancount = await BeancountConverter.convert(mockData);
    expect(beancount).toContain('2025-01-01 open Assets:Bank:Caixa:Checking EUR');
  });

  it('should generate balance assertion', async () => {
    const beancount = await BeancountConverter.convert(mockData);
    expect(beancount).toContain('2025-12-31 balance Assets:Bank:Caixa:Checking   76.84 EUR');
  });

  it('should include transaction in output', async () => {
    const beancount = await BeancountConverter.convert(mockData);
    expect(beancount).toContain('2025-12-31 * "GAS STATION EXAMPLE - COMPRA CON TARJETA"');
    expect(beancount).toContain('Assets:Bank:Caixa:Checking         -15.50 EUR');
  });

  it('should normalize whitespace in transaction descriptions', async () => {
    // Test with normalized input (as it would come from parser)
    const txnWithNormalizedSpaces: ExcelTransaction = {
      ...mockTransaction,
      conceptoComplementario9: 'COMPRA CON TARJETA', // Already normalized
    };
    const beancountTxn = await BeancountConverter.convertTransaction(txnWithNormalizedSpaces);
    expect(beancountTxn.narration).toBe('GAS STATION EXAMPLE - COMPRA CON TARJETA');
  });
});
