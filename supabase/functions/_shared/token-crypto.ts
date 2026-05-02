const ENCRYPTED_TOKEN_PREFIX = "enc:v1:";
const AES_GCM_IV_BYTES = 12;
const AES_KEY_BYTES = 32;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
let cachedKey: CryptoKey | null = null;

function requiredEncryptionSecret() {
  const value = Deno.env.get("GMAIL_TOKEN_ENCRYPTION_KEY")?.trim();
  if (!value) {
    throw new Error("Missing required secret: GMAIL_TOKEN_ENCRYPTION_KEY");
  }
  return value;
}

function base64ToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(value: Uint8Array) {
  let raw = "";
  value.forEach((byte) => {
    raw += String.fromCharCode(byte);
  });

  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    return null;
  }

  const bytes = new Uint8Array(AES_KEY_BYTES);
  for (let index = 0; index < AES_KEY_BYTES; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function readRawKeyBytes(secret: string) {
  const hexBytes = hexToBytes(secret);
  if (hexBytes) {
    return hexBytes;
  }

  try {
    const bytes = base64ToBytes(secret);
    if (bytes.length === AES_KEY_BYTES) {
      return bytes;
    }
  } catch {
    // Fall through to the explicit error below.
  }

  throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY must be a 32-byte base64/base64url or 64-character hex key.");
}

async function encryptionKey() {
  if (cachedKey) {
    return cachedKey;
  }

  cachedKey = await crypto.subtle.importKey(
    "raw",
    readRawKeyBytes(requiredEncryptionSecret()),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  return cachedKey;
}

export function isEncryptedGmailRefreshToken(value?: string | null) {
  return Boolean(value?.startsWith(ENCRYPTED_TOKEN_PREFIX));
}

export async function encryptGmailRefreshToken(value?: string | null) {
  if (!value) {
    return null;
  }

  if (isEncryptedGmailRefreshToken(value)) {
    return value;
  }

  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    textEncoder.encode(value),
  );

  return `${ENCRYPTED_TOKEN_PREFIX}${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptGmailRefreshToken(value?: string | null) {
  if (!value) {
    return null;
  }

  if (!isEncryptedGmailRefreshToken(value)) {
    return value;
  }

  const payload = value.slice(ENCRYPTED_TOKEN_PREFIX.length);
  const [ivPart, encryptedPart] = payload.split(".");
  if (!ivPart || !encryptedPart) {
    throw new Error("Stored Gmail refresh token is malformed.");
  }

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivPart) },
    await encryptionKey(),
    base64ToBytes(encryptedPart),
  );

  return textDecoder.decode(decrypted);
}
