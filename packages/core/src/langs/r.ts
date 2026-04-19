import { StreamLanguage } from '@codemirror/language';
import { r as rMode } from '@codemirror/legacy-modes/mode/r';
import type { LanguageDef } from '../types';

const lang = StreamLanguage.define(rMode);

export const r: LanguageDef = {
  name: 'r',
  parser: lang.parser,
};

export default r;
