export function stringify(value: string | string[] | undefined): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join('');
  return value;
}

export function embedAttachments(
  source: string,
  attachments: { [s: string]: { [s: string]: string } } = {},
): string {
  let out = source;
  for (const [name, mimes] of Object.entries(attachments)) {
    const mime = Object.keys(mimes)[0];
    if (mime == null) continue;
    const data = `data:${mime};base64,${mimes[mime]}`;
    const re = new RegExp(`attachment:${escapeRegExp(name)}`, 'g');
    out = out.replace(re, data);
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
