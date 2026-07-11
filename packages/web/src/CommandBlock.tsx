import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** A labeled, copy-to-clipboard shell snippet — shared by CliEquivalentModal and HelpPanel, both of which show
 *  static reference commands the user runs in their own terminal (VpK never executes these itself). */
export function CommandBlock({ description, command }: { description: string; command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API can be unavailable (insecure context, permissions) — the text is still visible/selectable
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: 'var(--vpk-fg)' }}>
          {description}
        </span>
        <button
          onClick={() => void copy()}
          title="Copy to clipboard"
          aria-label="Copy to clipboard"
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 text-xs"
          style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className="overflow-x-auto rounded border p-2 font-mono whitespace-pre-wrap"
        style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-bg)', color: 'var(--vpk-fg)', fontSize: 11 }}
      >
        {command}
      </pre>
    </div>
  );
}
