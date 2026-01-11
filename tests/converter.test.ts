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
    debitAmount: 7.7,
    balance: 76.84,
    conceptoComun: '12',
    conceptoPropio: '040',
    referencia1: '000000000000',
    referencia2: '4800259969209119',
    conceptoComplementario1: 'ES SHELL L\'EMPORD',
    conceptoComplementario2: '',
    conceptoComplementario3: '',
    conceptoComplementario4: '',
    conceptoComplementario5: '',
    conceptoComplementario6: '',
    conceptoComplementario7: '',
    conceptoComplementario8: '04000022SIO',
    conceptoComplementario9: 'COMPRA CON TARJETA',
    conceptoComplementario10: ''
  };

  const mockData: ParsedExcelFile = {
    accountNumber: '2100 0904 78 0100394901',
    currency: 'EUR',
    period: { start: '01/01/2025', end: '31/12/2025' },
    openingBalance: 84.54,
    transactions: [mockTransaction],
    closingBalance: 76.84
  };

  it('should convert transaction date to Beancount format', () => {
    const beancountTxn = BeancountConverter.convertTransaction(mockTransaction);
    expect(beancountTxn.date).toBe('2025-12-31');
  });

  it('should create correct postings for debit transaction', () => {
    const beancountTxn = BeancountConverter.convertTransaction(mockTransaction);
    expect(beancountTxn.postings).toHaveLength(2);
    expect(beancountTxn.postings[0].account).toBe('Assets:Bank:Caixa:Checking');
    expect(beancountTxn.postings[0].amount).toBe(-7.7);
    expect(beancountTxn.postings[1].account).toBe('Expenses:Transportation:Fuel');
  });

  it('should create correct postings for credit transaction', () => {
    const creditTxn = { ...mockTransaction, creditAmount: 50, debitAmount: null };
    const beancountTxn = BeancountConverter.convertTransaction(creditTxn);
    expect(beancountTxn.postings[0].amount).toBe(50);
    expect(beancountTxn.postings[1].amount).toBe(-50);
  });

  it('should generate account opening directive', () => {
    const beancount = BeancountConverter.convert(mockData);
    expect(beancount).toContain('2025-01-01 open Assets:Bank:Caixa:Checking EUR');
  });

  it('should generate balance assertion', () => {
    const beancount = BeancountConverter.convert(mockData);
    expect(beancount).toContain('2025-12-31 balance Assets:Bank:Caixa:Checking   76.84 EUR');
  });

  it('should include transaction in output', () => {
    const beancount = BeancountConverter.convert(mockData);
    expect(beancount).toContain('2025-12-31 * "ES SHELL L\'EMPORD - COMPRA CON TARJETA - 4800259969209119"');
    expect(beancount).toContain('Assets:Bank:Caixa:Checking         -7.70 EUR');
  });
});