export function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

export function parseHex(value) {
  if (!value) return null;
  const clean = value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return Number.parseInt(clean, 16);
}

export function validSnowflake(value) {
  return /^\d{15,22}$/.test(String(value ?? '').trim());
}

export function validCustomId(value) {
  const str = String(value ?? '');
  return str.length >= 1 && str.length <= 100;
}

export function trimText(value, max) {
  return String(value ?? '').slice(0, max);
}

export async function fetchImageBuffer(url) {
  if (!isHttpUrl(url)) throw new Error('URL inválida.');
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Falha ao baixar imagem (${response.status}).`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error('A URL não aponta para uma imagem.');
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 10 * 1024 * 1024) throw new Error('Imagem muito grande.');
  return Buffer.from(await response.arrayBuffer());
}
