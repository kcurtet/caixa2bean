#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { ExcelParser } from './parser.js';
import { BeancountConverter } from './converter.js';

const program = new Command();

program
  .name('caixa2bean')
  .description('Convert Caixa bank Excel statements to Beancount format')
  .version('1.0.0');

program
  .command('convert')
  .description('Convert Caixa Excel statement to Beancount')
  .argument('<input>', 'Input Excel file path (.XLS)')
  .argument('<output>', 'Output Beancount file path (.beancount)')
  .option('--account <name>', 'Beancount account name', 'Assets:Bank:Caixa:Checking')
  .action((input: string, output: string, options: { account: string }) => {
    try {
      // Validate input file
      if (!fs.existsSync(input)) {
        console.error(`❌ Error: Input file '${input}' does not exist`);
        process.exit(1);
      }

      const ext = path.extname(input).toLowerCase();
      if (ext !== '.xls' && ext !== '.xlsx') {
        console.error(`❌ Error: Input file must be .xls or .xlsx format`);
        process.exit(1);
      }

      // Parse the Excel file
      console.log(`📄 Parsing ${input}...`);
      const parsedData = ExcelParser.parseFile(input);

      if (parsedData.transactions.length === 0) {
        console.error(`❌ Error: No transactions found in the file`);
        process.exit(1);
      }

      // Convert to Beancount
      console.log(`🔄 Converting ${parsedData.transactions.length} transactions to Beancount format...`);
      const beancountOutput = BeancountConverter.convert(parsedData, options.account);

      // Validate output directory
      const outputDir = path.dirname(output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write output file
      fs.writeFileSync(output, beancountOutput, 'utf8');
      console.log(`✅ Successfully converted ${parsedData.transactions.length} transactions`);
      console.log(`💾 Output written to ${output}`);
      console.log(`📊 Period: ${parsedData.period.start} to ${parsedData.period.end}`);
      console.log(`💰 Opening balance: ${parsedData.openingBalance.toFixed(2)} ${parsedData.currency}`);
      console.log(`💰 Closing balance: ${parsedData.closingBalance.toFixed(2)} ${parsedData.currency}`);

    } catch (error) {
      console.error('❌ Error during conversion:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();