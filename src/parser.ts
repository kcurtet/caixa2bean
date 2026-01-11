import * as XLSX from 'xlsx';
import { ExcelTransaction, ParsedExcelFile } from './types.js';

export class ExcelParser {
  static parseFile(filePath: string): ParsedExcelFile {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    // Skip header rows and find the data rows
    const headerRowIndex = this.findHeaderRow(rawData);
    const dataRows = rawData.slice(headerRowIndex + 1);

    // Parse period from the first row
    const periodRow = rawData.find(row => row[1]?.toString().includes('MOVIMIENTOS DESDE'));
    const periodMatch = periodRow?.[1]?.toString().match(/DESDE : (\d{2}\/\d{2}\/\d{4}) HASTA: (\d{2}\/\d{2}\/\d{4})/);
    const startDate = periodMatch?.[1] || '';
    const endDate = periodMatch?.[2] || '';

    // Parse transactions
    const transactions: ExcelTransaction[] = [];
    let openingBalance = 0;
    let isFirstTransaction = true;

    for (const row of dataRows) {
      if (row.length < 25 || !row[1]?.toString().trim()) continue; // Skip empty rows

      const transaction = this.parseTransactionRow(row);
      if (transaction) {
        transactions.push(transaction);

        if (isFirstTransaction) {
          // Calculate opening balance: balance - (credit - debit)
          const amount = (transaction.creditAmount || 0) - (transaction.debitAmount || 0);
          openingBalance = transaction.balance - amount;
          isFirstTransaction = false;
        }
      }
    }

    return {
      accountNumber: transactions[0]?.accountNumber || '',
      currency: transactions[0]?.currency || 'EUR',
      period: { start: startDate, end: endDate },
      openingBalance,
      transactions,
      closingBalance: transactions[transactions.length - 1]?.balance || 0
    };
  }

  private static findHeaderRow(data: any[][]): number {
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[1]?.toString().toLowerCase().includes('número de cuenta')) {
        return i;
      }
    }
    return 3; // Default fallback
  }

  private static parseTransactionRow(row: any[]): ExcelTransaction | null {
    try {
      return {
        accountNumber: (row[1] || '').toString().trim(),
        branchCode: (row[2] || '').toString().trim(),
        currency: (row[3] || '').toString().trim(),
        transactionDate: (row[4] || '').toString().trim(),
        valueDate: (row[5] || '').toString().trim(),
        creditAmount: row[6] ? parseFloat(row[6].toString()) : null,
        debitAmount: row[7] ? parseFloat(row[7].toString()) : null,
        balance: row[8] ? parseFloat(row[8].toString()) : (row[9] ? -parseFloat(row[9].toString()) : 0),
        conceptoComun: (row[10] || '').toString().trim(),
        conceptoPropio: (row[11] || '').toString().trim(),
        referencia1: (row[12] || '').toString().trim(),
        referencia2: (row[13] || '').toString().trim(),
        conceptoComplementario1: (row[14] || '').toString().trim(),
        conceptoComplementario2: (row[15] || '').toString().trim(),
        conceptoComplementario3: (row[16] || '').toString().trim(),
        conceptoComplementario4: (row[17] || '').toString().trim(),
        conceptoComplementario5: (row[18] || '').toString().trim(),
        conceptoComplementario6: (row[19] || '').toString().trim(),
        conceptoComplementario7: (row[20] || '').toString().trim(),
        conceptoComplementario8: (row[21] || '').toString().trim(),
        conceptoComplementario9: (row[22] || '').toString().trim(),
        conceptoComplementario10: (row[23] || '').toString().trim()
      };
    } catch (error) {
      console.warn('Failed to parse transaction row:', row, error);
      return null;
    }
  }
}