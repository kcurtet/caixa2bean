import fs from 'fs/promises';
import path from 'path';

export interface ConsolidatorConfig {
  enabled: boolean;
  requireRefund: boolean;
  preAuthThreshold: number;
  purchaseMinAmount: number;
  purchaseMaxAmount: number;
  timeWindowHours: number;
  strictMode: boolean;
  manualReviewEnabled: boolean;
}

export interface ConverterConfig {
  defaultAccount: string;
  fallbackAccount: string;
}

export interface AppConfig {
  consolidator: ConsolidatorConfig;
  converter: ConverterConfig;
}

export class ConfigManager {
  private static config: AppConfig | null = null;

  static async loadConfig(): Promise<AppConfig> {
    if (this.config) return this.config;

    try {
      const configPath = path.join(process.cwd(), 'config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(configData);
      return this.config!;
    } catch {
      // Fallback to default config
      console.warn('config.json not found, using default configuration');
      this.config = {
        consolidator: {
          enabled: true,
          requireRefund: true,
          preAuthThreshold: 2.5,
          purchaseMinAmount: 0.5,
          purchaseMaxAmount: 2.0,
          timeWindowHours: 24,
          strictMode: true,
          manualReviewEnabled: true,
        },
        converter: {
          defaultAccount: 'Assets:Bank:Caixa:Checking',
          fallbackAccount: 'Expenses:Unknown',
        },
      };
      return this.config;
    }
  }

  static async getConsolidatorConfig(): Promise<ConsolidatorConfig> {
    const config = await this.loadConfig();
    return config.consolidator;
  }

  static async getConverterConfig(): Promise<ConverterConfig> {
    const config = await this.loadConfig();
    return config.converter;
  }
}
