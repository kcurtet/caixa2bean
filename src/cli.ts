#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { ExcelParser } from './parser.js';
import { BeancountConverter } from './converter.js';
import { PathValidator } from './validation.js';
import { FileNotFoundError, InvalidFileFormatError, ValidationError } from './errors.js';

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
  .option('--account <name>', 'Beancount account name')
  .action(async (input: string, output: string, options: { account?: string }) => {
    try {
      // Validate input file path
      PathValidator.validateSafePath(input);
      PathValidator.validateFileExtension(input, ['.xls', '.xlsx']);

      // Check if input file exists
      if (!fs.existsSync(input)) {
        throw new FileNotFoundError(input);
      }

      // Validate output path and directory
      PathValidator.validateSafePath(output);
      PathValidator.validateOutputDirectory(output);

      // Parse the Excel file
      console.log(`📄 Parsing ${input}...`);
      const parsedData = ExcelParser.parseFile(input);

      if (parsedData.transactions.length === 0) {
        throw new ValidationError('No transactions found in the input file', 'transactions');
      }

      // Convert to Beancount
      console.log(
        `🔄 Converting ${parsedData.transactions.length} transactions to Beancount format...`
      );
      const beancountOutput = await BeancountConverter.convert(parsedData, options.account);

      // Ensure output directory exists
      const outputDir = path.dirname(output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write output file
      fs.writeFileSync(output, beancountOutput, 'utf8');
      console.log(`✅ Successfully converted ${parsedData.transactions.length} transactions`);
      console.log(`💾 Output written to ${output}`);
      console.log(`📊 Period: ${parsedData.period.start} to ${parsedData.period.end}`);
      console.log(
        `💰 Opening balance: ${parsedData.openingBalance.toFixed(2)} ${parsedData.currency}`
      );
      console.log(
        `💰 Closing balance: ${parsedData.closingBalance.toFixed(2)} ${parsedData.currency}`
      );
    } catch (error) {
      if (error instanceof ValidationError) {
        console.error(`❌ Validation Error: ${error.message}`);
        if (error.field) {
          console.error(`   Field: ${error.field}`);
        }
      } else if (error instanceof FileNotFoundError) {
        console.error(`❌ File Error: ${error.message}`);
      } else if (error instanceof InvalidFileFormatError) {
        console.error(`❌ Format Error: ${error.message}`);
      } else {
        console.error('❌ Unexpected Error:', error instanceof Error ? error.message : error);
      }
      process.exit(1);
    }
  });

program.parse();
