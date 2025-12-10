import { AppState } from './types';

const VAULT_CONFIG = {
  algo: 'AES-GCM',
  length: 256,
  hash: 'SHA-256',
  iterations: 600000, 
  saltLen: 16,
  ivLen: 12
};

export class HeraVault {
  
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    // SSR Guard: Prevent server-side crash during build
    if (typeof window === 'undefined') {
       // Return a dummy key or throw during build time if needed, 
       // but typically we just want to avoid the crash.
       throw new Error("Crypto unavailable on server");
    }

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
      // @ts-ignore - TS definition mismatch workaround
      { name: "PBKDF2", salt: salt, iterations: VAULT_CONFIG.iterations, hash: VAULT_CONFIG.hash },
      keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
  }

  public static async lock(data: AppState, password: string): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const salt = window.crypto.getRandomValues(new Uint8Array(VAULT_CONFIG.saltLen));
      const iv = window.crypto.getRandomValues(new Uint8Array(VAULT_CONFIG.ivLen));
      const key = await this.deriveKey(password, salt);
      const enc = new TextEncoder();
      const encodedData = enc.encode(JSON.stringify(data));
      
      const ciphertext = await window.crypto.subtle.encrypt(
        // @ts-ignore - TS definition mismatch workaround
        { name: "AES-GCM", iv: iv }, 
        key, 
        encodedData
      );

      const vaultArtifact = {
        // @ts-ignore - Force acceptance of Uint8Array
        salt: this.bufferToBase64(salt),
        // @ts-ignore - Force acceptance of Uint8Array
        iv: this.bufferToBase64(iv),
        // @ts-ignore - Force acceptance of ArrayBuffer
        data: this.bufferToBase64(ciphertext),
        version: "v1.0-forensic",
        timestamp: Date.now()
      };

      localStorage.setItem('HERA_VAULT_CORE', JSON.stringify(vaultArtifact));
    } catch (error) {
      console.error("VAULT_LOCK_FAILURE", error);
      throw new Error("Security Breach: Encryption Failed.");
    }
  }

  public static async unlock(password: string): Promise<AppState | null> {
    if (typeof window === 'undefined') return null;
    
    const stored = localStorage.getItem('HERA_VAULT_CORE');
    if (!stored) return null; 

    try {
      const vault = JSON.parse(stored);
      const salt = new Uint8Array(this.base64ToBuffer(vault.salt));
      const iv = new Uint8Array(this.base64ToBuffer(vault.iv));
      const data = this.base64ToBuffer(vault.data);
      const key = await this.deriveKey(password, salt);

      const decrypted = await window.crypto.subtle.decrypt(
        // @ts-ignore - TS definition mismatch workaround
        { name: "AES-GCM", iv: iv }, 
        key, 
        data
      );

      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decrypted));
    } catch (error) {
      throw new Error("ACCESS_DENIED: Decryption Failed."); 
    }
  }

  // Relaxed type to 'any' to swallow all buffer type mismatches
  private static bufferToBase64(buffer: any): string {
    let bytes: Uint8Array;
    if (buffer instanceof Uint8Array) {
      bytes = buffer;
    } else {
      bytes = new Uint8Array(buffer);
    }
    
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private static base64ToBuffer(base64: string): ArrayBuffer {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary_string.charCodeAt(i);
    return bytes.buffer;
  }
}


