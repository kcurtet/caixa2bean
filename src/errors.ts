export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class FileNotFoundError extends Error {
  constructor(filePath: string) {
    super(`File not found: ${filePath}`);
    this.name = 'FileNotFoundError';
  }
}

export class InvalidFileFormatError extends Error {
  constructor(filePath: string, expectedFormat: string) {
    super(`Invalid file format for ${filePath}. Expected: ${expectedFormat}`);
    this.name = 'InvalidFileFormatError';
  }
}

export class ParsingError extends Error {
  constructor(
    message: string,
    public readonly row?: number,
    public readonly column?: number
  ) {
    super(message);
    this.name = 'ParsingError';
  }
}

export class ConfigurationError extends Error {
  constructor(
    message: string,
    public readonly configPath?: string
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
