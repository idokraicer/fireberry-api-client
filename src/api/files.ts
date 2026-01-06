import type { FireberryClient } from '../client';
import { FireberryError, FireberryErrorCode } from '../errors';

/**
 * Options for file upload
 */
export interface FileUploadOptions {
  /** File content as Buffer */
  buffer: Buffer;
  /** File name */
  filename: string;
  /** MIME type */
  mimeType: string;
}

/**
 * Result of file upload
 */
export interface FileUploadResult {
  /** Success flag */
  success: boolean;
  /** Object type */
  objectType: string;
  /** Record ID */
  recordId: string;
  /** Uploaded file name */
  fileName: string;
  /** File MIME type */
  mimeType: string;
  /** File size in bytes */
  fileSize: number;
  /** API response */
  response: unknown;
}

/**
 * Files API for file operations in Fireberry
 */
export class FilesAPI {
  constructor(private readonly client: FireberryClient) {}

  /**
   * Uploads a file attachment to a Fireberry record
   *
   * @param objectType - The object type ID
   * @param recordId - The record ID to attach the file to
   * @param options - File upload options
   * @param signal - Optional AbortSignal for cancellation
   * @returns Upload result
   *
   * @example
   * ```typescript
   * import { readFileSync } from 'fs';
   *
   * const fileBuffer = readFileSync('document.pdf');
   * const result = await client.files.upload('1', 'abc123', {
   *   buffer: fileBuffer,
   *   filename: 'document.pdf',
   *   mimeType: 'application/pdf',
   * });
   * ```
   */
  async upload(
    objectType: string | number,
    recordId: string,
    options: FileUploadOptions,
    signal?: AbortSignal,
  ): Promise<FileUploadResult> {
    const objectTypeStr = String(objectType);
    const { buffer, filename, mimeType } = options;
    const config = this.client.getConfig();

    // Build the URL
    const url = `${config.baseUrl}/api/v2/record/${objectTypeStr}/${recordId}/files?tokenid=${config.apiKey}`;

    // Create form data
    // Note: In Node.js, we need to construct multipart/form-data manually
    // or use a library like form-data
    const boundary = `----FormBoundary${Date.now()}`;
    const formParts: Buffer[] = [];

    // Add file part
    const fileHeader = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      `Content-Type: ${mimeType}`,
      '',
      '',
    ].join('\r\n');

    formParts.push(Buffer.from(fileHeader));
    formParts.push(buffer);
    formParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(formParts);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
        signal,
      });

      if (!response.ok) {
        throw new FireberryError(`File upload failed: ${response.statusText}`, {
          code: FireberryErrorCode.INVALID_REQUEST,
          statusCode: response.status,
        });
      }

      const responseData = await response.json();

      return {
        success: true,
        objectType: objectTypeStr,
        recordId,
        fileName: filename,
        mimeType,
        fileSize: buffer.length,
        response: responseData,
      };
    } catch (error) {
      if (error instanceof FireberryError) {
        throw error;
      }
      throw new FireberryError(`File upload failed: ${(error as Error).message}`, {
        code: FireberryErrorCode.NETWORK_ERROR,
        cause: error as Error,
      });
    }
  }
}
