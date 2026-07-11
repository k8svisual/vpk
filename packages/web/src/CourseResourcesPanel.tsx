import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileImage, Loader2, Pencil, Trash2, UploadCloud } from 'lucide-react';

/**
 * Teacher tools' Resources panel — images, sample files, anything a lesson links to, stored under Settings >
 * Education's `courseResourcesDir` in one subdirectory per course (see server's course/resources.ts doc
 * comment). Scoped to whichever course the editor currently has open (TeacherView derives `course` from the
 * lesson path's first segment) — resources aren't per-lesson-file, they're per-course, since a course
 * directory can (eventually) hold more than one lesson file sharing the same images/samples.
 */

interface ResourceFile {
  name: string;
  size: number;
  mtimeMs: number;
}

const panelStyle = { borderColor: 'var(--vpk-border)' } as const;
const mutedStyle = { color: 'var(--vpk-fg-muted)' } as const;
const errorStyle = { color: 'var(--vpk-status-error)' } as const;

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(name: string): boolean {
  const dot = name.lastIndexOf('.');
  return dot >= 0 && IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

/** Reads a dropped/picked File as base64 — FileReader's own binary-safe data-URL encoding, not a hand-rolled
 *  byte loop, so this doesn't choke on large or non-UTF8 files. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolvePromise(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json()) as T | { error: string };
  if (json && typeof json === 'object' && 'error' in json) throw new Error((json as { error: string }).error);
  return json as T;
}

export function CourseResourcesPanel({ course }: { course: string }) {
  const [files, setFiles] = useState<ResourceFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    getJson<{ files: ResourceFile[] }>(`/course/resources?course=${encodeURIComponent(course)}`)
      .then((d) => {
        setFiles(d.files);
        setError(null);
      })
      .catch((e: unknown) => setError(String(e instanceof Error ? e.message : e)));
  }

  useEffect(refresh, [course]);

  async function uploadFiles(fileList: FileList | File[]) {
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(fileList)) {
        const dataBase64 = await fileToBase64(file);
        const res = await fetch('/course/resources/upload', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ course, name: file.name, dataBase64 }),
        });
        const json = (await res.json()) as { error?: string };
        if (json.error) throw new Error(json.error);
      }
      refresh();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setUploading(false);
    }
  }

  async function requestDelete(name: string) {
    setBusyFile(name);
    try {
      const { referencedIn } = await getJson<{ referencedIn: string[] }>(
        `/course/resources/references?course=${encodeURIComponent(course)}&name=${encodeURIComponent(name)}`,
      );
      const warning = referencedIn.length > 0 ? `\n\nWarning: referenced in ${referencedIn.join(', ')}. Deleting will break that link.` : '';
      if (!window.confirm(`Delete "${name}"?${warning}`)) return;
      const res = await fetch(`/course/resources/file?course=${encodeURIComponent(course)}&name=${encodeURIComponent(name)}`, { method: 'DELETE' });
      const json = (await res.json()) as { error?: string };
      if (json.error) throw new Error(json.error);
      refresh();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusyFile(null);
    }
  }

  function startRename(name: string) {
    setRenaming(name);
    setRenameValue(name);
  }

  async function confirmRename(oldName: string) {
    const newName = renameValue.trim();
    setRenaming(null);
    if (!newName || newName === oldName) return;
    setBusyFile(oldName);
    try {
      const res = await fetch('/course/resources/rename', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ course, oldName, newName }),
      });
      const json = (await res.json()) as { error?: string };
      if (json.error) throw new Error(json.error);
      refresh();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusyFile(null);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
      {error && (
        <div className="text-xs flex items-start gap-1.5 p-2 rounded border" style={{ ...panelStyle, ...errorStyle }}>
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) void uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-1.5 rounded border-2 border-dashed p-6 text-xs cursor-pointer"
        style={{ borderColor: dragOver ? 'var(--vpk-accent)' : 'var(--vpk-border)', color: 'var(--vpk-fg-muted)', background: dragOver ? 'var(--vpk-surface)' : undefined }}
      >
        {uploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
        <span>{uploading ? 'Uploading…' : 'Drag files here, or click to choose'}</span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) void uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="border rounded overflow-hidden" style={panelStyle}>
        {files === null ? (
          <p className="text-xs p-3" style={mutedStyle}>
            Loading…
          </p>
        ) : files.length === 0 ? (
          <p className="text-xs p-3" style={mutedStyle}>
            No resources for this course yet.
          </p>
        ) : (
          files.map((f) => (
            <div key={f.name} className="flex items-center gap-2 px-3 py-2 text-xs border-b last:border-b-0" style={panelStyle}>
              {isImage(f.name) ? (
                <img
                  src={`/course-resources/${encodeURIComponent(course)}/${encodeURIComponent(f.name)}`}
                  alt=""
                  className="w-8 h-8 object-cover rounded border shrink-0"
                  style={panelStyle}
                />
              ) : (
                <FileImage size={16} className="shrink-0" style={mutedStyle} />
              )}
              {renaming === f.name ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void confirmRename(f.name);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  onBlur={() => void confirmRename(f.name)}
                  className="flex-1 px-1 py-0.5 rounded border font-mono"
                  style={{ ...panelStyle, background: 'var(--vpk-surface)' }}
                />
              ) : (
                <span className="flex-1 font-mono truncate">{f.name}</span>
              )}
              <span className="shrink-0" style={mutedStyle}>
                {formatSize(f.size)}
              </span>
              <button
                onClick={() => startRename(f.name)}
                disabled={busyFile === f.name}
                title="Rename"
                aria-label={`Rename ${f.name}`}
                className="shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                style={mutedStyle}
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => void requestDelete(f.name)}
                disabled={busyFile === f.name}
                title="Delete"
                aria-label={`Delete ${f.name}`}
                className="shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                style={errorStyle}
              >
                {busyFile === f.name ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </div>
          ))
        )}
      </div>

      <p className="text-xs" style={mutedStyle}>
        Reference a file from lesson content as{' '}
        <code className="font-mono" style={{ background: 'var(--vpk-surface)', border: '1px solid var(--vpk-border)', borderRadius: 3, padding: '0 3px' }}>
          /course-resources/{course}/&lt;filename&gt;
        </code>
        , e.g. in a markdown image: <code className="font-mono">![diagram](/course-resources/{course}/diagram.png)</code>.
      </p>
    </div>
  );
}
