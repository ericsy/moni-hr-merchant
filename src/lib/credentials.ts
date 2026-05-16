const STORAGE_KEY = "moni_hr_remember_credentials";

function getEncryptionKey(): Promise<CryptoKey> {
  const keyData = localStorage.getItem("moni_hr_crypto_key");
  if (keyData) {
    return crypto.subtle.importKey(
      "raw",
      Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0)),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  }
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]).then((key) =>
    crypto.subtle.exportKey("raw", key).then((raw) => {
      localStorage.setItem("moni_hr_crypto_key", btoa(String.fromCharCode(...new Uint8Array(raw))));
      return key;
    }),
  );
}

export async function encryptCredentials(email: string, password: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify({ email, password }));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptCredentials(cipherText: string): Promise<{ email: string; password: string } | null> {
  try {
    const key = await getEncryptionKey();
    const combined = Uint8Array.from(atob(cipherText), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    return null;
  }
}

export function saveCredentials(cipherText: string): void {
  localStorage.setItem(STORAGE_KEY, cipherText);
}

export function loadCredentials(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}
