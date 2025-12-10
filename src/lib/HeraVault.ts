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
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
      // The fix is here: casting salt to 'any' stops Vercel from blocking the build
      { name: "PBKDF2", salt: salt as any, iterations: VAULT_CONFIG.iterations, hash: VAULT_CONFIG.hash },
      keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
  }

  public static async lock(data: AppState, password: string): Promise<void> {
    try {
      const salt = window.crypto.getRandomValues(new Uint8Array(VAULT_CONFIG.saltLen));
      const iv = window.crypto.getRandomValues(new Uint8Array(VAULT_CONFIG.ivLen));
      const key = await this.deriveKey(password, salt);
      const enc = new TextEncoder();
      const encodedData = enc.encode(JSON.stringify(data));
      
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv }, key, encodedData
      );

      const vaultArtifact = {
        salt: this.bufferToBase64(salt),
        iv: this.bufferToBase64(iv),
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
    const stored = localStorage.getItem('HERA_VAULT_CORE');
    if (!stored) return null; 

    try {
      const vault = JSON.parse(stored);
      const salt = new Uint8Array(this.base64ToBuffer(vault.salt));
      const iv = new Uint8Array(this.base64ToBuffer(vault.iv));
      const data = this.base64ToBuffer(vault.data);
      const key = await this.deriveKey(password, salt);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv }, key, data
      );

      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decrypted));
    } catch (error) {
      throw new Error("ACCESS_DENIED: Decryption Failed."); 
    }
  }

  private static bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
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
