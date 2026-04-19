import { describe, it, expect } from 'vitest';

import { embedAttachments, stringify } from './util';

describe('stringify', () => {
  it('returns empty string for null/undefined', () => {
    expect(stringify(undefined)).toBe('');
    expect(stringify(null as unknown as undefined)).toBe('');
  });

  it('joins arrays without separators', () => {
    expect(stringify(['a', 'b', 'c'])).toBe('abc');
    expect(stringify(['line1\n', 'line2\n'])).toBe('line1\nline2\n');
  });

  it('passes strings through', () => {
    expect(stringify('hello')).toBe('hello');
  });
});

describe('embedAttachments', () => {
  it('replaces attachment: refs with data URIs', () => {
    const source = '![alt](attachment:logo.png)';
    const out = embedAttachments(source, {
      'logo.png': { 'image/png': 'BASE64=' },
    });
    expect(out).toBe('![alt](data:image/png;base64,BASE64=)');
  });

  it('escapes regex metachars in attachment names', () => {
    const out = embedAttachments('attachment:fig.1.png', {
      'fig.1.png': { 'image/png': 'B=' },
    });
    expect(out).toBe('data:image/png;base64,B=');
  });

  it('leaves source untouched when attachments is empty', () => {
    expect(embedAttachments('hello', {})).toBe('hello');
    expect(embedAttachments('hello')).toBe('hello');
  });
});
