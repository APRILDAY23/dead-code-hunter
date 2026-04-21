import type { LanguagePlugin } from '../types';
import { typescriptPlugin } from './typescript';
import { pythonPlugin } from './python';
import { goPlugin } from './go';
import { javaPlugin } from './java';
import { rubyPlugin } from './ruby';
import { rustPlugin } from './rust';
import { phpPlugin } from './php';
import { csharpPlugin } from './csharp';

export const ALL_PLUGINS: LanguagePlugin[] = [
  typescriptPlugin,
  pythonPlugin,
  goPlugin,
  javaPlugin,
  rubyPlugin,
  rustPlugin,
  phpPlugin,
  csharpPlugin,
];

export function getPlugin(language: string): LanguagePlugin | undefined {
  return ALL_PLUGINS.find(p => p.language === language);
}

export function getPluginByExt(ext: string): LanguagePlugin | undefined {
  return ALL_PLUGINS.find(p => p.extensions.includes(ext.toLowerCase()));
}
