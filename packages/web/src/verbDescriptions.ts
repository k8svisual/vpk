/** Plain-English gloss for the verbs a lesson commonly allows — shared by the terminal's "Allowed" popover
 *  (TerminalPane.tsx) and Settings' additional-commands tester (VerbTester.tsx/SettingsModal.tsx), so the two
 *  don't drift into two separate half-lists of the same thing. Pure documentation for the student — the actual
 *  enforcement is server/src/course/command.ts's checkCommandPolicy (which gates on the lesson's `allow` list);
 *  a verb missing from this map still works fine if allowed, it just falls back to the generic description
 *  below. */
export const VERB_DESCRIPTIONS: Record<string, string> = {
  get: 'List or show one or more resources',
  describe: 'Show detailed information about a resource',
  logs: 'Print a container’s logs',
  explain: 'Show documentation for a resource type’s fields',
  top: 'Show current CPU/memory usage',
  exec: 'Run a command inside a container',
  'port-forward': 'Forward a local port to a Pod or Service',
  cp: 'Copy files to or from a container',
  events: 'List recent Events',
  diff: 'Show what apply would change, without changing anything',
  wait: 'Wait for a condition on a resource',
  apply: 'Create or update a resource from a file/manifest',
  create: 'Create a new resource',
  delete: 'Delete a resource',
  edit: 'Edit a resource directly',
  patch: 'Update specific fields of a resource',
  replace: 'Replace an existing resource',
  scale: 'Change a workload’s replica count',
  label: 'Add, change, or remove labels on a resource',
  annotate: 'Add, change, or remove annotations on a resource',
  set: 'Update specific fields (image, resources, …) on a resource',
  rollout: 'Manage a workload’s rollout — status, history, undo, restart',
  expose: 'Create a Service for an existing resource',
  taint: 'Add or remove a taint on a Node',
  drain: 'Safely evict every Pod from a Node for maintenance',
  cordon: 'Mark a Node unschedulable',
  uncordon: 'Mark a Node schedulable again',
  run: 'Run a new Pod directly from an image',
};

export const GENERIC_VERB_DESCRIPTION = 'Kubernetes CLI verb';
