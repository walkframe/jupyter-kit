import { parser } from '@lezer/javascript';
import type { LanguageDef } from '../types';

export const javascript: LanguageDef = {
  name: 'javascript',
  aliases: ['js', 'jsx', 'ts', 'tsx', 'typescript'],
  parser,
};

export default javascript;
