import CryptoJS from 'crypto-js';

class EncryptionService {
  private secretKey: string;
  
  constructor() {
    // In production, this should come from environment variables
    this.secretKey = import.meta.env.VITE_ENCRYPTION_KEY || 'theracare-default-key-change-in-production';
  }

  /**
   * Encrypt sensitive data using AES encryption
   * @param data - The data to encrypt
   * @returns Encrypted string
   */
  encrypt(data: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(data, this.secretKey).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   * @param encryptedData - The encrypted data to decrypt
   * @returns Decrypted string
   */
  decrypt(encryptedData: string): string {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData, this.secretKey);
      const originalText = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!originalText) {
        throw new Error('Failed to decrypt - invalid data or key');
      }
      
      return originalText;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate a secure hash of the data (for integrity verification)
   * @param data - The data to hash
   * @returns SHA-256 hash
   */
  hash(data: string): string {
    try {
      return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
    } catch (error) {
      console.error('Hashing error:', error);
      throw new Error('Failed to hash data');
    }
  }

  /**
   * Generate a secure random string for tokens, IDs, etc.
   * @param length - The length of the random string
   * @returns Random hexadecimal string
   */
  generateSecureRandom(length: number = 32): string {
    try {
      return CryptoJS.lib.WordArray.random(length / 2).toString(CryptoJS.enc.Hex);
    } catch (error) {
      console.error('Random generation error:', error);
      throw new Error('Failed to generate secure random string');
    }
  }

  /**
   * Encrypt object data (converts to JSON first)
   * @param obj - Object to encrypt
   * @returns Encrypted string
   */
  encryptObject(obj: any): string {
    try {
      const jsonString = JSON.stringify(obj);
      return this.encrypt(jsonString);
    } catch (error) {
      console.error('Object encryption error:', error);
      throw new Error('Failed to encrypt object');
    }
  }

  /**
   * Decrypt object data (parses JSON after decryption)
   * @param encryptedData - Encrypted object data
   * @returns Decrypted object
   */
  decryptObject<T>(encryptedData: string): T {
    try {
      const decryptedString = this.decrypt(encryptedData);
      return JSON.parse(decryptedString) as T;
    } catch (error) {
      console.error('Object decryption error:', error);
      throw new Error('Failed to decrypt object');
    }
  }

  /**
   * Generate HMAC for data integrity verification
   * @param data - The data to generate HMAC for
   * @param key - Optional key (uses default if not provided)
   * @returns HMAC string
   */
  generateHMAC(data: string, key?: string): string {
    try {
      const hmacKey = key || this.secretKey;
      return CryptoJS.HmacSHA256(data, hmacKey).toString(CryptoJS.enc.Hex);
    } catch (error) {
      console.error('HMAC generation error:', error);
      throw new Error('Failed to generate HMAC');
    }
  }

  /**
   * Verify HMAC for data integrity
   * @param data - The original data
   * @param hmac - The HMAC to verify
   * @param key - Optional key (uses default if not provided)
   * @returns Boolean indicating if HMAC is valid
   */
  verifyHMAC(data: string, hmac: string, key?: string): boolean {
    try {
      const expectedHmac = this.generateHMAC(data, key);
      return hmac === expectedHmac;
    } catch (error) {
      console.error('HMAC verification error:', error);
      return false;
    }
  }

  /**
   * Encrypt data with timestamp and integrity check
   * @param data - Data to encrypt
   * @returns Encrypted payload with metadata
   */
  encryptWithMetadata(data: string): string {
    try {
      const timestamp = new Date().toISOString();
      const payload = {
        data,
        timestamp,
        checksum: this.hash(data),
      };
      
      return this.encrypt(JSON.stringify(payload));
    } catch (error) {
      console.error('Metadata encryption error:', error);
      throw new Error('Failed to encrypt data with metadata');
    }
  }

  /**
   * Decrypt data with timestamp and integrity verification
   * @param encryptedPayload - Encrypted data with metadata
   * @param maxAge - Maximum age in milliseconds (optional)
   * @returns Decrypted data
   */
  decryptWithMetadata(encryptedPayload: string, maxAge?: number): string {
    try {
      const decryptedString = this.decrypt(encryptedPayload);
      const payload = JSON.parse(decryptedString);
      
      // Verify data integrity
      const expectedChecksum = this.hash(payload.data);
      if (payload.checksum !== expectedChecksum) {
        throw new Error('Data integrity check failed');
      }
      
      // Check timestamp if maxAge is provided
      if (maxAge) {
        const payloadTime = new Date(payload.timestamp).getTime();
        const currentTime = new Date().getTime();
        
        if (currentTime - payloadTime > maxAge) {
          throw new Error('Data has expired');
        }
      }
      
      return payload.data;
    } catch (error) {
      console.error('Metadata decryption error:', error);
      throw new Error('Failed to decrypt data with metadata verification');
    }
  }

  /**
   * Clear sensitive data from memory (best effort)
   * @param data - Data to clear
   */
  clearSensitiveData(data: string): void {
    try {
      // This is a best-effort approach to clear sensitive data
      // Note: JavaScript doesn't provide guaranteed memory clearing
      if (typeof data === 'string') {
        // Overwrite the string content (limited effectiveness in JS)
        for (let i = 0; i < data.length; i++) {
          data = data.substring(0, i) + '0' + data.substring(i + 1);
        }
      }
    } catch (error) {
      console.error('Error clearing sensitive data:', error);
    }
  }

  /**
   * Validate encryption key strength
   * @param key - Key to validate
   * @returns Boolean indicating if key is strong enough
   */
  validateKeyStrength(key: string): boolean {
    try {
      // Minimum requirements for HIPAA compliance
      if (key.length < 16) return false; // Minimum 16 characters
      
      const hasUppercase = /[A-Z]/.test(key);
      const hasLowercase = /[a-z]/.test(key);
      const hasNumbers = /\d/.test(key);
      const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(key);
      
      // Require at least 3 of the 4 character types
      const characterTypes = [hasUppercase, hasLowercase, hasNumbers, hasSpecialChars];
      const typeCount = characterTypes.filter(Boolean).length;
      
      return typeCount >= 3;
    } catch (error) {
      console.error('Key validation error:', error);
      return false;
    }
  }
}

export const encryptionService = new EncryptionService();