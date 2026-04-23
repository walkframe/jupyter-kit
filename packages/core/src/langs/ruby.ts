import { StreamLanguage } from '@codemirror/language';
import { ruby as rubyMode } from '@codemirror/legacy-modes/mode/ruby';
import type { LanguageDef } from '../types';

const lang = StreamLanguage.define(rubyMode);

export const ruby: LanguageDef = {
  name: 'ruby',
  aliases: ['rb'],
  parser: lang.parser,
};

export default ruby;
