// Excel bank statement format (Caixa export)
export interface ExcelTransaction {
  accountNumber: string;
  branchCode: string;
  currency: string;
  transactionDate: string; // DD/MM/YYYY
  valueDate: string; // DD/MM/YYYY
  creditAmount: number | null; // Ingreso (+)
  debitAmount: number | null; // Gasto (-)
  balance: number; // Saldo (positive or negative)
  conceptoComun: string;
  conceptoPropio: string;
  referencia1: string;
  referencia2: string;
  conceptoComplementario1: string;
  conceptoComplementario2: string;
  conceptoComplementario3: string;
  conceptoComplementario4: string;
  conceptoComplementario5: string;
  conceptoComplementario6: string;
  conceptoComplementario7: string;
  conceptoComplementario8: string;
  conceptoComplementario9: string;
  conceptoComplementario10: string;
}

export interface ParsedExcelFile {
  accountNumber: string;
  currency: string;
  period: {
    start: string; // DD/MM/YYYY
    end: string; // DD/MM/YYYY
  };
  openingBalance: number; // Calculated from first transaction
  transactions: ExcelTransaction[];
  closingBalance: number; // From last transaction
}

// Beancount structures
export interface BeancountTransaction {
  date: string; // YYYY-MM-DD
  flag: '*' | '!';
  payee?: string;
  narration: string;
  postings: BeancountPosting[];
  tags?: string[];
  links?: string[];
  metadata?: Record<string, unknown>;
}

export interface BeancountPosting {
  account: string;
  amount: number;
  currency: string;
  cost?: BeancountCost;
  price?: BeancountPrice;
  flag?: '!' | '*';
  metadata?: Record<string, unknown>;
}

export interface BeancountCost {
  amount: number;
  currency: string;
  date?: string;
  label?: string;
}

export interface BeancountPrice {
  amount: number;
  currency: string;
}

export interface BeancountDirective {
  type: 'open' | 'close' | 'balance' | 'commodity' | 'txn';
  date: string;
  content: unknown;
}
