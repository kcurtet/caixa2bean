import {
  ParsedExcelFile,
  ExcelTransaction,
  BeancountTransaction,
  BeancountPosting,
} from './types.js';
import fs from 'fs/promises';
import path from 'path';
import { TransactionConsolidator } from './consolidator.js';
import { ConfigManager } from './config.js';
import { ConfigurationError } from './errors.js';

interface MerchantRule {
  keywords: string[];
  account: string;
  description?: string;
}

interface PatternRule {
  regex: string;
  account: string;
  description?: string;
}

interface FallbackRule {
  condition: string;
  account: string;
  description?: string;
}

interface MerchantConfig {
  rules: MerchantRule[];
  patterns: PatternRule[];
  fallbacks?: FallbackRule[];
}

export class BeancountConverter {
  private static merchantConfig: MerchantConfig | null = null;

  private static async loadMerchantConfig(): Promise<MerchantConfig> {
    if (this.merchantConfig) return this.merchantConfig;

    const configPath = path.join(process.cwd(), 'merchants.json');
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      this.merchantConfig = JSON.parse(configData);
      return this.merchantConfig!;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        // File doesn't exist, use fallback
        console.warn('merchants.json not found, using fallback categorization');
        this.merchantConfig = {
          rules: [
            { keywords: ['shell', 'fuel', 'gas'], account: 'Expenses:Transportation:Fuel' },
            { keywords: ['amazon', 'lidl'], account: 'Expenses:Groceries' },
            { keywords: ['bizum', 'transfer'], account: 'Assets:Bank:Caixa:Savings' },
            { keywords: ['income', 'salary', 'haber'], account: 'Income:Salary' },
            { keywords: ['vending', 'snack'], account: 'Expenses:Food:Snacks' },
            { keywords: ['steam', 'game'], account: 'Expenses:Entertainment:Games' },
          ],
          patterns: [],
          fallbacks: [],
        };
        return this.merchantConfig;
      } else {
        throw new ConfigurationError(
          `Failed to load merchant configuration: ${error instanceof Error ? error.message : error}`,
          configPath
        );
      }
    }
  }

  static async convert(data: ParsedExcelFile, accountName?: string): Promise<string> {
    const config = await ConfigManager.getConverterConfig();
    const defaultAccount = accountName || config.defaultAccount;

    const lines: string[] = [];

    // Add header comments
    lines.push(`; Converted from Caixa bank statement`);
    lines.push(`; Account: ${data.accountNumber}`);
    lines.push(`; Period: ${data.period.start} to ${data.period.end}`);
    lines.push(`; Currency: ${data.currency}`);
    lines.push('');

    // Open account
    const startDate = this.convertDate(data.period.start);
    lines.push(`${startDate} open ${defaultAccount} ${data.currency}`);
    lines.push('');

    // Add opening balance as initial transaction if not zero
    if (data.openingBalance !== 0) {
      const openingTxn: BeancountTransaction = {
        date: startDate,
        flag: '*',
        narration: 'Opening balance',
        postings: [
          {
            account: defaultAccount,
            amount: data.openingBalance,
            currency: data.currency,
          },
          {
            account: 'Equity:Opening-Balances',
            amount: -data.openingBalance,
            currency: data.currency,
          },
        ],
      };
      lines.push(this.formatTransaction(openingTxn));
      lines.push('');
    }

    // Consolidate transactions first
    const consolidatedTransactions = await TransactionConsolidator.consolidate(data.transactions);

    // Convert transactions
    for (const txn of consolidatedTransactions) {
      const beancountTxn = await this.convertTransaction(txn, defaultAccount);
      lines.push(this.formatTransaction(beancountTxn));
      lines.push('');
    }

    // Add manual review comments if any
    const manualReviews = TransactionConsolidator.getManualReviewCandidates();
    if (manualReviews.length > 0) {
      lines.push(';');
      lines.push('; MANUAL REVIEW REQUIRED - Potential consolidation candidates');
      lines.push(';');
      for (const review of manualReviews) {
        lines.push(`; Confidence: ${review.confidence}`);
        lines.push(`; Reason: ${review.reasoning}`);
        lines.push(`; Suggested: ${review.suggestedAccount}`);
        lines.push('; Transactions:');
        for (const txn of review.transactions) {
          const desc = this.buildDescription(txn);
          const amount = txn.debitAmount ? `-${txn.debitAmount}€` : `+${txn.creditAmount}€`;
          lines.push(`;   ${txn.transactionDate} ${desc} ${amount}`);
        }
        lines.push(';');
      }
    }

    // Add closing balance assertion
    const endDate = this.convertDate(data.period.end);
    lines.push(
      `${endDate} balance ${defaultAccount}   ${data.closingBalance.toFixed(2)} ${data.currency}`
    );

    return lines.join('\n');
  }

  static async convertTransaction(
    txn: ExcelTransaction,
    accountName: string = 'Assets:Bank:Caixa:Checking'
  ): Promise<BeancountTransaction> {
    const amount = (txn.creditAmount || 0) - (txn.debitAmount || 0);

    // Determine expense/income account from description
    const account = await this.determineAccount(txn);

    const postings: BeancountPosting[] = [
      {
        account: accountName,
        amount: amount,
        currency: txn.currency,
      },
      {
        account: account,
        amount: -amount,
        currency: txn.currency,
      },
    ];

    // Build description from available fields
    const description = this.buildDescription(txn);

    return {
      date: this.convertDate(txn.transactionDate),
      flag: '*',
      narration: description,
      postings,
    };
  }

  private static convertDate(dateStr: string): string {
    // Convert DD/MM/YYYY to YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dateStr;
  }

  private static async determineAccount(txn: ExcelTransaction): Promise<string> {
    const config = await this.loadMerchantConfig();
    const description = [
      txn.conceptoComplementario1,
      txn.conceptoComplementario9,
      txn.conceptoComplementario2,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // Check keyword rules first
    for (const rule of config.rules) {
      if (rule.keywords.some((keyword) => description.includes(keyword.toLowerCase()))) {
        return rule.account;
      }
    }

    // Check regex patterns
    for (const pattern of config.patterns) {
      if (new RegExp(pattern.regex, 'i').test(description)) {
        return pattern.account;
      }
    }

    // Check fallback rules
    if (config.fallbacks) {
      for (const fallback of config.fallbacks) {
        if (this.evaluateFallbackCondition(fallback.condition, txn, description)) {
          return fallback.account;
        }
      }
    }

    return 'Expenses:Unknown';
  }

  private static evaluateFallbackCondition(
    condition: string,
    txn: ExcelTransaction,
    description: string
  ): boolean {
    // Simple condition evaluator for fallback rules
    const amount = txn.debitAmount || txn.creditAmount || 0;

    if (condition.includes('amount <= 2.00') && amount > 2.0) return false;
    if (
      condition.includes("description CONTAINS 'compra con tarjeta'") &&
      !description.includes('compra con tarjeta')
    )
      return false;

    return true;
  }

  private static buildDescription(txn: ExcelTransaction): string {
    const parts = [
      txn.conceptoComplementario1,
      txn.conceptoComplementario9,
      txn.conceptoComplementario2,
    ].filter(Boolean);

    return parts.join(' - ').trim() || 'Transaction';
  }

  private static formatTransaction(txn: BeancountTransaction): string {
    const lines: string[] = [];
    const date = txn.date;
    const flag = txn.flag;
    const narration = txn.narration ? ` "${txn.narration}"` : '';

    lines.push(`${date} ${flag}${narration}`);

    for (const posting of txn.postings) {
      const amountStr = posting.amount.toFixed(2);
      const currency = posting.currency;
      const account = posting.account;
      lines.push(`  ${account}         ${amountStr} ${currency}`);
    }

    return lines.join('\n');
  }
}
