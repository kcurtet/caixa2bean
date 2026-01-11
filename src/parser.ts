/*
 * caixa2bean - Convert Caixa bank statements to Beancount format
 * Copyright (C) 2026  Kevin Curtet
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import * as XLSX from 'xlsx';
import { ExcelTransaction, ParsedExcelFile } from './types.js';
import { ParsingError } from './errors.js';

export class ExcelParser {
  static parseFile(filePath: string): ParsedExcelFile {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new ParsingError('No worksheets found in Excel file');
      }

      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

      if (rawData.length === 0) {
        throw new ParsingError('Excel file appears to be empty');
      }

      // Skip header rows and find the data rows
      const headerRowIndex = this.findHeaderRow(rawData);
      if (headerRowIndex === -1) {
        throw new ParsingError('Could not find expected header row in Excel file');
      }

      const dataRows = rawData.slice(headerRowIndex + 1);

      // Parse period from the first row
      const periodRow = rawData.find((row) => row[1]?.toString().includes('MOVIMIENTOS DESDE'));
      const periodMatch = periodRow?.[1]
        ?.toString()
        .match(/DESDE : (\d{2}\/\d{2}\/\d{4}) HASTA: (\d{2}\/\d{2}\/\d{4})/);
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
        closingBalance: transactions[transactions.length - 1]?.balance || 0,
      };
    } catch (error) {
      if (error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError(
        `Failed to parse Excel file: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  public static findHeaderRow(data: unknown[][]): number {
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[1]?.toString().toLowerCase().includes('número de cuenta')) {
        return i;
      }
    }
    return 3; // Default fallback
  }

  public static normalizeSpaces(str: string): string {
    return str.trim().replace(/\s+/g, ' ');
  }

  public static parseTransactionRow(row: unknown[]): ExcelTransaction | null {
    try {
      // Validate row has minimum required length
      if (row.length < 25) {
        throw new ParsingError(
          `Row has insufficient columns: expected at least 25, got ${row.length}`
        );
      }

      // Validate required fields
      const accountNumber = this.normalizeSpaces((row[1] || '').toString());
      if (!accountNumber.trim()) {
        throw new ParsingError('Missing account number in transaction row');
      }

      const transactionDate = this.normalizeSpaces((row[4] || '').toString());
      if (!transactionDate.trim()) {
        throw new ParsingError('Missing transaction date in transaction row');
      }

      return {
        accountNumber,
        branchCode: this.normalizeSpaces((row[2] || '').toString()),
        currency: this.normalizeSpaces((row[3] || '').toString()),
        transactionDate,
        valueDate: this.normalizeSpaces((row[5] || '').toString()),
        creditAmount: row[6] ? parseFloat(row[6].toString()) : null,
        debitAmount: row[7] ? parseFloat(row[7].toString()) : null,
        balance: row[8]
          ? parseFloat(row[8].toString())
          : row[9]
            ? -parseFloat(row[9].toString())
            : 0,
        conceptoComun: this.normalizeSpaces((row[10] || '').toString()),
        conceptoPropio: this.normalizeSpaces((row[11] || '').toString()),
        referencia1: this.normalizeSpaces((row[12] || '').toString()),
        referencia2: this.normalizeSpaces((row[13] || '').toString()),
        conceptoComplementario1: this.normalizeSpaces((row[14] || '').toString()),
        conceptoComplementario2: this.normalizeSpaces((row[15] || '').toString()),
        conceptoComplementario3: this.normalizeSpaces((row[16] || '').toString()),
        conceptoComplementario4: this.normalizeSpaces((row[17] || '').toString()),
        conceptoComplementario5: this.normalizeSpaces((row[18] || '').toString()),
        conceptoComplementario6: this.normalizeSpaces((row[19] || '').toString()),
        conceptoComplementario7: this.normalizeSpaces((row[20] || '').toString()),
        conceptoComplementario8: this.normalizeSpaces((row[21] || '').toString()),
        conceptoComplementario9: this.normalizeSpaces((row[22] || '').toString()),
        conceptoComplementario10: this.normalizeSpaces((row[23] || '').toString()),
      };
    } catch (error) {
      if (error instanceof ParsingError) {
        throw error;
      }
      // Log warning but don't fail completely for individual row errors
      console.warn('Failed to parse transaction row:', row, error);
      return null;
    }
  }
}
