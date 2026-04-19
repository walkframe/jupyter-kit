import { parser } from '@lezer/python';
import type { LanguageDef } from '../types';

export const python: LanguageDef = {
  name: 'python',
  aliases: ['py', 'python3', 'ipython', 'ipython3'],
  parser,
};

export default python;
