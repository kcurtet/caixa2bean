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
- Automatic transaction categorization
- Generates proper Beancount double-entry format
- Includes opening/closing balance assertions
- Supports custom account names

## Transaction Categories

The tool automatically categorizes transactions based on keywords:

- **Fuel**: Shell, fuel-related purchases
- **Groceries**: Amazon, Lidl purchases
- **Food**: Vending machines, snacks
- **Entertainment**: Steam purchases
- **Transfers**: Bizum, internal transfers
- **Unknown**: Everything else

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