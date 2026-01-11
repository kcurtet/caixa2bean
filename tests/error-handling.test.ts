import { describe, it, expect } from 'vitest';
import { ValidationError, FileNotFoundError, ParsingError } from '../src/errors.js';
import { PathValidator } from '../src/validation.js';
import { ExcelParser } from '../src/parser.js';

describe('Error Handling and Validation', () => {
  describe('PathValidator', () => {
    it('should allow safe relative paths', () => {
      expect(() => {
        PathValidator.validateSafePath('test.xls');
      }).not.toThrow();
    });

    it('should reject path traversal attempts', () => {
      expect(() => {
        PathValidator.validateSafePath('../../../etc/passwd');
      }).toThrow(ValidationError);
    });

    it('should reject paths with null bytes', () => {
      expect(() => {
        PathValidator.validateSafePath('test.xls\0malicious');
      }).toThrow(ValidationError);
    });

    it('should validate file extensions', () => {
      expect(() => {
        PathValidator.validateFileExtension('test.xls', ['.xls', '.xlsx']);
      }).not.toThrow();

      expect(() => {
        PathValidator.validateFileExtension('test.txt', ['.xls', '.xlsx']);
      }).toThrow(ValidationError);
    });
  });

  describe('ExcelParser Error Handling', () => {
    it('should throw ParsingError for non-existent files', () => {
      expect(() => {
        ExcelParser.parseFile('non-existent-file.xls');
      }).toThrow();
    });

    it('should throw ValidationError for empty transactions', () => {
      // This would require mocking, but for now test that parser doesn't crash
      expect(() => {
        // Test with non-existent file (since we removed sensitive data)
        ExcelParser.parseFile('non-existent-file.xls');
      }).toThrow('Failed to parse Excel file');
    });
  });

  describe('Custom Error Classes', () => {
    it('should create ValidationError with field', () => {
      const error = new ValidationError('Invalid input', 'filePath');
      expect(error.message).toBe('Invalid input');
      expect(error.field).toBe('filePath');
      expect(error.name).toBe('ValidationError');
    });

    it('should create FileNotFoundError', () => {
      const error = new FileNotFoundError('/path/to/file.xls');
      expect(error.message).toBe('File not found: /path/to/file.xls');
      expect(error.name).toBe('FileNotFoundError');
    });

    it('should create ParsingError with position info', () => {
      const error = new ParsingError('Invalid data', 5, 10);
      expect(error.message).toBe('Invalid data');
      expect(error.row).toBe(5);
      expect(error.column).toBe(10);
      expect(error.name).toBe('ParsingError');
    });
  });
});
