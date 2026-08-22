import dns from 'node:dns/promises';
import net from 'node:net';
import { MAX_AUDIO_BYTES } from './audio.mjs';

const MAX_REDIRECTS = 2;
const REQUEST_TIMEOUT_MS = 15000;

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

function isPrivateIp(address) {
  const normalized = address.toLowerCase();
  if (net.isIPv4(normalized)) return isPrivateIpv4(normalized);
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:') || normalized.startsWith('::ffff:') && isPrivateIpv4(normalized.slice(7));
}

export async function assertPublicHttpsUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw Object.assign(new Error('audio URL must be valid HTTPS'), { code: 'invalid_url' });
  }
  if (url.protocol !== 'https:') throw Object.assign(new Error('audio URL must use HTTPS'), { code: 'invalid_url' });
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname === 'metadata.google.internal' || isPrivateIp(hostname)) {
    throw Object.assign(new Error('private, loopback, and metadata hosts are not allowed'), { code: 'blocked_host' });
  }
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw Object.assign(new Error('URL resolves to a private or restricted address'), { code: 'blocked_host' });
  }
  return url;
}

async function readBoundedBody(response, maxBytes) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw Object.assign(new Error('audio response exceeds size limit'), { code: 'media_too_large' });
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error('audio response exceeds size limit'), { code: 'media_too_large' });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

export async function fetchAudioUrl(value, { maxBytes = MAX_AUDIO_BYTES, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  let current = await assertPublicHttpsUrl(value);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(current, { redirect: 'manual', signal: controller.signal, headers: { accept: 'audio/*' } });
    } catch (error) {
      const wrapped = Object.assign(new Error(`audio fetch failed: ${error.message}`), { code: error.name === 'AbortError' ? 'source_timeout' : 'source_unreachable' });
      throw wrapped;
    } finally {
      clearTimeout(timeout);
    }
    if (response.status >= 300 && response.status < 400) {
      if (redirect === MAX_REDIRECTS) throw Object.assign(new Error('too many redirects'), { code: 'too_many_redirects' });
      const location = response.headers.get('location');
      if (!location) throw Object.assign(new Error('redirect did not provide a location'), { code: 'source_unreachable' });
      current = await assertPublicHttpsUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw Object.assign(new Error(`audio source returned HTTP ${response.status}`), { code: 'source_unreachable' });
    const buffer = await readBoundedBody(response, maxBytes);
    return {
      buffer,
      finalUrl: current.toString(),
      mimeType: (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() || null
    };
  }
  throw Object.assign(new Error('audio fetch failed'), { code: 'source_unreachable' });
}
