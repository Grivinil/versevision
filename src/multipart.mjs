function fail(code, message) {
  return Object.assign(new Error(message), { code });
}

function parseDisposition(value) {
  const match = value.match(/name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
  if (!match) throw fail('invalid_multipart', 'multipart part is missing Content-Disposition name');
  return { name: match[1], filename: match[2] || null };
}

export function parseMultipartBody(buffer, contentType) {
  if (!Buffer.isBuffer(buffer)) throw fail('invalid_multipart', 'multipart body must be a Buffer');
  const boundaryMatch = String(contentType || '').match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  if (!boundaryMatch) throw fail('invalid_multipart', 'multipart content type must include a boundary');
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const delimiter = Buffer.from(`--${boundary}`);
  const headerDelimiter = Buffer.from('\r\n\r\n');
  const lineBreak = Buffer.from('\r\n');
  const parts = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const start = buffer.indexOf(delimiter, cursor);
    if (start < 0) break;
    let partStart = start + delimiter.length;
    if (buffer.subarray(partStart, partStart + 2).equals(Buffer.from('--'))) break;
    if (!buffer.subarray(partStart, partStart + 2).equals(lineBreak)) throw fail('invalid_multipart', 'multipart boundary framing is invalid');
    partStart += 2;
    const headerEnd = buffer.indexOf(headerDelimiter, partStart);
    if (headerEnd < 0) throw fail('invalid_multipart', 'multipart part headers are incomplete');
    const headers = {};
    for (const line of buffer.toString('utf8', partStart, headerEnd).split('\r\n')) {
      const separator = line.indexOf(':');
      if (separator < 1) throw fail('invalid_multipart', 'multipart part contains an invalid header');
      headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    }
    const disposition = parseDisposition(headers['content-disposition'] || '');
    if (!['spec', 'audio'].includes(disposition.name)) throw fail('invalid_multipart', `unknown multipart field: ${disposition.name}`);
    const dataStart = headerEnd + headerDelimiter.length;
    const nextBoundary = buffer.indexOf(delimiter, dataStart);
    if (nextBoundary < 0) throw fail('invalid_multipart', 'multipart part has no closing boundary');
    const dataEnd = nextBoundary >= 2 && buffer.subarray(nextBoundary - 2, nextBoundary).equals(lineBreak) ? nextBoundary - 2 : nextBoundary;
    if (parts.some((part) => part.name === disposition.name)) throw fail('invalid_multipart', `duplicate multipart field: ${disposition.name}`);
    parts.push({ name: disposition.name, filename: disposition.filename, mimeType: (headers['content-type'] || '').split(';')[0].trim().toLowerCase() || null, data: buffer.subarray(dataStart, dataEnd) });
    cursor = nextBoundary;
  }

  const spec = parts.find((part) => part.name === 'spec');
  const audio = parts.find((part) => part.name === 'audio');
  if (!spec) throw fail('invalid_multipart', 'multipart request requires a spec field');
  if (!audio) throw fail('invalid_multipart', 'multipart request requires an audio field');
  return { spec: spec.data.toString('utf8'), audio };
}
