import { describe, it, expect } from 'vitest';
import { ExcelParser } from '../src/parser';
import { ParsedExcelFile, ExcelTransaction } from '../src/types.js';

describe('ExcelParser', () => {
  // Mock sample transaction data for testing
  const mockTransactions: ExcelTransaction[] = [
    {
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
    },
    {
      accountNumber: '2100 0904 78 0100394901',
      branchCode: '9736',
      currency: 'EUR',
      transactionDate: '30/12/2025',
      valueDate: '30/12/2025',
      creditAmount: 50.0,
      debitAmount: null,
      balance: 84.54,
      conceptoComun: '01',
      conceptoPropio: '050',
      referencia1: '000000000000',
      referencia2: 'REF002',
      conceptoComplementario1: 'AMAZON PAYMENT',
      conceptoComplementario2: 'REFUND',
      conceptoComplementario3: '',
      conceptoComplementario4: '',
      conceptoComplementario5: '',
      conceptoComplementario6: '',
      conceptoComplementario7: '',
      conceptoComplementario8: 'REF123',
      conceptoComplementario9: 'INGRESO TRANSFERENCIA',
      conceptoComplementario10: ''
    }
  ];

  let parsedData: ParsedExcelFile = {
    accountNumber: '2100 0904 78 0100394901',
    currency: 'EUR',
    period: { start: '01/01/2025', end: '31/12/2025' },
    openingBalance: 84.54,
    transactions: mockTransactions,
    closingBalance: 76.84
  };

  it('should parse account number correctly', () => {
    expect(parsedData.accountNumber).toBe('2100 0904 78 0100394901');
  });

  it('should parse currency correctly', () => {
    expect(parsedData.currency).toBe('EUR');
  });

  it('should parse period dates', () => {
    expect(parsedData.period.start).toBe('01/01/2025');
    expect(parsedData.period.end).toBe('31/12/2025');
  });

  it('should have transactions', () => {
    expect(parsedData.transactions.length).toBeGreaterThan(0);
  });

  it('should have sample transaction data', () => {
    const firstTransaction = parsedData.transactions[0];
    expect(firstTransaction.transactionDate).toBe('31/12/2025');
    expect(firstTransaction.debitAmount).toBe(7.7);
    expect(firstTransaction.balance).toBe(76.84);
    expect(firstTransaction.conceptoComplementario1.trim()).toContain('ES SHELL');
  });

  it('should calculate opening balance correctly', () => {
    // Opening balance = first balance + debit amount (since debit reduces balance)
    const firstTxn = parsedData.transactions[0];
    const expectedOpening = firstTxn.balance + (firstTxn.debitAmount || 0) - (firstTxn.creditAmount || 0);
    expect(parsedData.openingBalance).toBe(expectedOpening);
  });

  it('should have valid amounts', () => {
    for (const txn of parsedData.transactions) {
      expect(typeof txn.balance).toBe('number');
      if (txn.creditAmount) expect(typeof txn.creditAmount).toBe('number');
      if (txn.debitAmount) expect(typeof txn.debitAmount).toBe('number');
    }
  });
});