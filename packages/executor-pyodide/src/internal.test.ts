import { describe, it, expect } from 'vitest';

import {
  deriveIndexURL,
  isPython,
  makeError,
  normalizeMime,
  toArray,
  toErrorOutput,
} from './internal';

describe('toArray', () => {
  it('returns undefined for undefined', () => {
    expect(toArray(undefined)).toBeUndefined();
  });
  it('wraps a scalar', () => {
    expect(toArray('a')).toEqual(['a']);
  });
  it('passes an array through', () => {
    expect(toArray(['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('deriveIndexURL', () => {
  it('strips the filename but keeps the trailing slash', () => {
    expect(deriveIndexURL('https://cdn.example/pyodide/v1/pyodide.js')).toBe(
      'https://cdn.example/pyodide/v1/',
    );
  });
  it('returns the input unchanged when there is no slash', () => {
    expect(deriveIndexURL('pyodide.js')).toBe('pyodide.js');
  });
});

describe('isPython', () => {
  it('accepts python aliases', () => {
    for (const l of ['python', 'py', 'python3']) expect(isPython(l)).toBe(true);
  });
  it('rejects other languages', () => {
    for (const l of ['r', 'julia', 'javascript', 'Python']) {
      expect(isPython(l)).toBe(false);
    }
  });
});

describe('normalizeMime', () => {
  it('drops null/undefined entries', () => {
    expect(normalizeMime({ 'text/plain': null, 'text/html': undefined })).toEqual(
      {},
    );
  });
  it('preserves array values (multiline text)', () => {
    const out = normalizeMime({ 'text/plain': ['a\n', 'b\n'] });
    expect(out['text/plain']).toEqual(['a\n', 'b\n']);
  });
  it('keeps structured objects for +json mime types', () => {
    const model = { model_id: 'abc', version_major: 2, version_minor: 0 };
    const out = normalizeMime({
      'application/vnd.jupyter.widget-view+json': model,
    });
    // Must stay an object — stringifying would break widgets' model_id lookup.
    expect(out['application/vnd.jupyter.widget-view+json']).toEqual(model);
  });
  it('keeps structured objects for application/json', () => {
    const out = normalizeMime({ 'application/json': { a: 1 } });
    expect(out['application/json']).toEqual({ a: 1 });
  });
  it('stringifies scalar values for non-json mime types', () => {
    const out = normalizeMime({ 'text/plain': 42 });
    expect(out['text/plain']).toBe('42');
  });
});

describe('toErrorOutput', () => {
  it('splits ename/evalue from the last traceback line', () => {
    const out = toErrorOutput({
      name: 'ValueError',
      message: 'bad value',
      traceback: ['Traceback (most recent call last):', 'ValueError: bad value'],
    });
    expect(out.output_type).toBe('error');
    expect(out.ename).toBe('ValueError');
    expect(out.evalue).toBe('bad value');
    expect(out.traceback).toHaveLength(2);
  });
  it('strips ANSI escape codes when deriving evalue', () => {
    const out = toErrorOutput({
      name: 'NameError',
      message: 'x is not defined',
      traceback: ['\x1b[0;31mNameError\x1b[0m: x is not defined'],
    });
    expect(out.evalue).toBe('x is not defined');
  });
  it('falls back to message when traceback is empty', () => {
    const out = toErrorOutput({ name: 'E', message: 'line1\nline2' });
    expect(out.traceback).toEqual(['line1', 'line2']);
  });
  it('defaults ename when missing', () => {
    const out = toErrorOutput({ message: 'boom' });
    expect(out.ename).toBe('PythonError');
  });
});

describe('makeError', () => {
  it('builds an error output with a single traceback line', () => {
    expect(makeError('LanguageError', 'nope')).toEqual({
      output_type: 'error',
      ename: 'LanguageError',
      evalue: 'nope',
      traceback: ['LanguageError: nope'],
    });
  });
});
