import { StreamLanguage } from '@codemirror/language';
import { haskell as haskellMode } from '@codemirror/legacy-modes/mode/haskell';
import type { LanguageDef } from '../types';

const lang = StreamLanguage.define(haskellMode);

export const haskell: LanguageDef = {
  name: 'haskell',
  aliases: ['hs'],
  parser: lang.parser,
};

export default haskell;
