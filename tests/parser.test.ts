import { describe, it, expect, beforeAll } from 'vitest';
import { ExcelParser } from '../src/parser';
import { ParsedExcelFile } from '../src/types.js';

describe('ExcelParser', () => {
  let parsedData: ParsedExcelFile;

  beforeAll(() => {
    parsedData = ExcelParser.parseFile('TT010126.912.XLS');
  });

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

  it('should parse first transaction correctly', () => {
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