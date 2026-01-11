import { ExcelTransaction } from './types.js';
import { ConfigManager, ConsolidatorConfig } from './config.js';

interface ConsolidationCandidate {
  transactions: ExcelTransaction[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  suggestedAccount: string;
}

export class TransactionConsolidator {
  private static config: ConsolidatorConfig | null = null;

  static async consolidate(transactions: ExcelTransaction[]): Promise<ExcelTransaction[]> {
    const config = await ConfigManager.getConsolidatorConfig();
    if (!config.enabled) return transactions;

    const processed = new Set<string>();
    const consolidated: ExcelTransaction[] = [];
    const manualReview: ConsolidationCandidate[] = [];

    // Sort by date and time
    const sorted = transactions.sort((a, b) => {
      const dateCompare = a.transactionDate.localeCompare(b.transactionDate);
      if (dateCompare !== 0) return dateCompare;
      // If same date, assume sequential order (could be improved with timestamps if available)
      return 0;
    });

    for (let i = 0; i < sorted.length; i++) {
      if (processed.has(this.getTransactionId(sorted[i]))) continue;

      const candidate = this.detectPreAuthPattern(sorted, i, config);
      if (candidate) {
        if (candidate.confidence === 'high') {
          // Auto-consolidate high confidence patterns
          const consolidatedTxn = this.createConsolidatedTransaction(candidate, config);
          consolidated.push(consolidatedTxn);
          candidate.transactions.forEach((txn) => processed.add(this.getTransactionId(txn)));
        } else if (config.manualReviewEnabled) {
          // Flag for manual review
          manualReview.push(candidate);
          // Still process individual transactions
          consolidated.push(sorted[i]);
        } else {
          consolidated.push(sorted[i]);
        }
      } else {
        consolidated.push(sorted[i]);
      }
    }

    // Add manual review comments to output (this will be handled in the converter)
    this.manualReviewCandidates = manualReview;

    return consolidated;
  }

  private static manualReviewCandidates: ConsolidationCandidate[] = [];

  static getManualReviewCandidates(): ConsolidationCandidate[] {
    return this.manualReviewCandidates;
  }

  private static detectPreAuthPattern(
    transactions: ExcelTransaction[],
    startIndex: number,
    config: ConsolidatorConfig
  ): ConsolidationCandidate | null {
    const candidate = transactions[startIndex];

    // Check if this is a refund (start from refunds and work backwards)
    if (!this.isRefundCandidate(candidate)) return null;

    // Look backwards for the actual purchase
    const purchase = this.findPrecedingPurchase(transactions, startIndex, candidate, config);
    if (!purchase) return null;

    // Look backwards for the pre-auth charge
    const preAuth = this.findPrecedingPreAuth(transactions, startIndex, candidate, purchase);
    if (!preAuth) return null;

    const patternTransactions = [preAuth, purchase, candidate];

    return {
      transactions: patternTransactions,
      confidence: this.calculateConfidence(preAuth, purchase, candidate),
      reasoning: this.generateReasoning(preAuth, purchase, candidate),
      suggestedAccount: 'Expenses:Food:Snacks',
    };
  }

  private static isRefundCandidate(txn: ExcelTransaction): boolean {
    if (!txn.creditAmount || txn.creditAmount <= 0) return false;

    const description = this.buildDescription(txn).toLowerCase();
    return description.includes('devolucion') && description.includes('compra');
  }

  private static findPrecedingPurchase(
    transactions: ExcelTransaction[],
    refundIndex: number,
    refund: ExcelTransaction,
    config: ConsolidatorConfig
  ): ExcelTransaction | null {
    // Look backwards for a small purchase on the same date with same card
    for (let i = refundIndex - 1; i >= 0 && i > refundIndex - 10; i--) {
      const txn = transactions[i];
      if (txn.transactionDate !== refund.transactionDate) break;
      if (txn.referencia2 !== refund.referencia2) continue;

      if (
        txn.debitAmount &&
        txn.debitAmount >= config.purchaseMinAmount &&
        txn.debitAmount <= config.purchaseMaxAmount &&
        this.buildDescription(txn).toLowerCase().includes('compra con tarjeta')
      ) {
        return txn;
      }
    }
    return null;
  }

  private static findPrecedingPreAuth(
    transactions: ExcelTransaction[],
    refundIndex: number,
    refund: ExcelTransaction,
    _purchase: ExcelTransaction
  ): ExcelTransaction | null {
    // Look backwards for a charge matching the refund amount
    for (let i = refundIndex - 1; i >= 0 && i > refundIndex - 15; i--) {
      const txn = transactions[i];
      if (txn.transactionDate !== refund.transactionDate) break;
      if (txn.referencia2 !== refund.referencia2) continue;

      if (txn.debitAmount === refund.creditAmount) {
        // Found a charge matching the refund amount
        return txn;
      }
    }
    return null;
  }

  private static calculateConfidence(
    preAuth: ExcelTransaction,
    purchase: ExcelTransaction,
    refund: ExcelTransaction
  ): 'high' | 'medium' | 'low' {
    let score = 0;

    // Pre-auth from known vending machine
    if (
      this.buildDescription(preAuth).toLowerCase().includes('vending') ||
      this.buildDescription(preAuth).toLowerCase().includes('serunion')
    ) {
      score += 2;
    }

    // Refund present and matches pre-auth amount
    if (refund && refund.creditAmount === preAuth.debitAmount) score += 2;

    // Purchase amount in expected range
    if (purchase.debitAmount! >= 0.5 && purchase.debitAmount! <= 1.5) score += 1;

    // All transactions on same card
    if (preAuth.referencia2 === purchase.referencia2 && purchase.referencia2 === refund.referencia2)
      score += 1;

    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  private static generateReasoning(
    preAuth: ExcelTransaction,
    purchase: ExcelTransaction,
    refund: ExcelTransaction
  ): string {
    const parts = [
      `Pre-auth: ${this.buildDescription(preAuth)} (${preAuth.debitAmount}€)`,
      `Purchase: ${this.buildDescription(purchase)} (${purchase.debitAmount}€)`,
      `Refund: ${this.buildDescription(refund)} (${refund.creditAmount}€)`,
    ];

    return parts.join(', ');
  }

  private static createConsolidatedTransaction(
    candidate: ConsolidationCandidate,
    config: ConsolidatorConfig
  ): ExcelTransaction {
    const purchase = candidate.transactions.find(
      (t) => t.debitAmount && t.debitAmount < config.preAuthThreshold
    )!;
    const preAuth = candidate.transactions.find(
      (t) => t.debitAmount && t.debitAmount >= config.preAuthThreshold
    )!;

    // Create consolidated transaction based on the purchase
    return {
      ...purchase,
      conceptoComplementario1: this.generateConsolidatedDescription(preAuth, purchase),
      // The amount remains the actual purchase amount
    };
  }

  private static generateConsolidatedDescription(
    preAuth: ExcelTransaction,
    purchase: ExcelTransaction
  ): string {
    const preAuthDesc = this.buildDescription(preAuth);
    const purchaseAmount = purchase.debitAmount || 0;

    // Try to infer item type from amount
    let itemType = 'Item';
    if (purchaseAmount <= 0.6) itemType = 'Snack';
    else if (purchaseAmount <= 1.2) itemType = 'Drink';
    else itemType = 'Purchase';

    return `${preAuthDesc} - ${itemType}`;
  }

  private static buildDescription(txn: ExcelTransaction): string {
    const parts = [
      txn.conceptoComplementario1,
      txn.conceptoComplementario9,
      txn.conceptoComplementario2,
    ].filter(Boolean);

    return parts.join(' - ').trim() || 'Transaction';
  }

  private static getTransactionId(txn: ExcelTransaction): string {
    return `${txn.transactionDate}-${txn.referencia2}-${txn.debitAmount || 0}-${txn.creditAmount || 0}`;
  }
}
