import { parseRule } from '../src/lib/rules/loader.ts';
import { ruleToYaml } from '../src/lib/rules/loadAllRules.ts';
import { readFileSync } from 'node:fs';

const yaml = readFileSync('src/lib/rules/definitions/crypto-hardcoded-secret.yml', 'utf8');
const rule = parseRule(yaml, 'crypto-hardcoded-secret.yml');
console.log('=== parseRule output ===');
console.log('rule:', JSON.stringify(rule.rule));
console.log('constraints:', JSON.stringify(rule.constraints));
console.log('');
console.log('=== ruleToYaml output ===');
console.log(ruleToYaml(rule));
