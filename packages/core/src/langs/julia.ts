import { StreamLanguage } from '@codemirror/language';
import { julia as juliaMode } from '@codemirror/legacy-modes/mode/julia';
import type { LanguageDef } from '../types';

const lang = StreamLanguage.define(juliaMode);

export const julia: LanguageDef = {
  name: 'julia',
  aliases: ['jl'],
  parser: lang.parser,
};

export default julia;
