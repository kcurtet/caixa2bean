# Caixa2Bean

Convert Caixa bank Excel statements to Beancount format.

## Installation

```bash
npm install -g .
```

## Usage

```bash
caixa2bean convert input.xls output.beancount
```

### Options

- `--account <name>`: Custom Beancount account name (default: `Assets:Bank:Caixa:Checking`)

### Example

```bash
caixa2bean convert TT010126.912.XLS my-finances.beancount --account Assets:Bank:Spain:Caixa
```

## Features

- Parses Caixa Excel bank statements
- Advanced automatic transaction categorization with configurable rules
- Transaction consolidation for complex payment patterns (vending machines, pre-auths)
- Smart fallback categorization based on amount and description patterns
- Generates proper Beancount double-entry format
- Includes opening/closing balance assertions
- Supports custom account names
- Configurable merchant categorization via JSON rules

## Transaction Categories

The tool automatically categorizes transactions using a configurable rules system. By default, it includes rules for common merchants, but you can customize categorization by creating a `merchants.json` file.

### Configuration

Create a `merchants.json` file in your project directory to customize transaction categorization:

```json
{
  "rules": [
    {
      "keywords": ["shell", "fuel"],
      "account": "Expenses:Transportation:Fuel",
      "description": "Gas stations"
    },
    {
      "keywords": ["amazon", "lidl"],
      "account": "Expenses:Groceries",
      "description": "Online and physical stores"
    }
  ],
  "patterns": [
    {
      "regex": "\\b\\w+;\\w+\\b",
      "account": "Expenses:Personal:Transfers",
      "description": "Personal transfers"
    }
  ],
  "fallbacks": [
    {
      "condition": "amount <= 2.00 AND description CONTAINS 'compra con tarjeta'",
      "account": "Expenses:Food:Snacks",
      "description": "Small purchases likely vending machines"
    }
  ]
}
```

See `example-merchants.json` for a comprehensive example with many common Spanish merchants.

### Transaction Consolidation

The tool automatically detects and consolidates complex transaction patterns, such as vending machine pre-authorizations:

**Before (3 separate transactions):**
```
2025-12-31 * "SERUNION VENDING - Pre-auth" -3.00€
2025-12-31 * "COMPRA CON TARJETA - Purchase" -0.50€  
2025-12-31 * "DEVOLUCION COMPRA - Refund" +3.00€
```

**After (1 consolidated transaction):**
```
2025-12-31 * "SERUNION VENDING - Snack" -0.50€
```

This feature automatically handles pre-auth patterns for vending machines and other services.

### Default Categories

The tool includes built-in rules for:
- **Fuel**: Shell, fuel-related purchases
- **Groceries**: Amazon, Lidl, Mercadona purchases
- **Food**: Vending machines, snacks, restaurants
- **Entertainment**: Netflix, Steam, cinema
- **Software**: GitHub, development tools
- **Transportation**: Public transport, fuel
- **Bank Fees**: ATM withdrawals, card fees
- **Income**: Salary, transfers
- **Unknown**: Transactions that don't match any rules

## Testing

The project includes unit tests with mock data. For integration testing with real Excel files:

1. Use the `sample-statement.csv` file as a reference for the expected Excel format
2. Convert CSV to Excel format if needed for testing
3. The tests use mock data to avoid requiring actual bank statements

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run CLI
npm start
```

## License

ISC