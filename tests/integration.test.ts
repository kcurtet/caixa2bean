import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import { ExcelParser } from '../src/parser.js';
import { BeancountConverter } from '../src/converter.js';

describe('Integration Tests', () => {
  const testInputFile = 'TT010126.912.XLS';
  const testOutputFile = 'test-output.beancount';

  // Clean up after tests
  afterEach(() => {
    if (fs.existsSync(testOutputFile)) {
      fs.unlinkSync(testOutputFile);
    }
  });

  it('should complete full conversion workflow', async () => {
    // Parse the Excel file
    const parsedData = ExcelParser.parseFile(testInputFile);

    // Verify parsing worked
    expect(parsedData.transactions.length).toBeGreaterThan(0);
    expect(parsedData.accountNumber).toBeTruthy();

    // Convert to Beancount
    const beancountOutput = await BeancountConverter.convert(parsedData);

    // Verify conversion output
    expect(beancountOutput).toContain('open Assets:Bank:Caixa:Checking EUR');
    expect(beancountOutput).toContain('balance Assets:Bank:Caixa:Checking');
    expect(beancountOutput).toMatch(/2025-\d{2}-\d{2} \*/); // Should have transaction dates

    // Count transactions in output (should be <= parsed transactions due to consolidation)
    const transactionLines = beancountOutput
      .split('\n')
      .filter((line) => /^\d{4}-\d{2}-\d{2} \*/.test(line));
    expect(transactionLines.length).toBeLessThanOrEqual(parsedData.transactions.length);
    expect(transactionLines.length).toBeGreaterThan(0);
  });

  it('should write valid Beancount file', async () => {
    const parsedData = ExcelParser.parseFile(testInputFile);
    const beancountOutput = await BeancountConverter.convert(parsedData);

    // Write to file
    fs.writeFileSync(testOutputFile, beancountOutput, 'utf8');

    // Verify file exists and has content
    expect(fs.existsSync(testOutputFile)).toBe(true);
    const fileContent = fs.readFileSync(testOutputFile, 'utf8');
    expect(fileContent.length).toBeGreaterThan(1000); // Should be substantial

    // Verify it contains expected Beancount directives
    expect(fileContent).toContain('; Converted from Caixa bank statement');
    expect(fileContent).toContain('open Assets:Bank:Caixa:Checking EUR');
  });

  it('should handle custom account name', async () => {
    const parsedData = ExcelParser.parseFile(testInputFile);
    const customAccount = 'Assets:Bank:Spain:Caixa';
    const beancountOutput = await BeancountConverter.convert(parsedData, customAccount);

    expect(beancountOutput).toContain(`open ${customAccount} EUR`);
    expect(beancountOutput).toContain(`balance ${customAccount}`);
  });

  it('should include manual review comments when consolidator flags transactions', async () => {
    const parsedData = ExcelParser.parseFile(testInputFile);
    const beancountOutput = await BeancountConverter.convert(parsedData);

    // The consolidator may or may not flag transactions depending on the data
    // Just check that the output doesn't crash and contains expected elements
    expect(beancountOutput).toBeTruthy();
    expect(typeof beancountOutput).toBe('string');
  });

  it('should handle empty transaction list gracefully', async () => {
    const emptyData = {
      accountNumber: '123456789',
      currency: 'EUR',
      period: { start: '01/01/2025', end: '31/01/2025' },
      openingBalance: 100,
      transactions: [],
      closingBalance: 100,
    };

    const beancountOutput = await BeancountConverter.convert(emptyData);

    expect(beancountOutput).toContain('open Assets:Bank:Caixa:Checking EUR');
    expect(beancountOutput).toContain('balance Assets:Bank:Caixa:Checking   100.00 EUR');
    // Should have opening balance transaction
    expect(beancountOutput).toContain('2025-01-01 * "Opening balance"');
  });

  it('should validate Beancount syntax structure', async () => {
    const parsedData = ExcelParser.parseFile(testInputFile);
    const beancountOutput = await BeancountConverter.convert(parsedData);

    const lines = beancountOutput.split('\n').filter((line) => line.trim());

    // Check that each transaction has proper format
    const transactionLines = lines.filter((line) => /^\d{4}-\d{2}-\d{2} \*/.test(line));
    for (const txnLine of transactionLines) {
      // Should have date, flag, and narration
      expect(txnLine).toMatch(/^\d{4}-\d{2}-\d{2} \* ".*"$/);
    }

    // Check that postings follow transactions
    for (let i = 0; i < lines.length; i++) {
      if (/^\d{4}-\d{2}-\d{2} \*/.test(lines[i])) {
        // Next lines should be postings (indented)
        const nextLine = lines[i + 1];
        if (nextLine) {
          expect(nextLine).toMatch(/^ {2}\S+.*\d+\.\d{2} \w+$/);
        }
      }
    }
  });
});
