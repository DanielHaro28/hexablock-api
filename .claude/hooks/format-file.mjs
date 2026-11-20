#!/usr/bin/env node
// PostToolUse hook (D-81): formats the file Claude just edited, so the code
// always follows the formatter the CI checks. It never blocks: if the
// formatter is not installed yet, it does nothing.
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const filePath = String(input.tool_input?.file_path ?? '');
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const run = (cmd, args) =>
  spawnSync(cmd, args, { cwd: projectDir, stdio: 'ignore', shell: process.platform === 'win32' });

const prettier = join(projectDir, 'node_modules', '.bin', process.platform === 'win32' ? 'prettier.cmd' : 'prettier');
if (/\.(ts|js|mjs|json)$/.test(filePath) && !filePath.includes('node_modules') && existsSync(prettier)) {
  run(prettier, ['--write', filePath]);
}
process.exit(0);
