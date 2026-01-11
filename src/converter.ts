import { ParsedExcelFile, ExcelTransaction, BeancountTransaction, BeancountPosting } from './types.js';

export class BeancountConverter {
  static convert(data: ParsedExcelFile, accountName: string = 'Assets:Bank:Caixa:Checking'): string {
    const lines: string[] = [];

    // Add header comments
    lines.push(`; Converted from Caixa bank statement`);
    lines.push(`; Account: ${data.accountNumber}`);
    lines.push(`; Period: ${data.period.start} to ${data.period.end}`);
    lines.push(`; Currency: ${data.currency}`);
    lines.push('');

    // Open account
    const startDate = this.convertDate(data.period.start);
    lines.push(`${startDate} open ${accountName} ${data.currency}`);
    lines.push('');

    // Add opening balance as initial transaction if not zero
    if (data.openingBalance !== 0) {
      const openingTxn: BeancountTransaction = {
        date: startDate,
        flag: '*',
        narration: 'Opening balance',
        postings: [
          {
            account: accountName,
            amount: data.openingBalance,
            currency: data.currency
          },
          {
            account: 'Equity:Opening-Balances',
            amount: -data.openingBalance,
            currency: data.currency
          }
        ]
      };
      lines.push(this.formatTransaction(openingTxn));
      lines.push('');
    }

    // Convert transactions
    for (const txn of data.transactions) {
      const beancountTxn = this.convertTransaction(txn, accountName);
      lines.push(this.formatTransaction(beancountTxn));
      lines.push('');
    }

    // Add closing balance assertion
    const endDate = this.convertDate(data.period.end);
    lines.push(`${endDate} balance ${accountName}   ${data.closingBalance.toFixed(2)} ${data.currency}`);

    return lines.join('\n');
  }

  static convertTransaction(txn: ExcelTransaction, accountName: string = 'Assets:Bank:Caixa:Checking'): BeancountTransaction {
    const amount = (txn.creditAmount || 0) - (txn.debitAmount || 0);
    const isDebit = amount < 0;

    // Determine expense/income account from description
    const account = this.determineAccount(txn);

    const postings: BeancountPosting[] = [
      {
        account: accountName,
        amount: amount,
        currency: txn.currency
      },
      {
        account: account,
        amount: -amount,
        currency: txn.currency
      }
    ];

    // Build description from available fields
    const description = this.buildDescription(txn);

    return {
      date: this.convertDate(txn.transactionDate),
      flag: '*',
      narration: description,
      postings
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

  private static determineAccount(txn: ExcelTransaction): string {
    const description = [
      txn.conceptoComplementario1,
      txn.conceptoComplementario9,
      txn.conceptoComplementario2
    ].filter(Boolean).join(' ').toLowerCase();

    // Categorize based on keywords
    if (description.includes('shell') || description.includes('fuel') || description.includes('gas')) {
      return 'Expenses:Transportation:Fuel';
    }
    if (description.includes('amazon') || description.includes('lidl')) {
      return 'Expenses:Groceries';
    }
    if (description.includes('bizum') || description.includes('transfer')) {
      return 'Assets:Bank:Caixa:Savings'; // Internal transfer
    }
    if (description.includes('income') || description.includes('salary') || description.includes('haber')) {
      return 'Income:Salary';
    }
    if (description.includes('vending') || description.includes('snack')) {
      return 'Expenses:Food:Snacks';
    }
    if (description.includes('steam') || description.includes('game')) {
      return 'Expenses:Entertainment:Games';
    }

    return 'Expenses:Unknown';
  }

  private static buildDescription(txn: ExcelTransaction): string {
    const parts = [
      txn.conceptoComplementario1,
      txn.conceptoComplementario9,
      txn.conceptoComplementario2,
      txn.referencia2
    ].filter(part => part && part.trim());

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