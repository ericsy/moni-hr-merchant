const STORAGE_KEY = "moni_hr_remember_credentials";
const CRYPTO_KEY_STORAGE_KEY = "moni_hr_crypto_key";
const PLAIN_TEXT_PREFIX = "plain:";

function serializePlainCredentials(email: string, password: string) {
  return `${PLAIN_TEXT_PREFIX}${JSON.stringify({ email, password })}`;
}

function parsePlainCredentials(cipherText: string) {
  if (!cipherText.startsWith(PLAIN_TEXT_PREFIX)) return null;

  const parsed = JSON.parse(cipherText.slice(PLAIN_TEXT_PREFIX.length)) as {
    email?: unknown;
    password?: unknown;
  };
  if (typeof parsed.email !== "string" || typeof parsed.password !== "string") {
    return null;
  }

  return {
    email: parsed.email,
    password: parsed.password,
  };
}

function getSubtleCrypto() {
  return globalThis.crypto?.subtle ?? null;
}

function getEncryptionKey(): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  if (!subtle) {
    return Promise.reject(
      new Error("Web Crypto is unavailable in the current browser context"),
    );
  }

  const keyData = localStorage.getItem(CRYPTO_KEY_STORAGE_KEY);
  if (keyData) {
    return subtle.importKey(
      "raw",
      Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0)),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  }
  return subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]).then((key) =>
    subtle.exportKey("raw", key).then((raw) => {
      localStorage.setItem(CRYPTO_KEY_STORAGE_KEY, btoa(String.fromCharCode(...new Uint8Array(raw))));
      return key;
    }),
  );
}

export async function encryptCredentials(email: string, password: string): Promise<string> {
  const subtle = getSubtleCrypto();
  if (!subtle) {
    return serializePlainCredentials(email, password);
  }

  const key = await getEncryptionKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify({ email, password }));
  const encrypted = await subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptCredentials(cipherText: string): Promise<{ email: string; password: string } | null> {
  try {
    const plainCredentials = parsePlainCredentials(cipherText);
    if (plainCredentials) return plainCredentials;

    const subtle = getSubtleCrypto();
    if (!subtle) return null;

    const key = await getEncryptionKey();
    const combined = Uint8Array.from(atob(cipherText), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await subtle.decrypt({ name: "AES-GCM", iv }, key, data);
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
