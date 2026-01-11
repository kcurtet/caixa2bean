import path from 'path';
import fs from 'fs';
import { ValidationError } from './errors.js';

export class PathValidator {
  /**
   * Validates that a file path is safe and doesn't attempt directory traversal
   */
  static validateSafePath(filePath: string, baseDir: string = process.cwd()): void {
    // Resolve the path to get absolute path
    const resolvedPath = path.resolve(baseDir, filePath);

    // Ensure the resolved path is within the base directory
    const relativePath = path.relative(baseDir, resolvedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new ValidationError(`Path traversal detected: ${filePath}`, 'filePath');
    }

    // Check for suspicious characters
    if (filePath.includes('..') || filePath.includes('\0')) {
      throw new ValidationError(`Invalid characters in path: ${filePath}`, 'filePath');
    }
  }

  /**
   * Validates file extension
   */
  static validateFileExtension(filePath: string, allowedExtensions: string[]): void {
    const ext = path.extname(filePath).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw new ValidationError(
        `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}, got: ${ext}`,
        'filePath'
      );
    }
  }

  /**
   * Validates that a directory path exists and is writable (for output)
   */
  static validateOutputDirectory(outputPath: string): void {
    const dir = path.dirname(path.resolve(outputPath));

    // Check if directory exists and is writable
    // Note: This is a basic check; actual file writing will catch permission issues
    try {
      fs.accessSync(dir, fs.constants.W_OK);
    } catch {
      throw new ValidationError(`Output directory is not writable: ${dir}`, 'outputPath');
    }
  }
}
