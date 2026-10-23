import type { Finding, RuleInput, RuleName } from '../core/types.js';
import { buttonsRule } from './buttons.js';
import { cardsRule } from './cards.js';
import { colorsRule } from './colors.js';
import { scalesRule } from './scales.js';

export const RULES: Record<RuleName, (input: RuleInput) => Finding[]> = { buttons: buttonsRule, cards: cardsRule, colors: colorsRule, scales: scalesRule };
export const RULE_NAMES: RuleName[] = ['buttons', 'cards', 'colors', 'scales'];
const SEV = { high: 0, medium: 1, info: 2 } as const;

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEV[a.severity] - SEV[b.severity] || a.rule.localeCompare(b.rule) || a.key.localeCompare(b.key));
}

/** Run all rules (or a subset) over derived scan data; findings sorted by severity, rule, key. */
export function runRules(input: RuleInput, only?: RuleName[]): Finding[] {
  const names = only?.length ? only : RULE_NAMES;
  return sortFindings(names.flatMap((n) => RULES[n](input)));
}
