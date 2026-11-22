// Common values, so that people can pick instead of type. The schema has no such lists,
// so keep these current with Codex. Keys are paths, as in "agents.default_subagent_model".
// A hint is a short explanation, shown next to the value.

export type Preset = { value: string; hint?: string };

const models: Preset[] = [
  { value: 'gpt-5.6-sol', hint: 'the most capable, and the default' },
  { value: 'gpt-5.6-terra', hint: 'balanced, for everyday work' },
  { value: 'gpt-5.6-luna', hint: 'fast and affordable' },
  { value: 'gpt-5.5', hint: 'for complex coding and research' },
  { value: 'gpt-5.2', hint: 'for professional work and long-running agents' },
];

// Only some models support max and ultra.
const efforts: Preset[] = [
  { value: 'low', hint: 'fast, with light reasoning' },
  { value: 'medium', hint: 'balances speed and depth' },
  { value: 'high', hint: 'thinks longer on hard problems' },
  { value: 'xhigh', hint: 'thinks even longer' },
  { value: 'max', hint: 'the deepest reasoning, on some models only' },
  { value: 'ultra', hint: 'like max, and it delegates tasks, on some models only' },
];

export const presets: Record<string, Preset[]> = {
  model: models,
  review_model: models,
  'agents.default_subagent_model': models,
  model_reasoning_effort: efforts,
  plan_mode_reasoning_effort: efforts,
  'agents.default_subagent_reasoning_effort': efforts,
  model_reasoning_summary: [
    { value: 'auto', hint: 'Codex picks the detail' },
    { value: 'concise', hint: 'a short summary' },
    { value: 'detailed', hint: 'a long summary' },
    { value: 'none', hint: 'no summary' },
  ],
  model_verbosity: [
    { value: 'low', hint: 'short answers' },
    { value: 'medium' },
    { value: 'high', hint: 'long, detailed answers' },
  ],
  service_tier: [
    { value: 'default' },
    { value: 'priority', hint: 'faster, at a higher price' },
    { value: 'flex', hint: 'slower, at a lower price' },
  ],
  approval_policy: [
    { value: 'untrusted', hint: 'asks before anything but safe reads' },
    { value: 'on-request', hint: 'Codex decides when to ask you' },
    { value: 'never', hint: 'never asks you' },
  ],
  sandbox_mode: [
    { value: 'read-only', hint: 'reads files, and changes nothing' },
    { value: 'workspace-write', hint: 'changes files in the project only' },
    { value: 'danger-full-access', hint: 'no sandbox at all' },
  ],
  approvals_reviewer: [
    { value: 'user', hint: 'you review each request' },
    { value: 'auto_review', hint: 'a reviewer agent decides' },
    { value: 'guardian_subagent', hint: 'the old name of auto_review' },
  ],
  'shell_environment_policy.inherit': [
    { value: 'core', hint: 'only basics such as HOME and PATH' },
    { value: 'all', hint: 'every variable' },
    { value: 'none', hint: 'no variables' },
  ],
  web_search: [
    { value: 'disabled', hint: 'no web search' },
    { value: 'cached', hint: 'results from a cache that OpenAI keeps' },
    { value: 'indexed', hint: 'the web, when the search index allows it' },
    { value: 'live', hint: 'the newest results from the web' },
  ],
  file_opener: [
    { value: 'vscode', hint: 'opens files in VS Code' },
    { value: 'vscode-insiders' },
    { value: 'cursor' },
    { value: 'windsurf' },
    { value: 'none', hint: 'no links' },
  ],
  'history.persistence': [
    { value: 'save-all', hint: 'saves every prompt' },
    { value: 'none', hint: 'saves nothing' },
  ],
  oss_provider: [{ value: 'lmstudio' }, { value: 'ollama' }],
  forced_login_method: [
    { value: 'chatgpt', hint: 'sign in with ChatGPT' },
    { value: 'api', hint: 'use an API key' },
  ],
  cli_auth_credentials_store: [
    { value: 'file', hint: 'auth.json in the Codex folder' },
    { value: 'keyring', hint: 'the keyring of your system' },
    { value: 'auto', hint: 'the keyring if it can, else a file' },
    { value: 'ephemeral', hint: 'in memory, until Codex quits' },
  ],
  mcp_oauth_credentials_store: [
    { value: 'auto', hint: 'the keyring if it can, else a file' },
    { value: 'file', hint: '.credentials.json in the Codex folder' },
    { value: 'keyring', hint: 'the keyring of your system' },
  ],
  project_root_markers: [{ value: '.git' }, { value: '.hg' }, { value: '.jj' }],
  // The names of environment variables.
  'shell_environment_policy.set': [
    { value: 'CI', hint: '1 for tools that check for CI' },
    { value: 'NO_COLOR', hint: '1 to turn off colors' },
    { value: 'PAGER', hint: 'cat, so that commands do not wait' },
  ],
};
