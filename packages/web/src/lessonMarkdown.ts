import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Renders a lesson's markdown prose to SANITIZED HTML for injection via dangerouslySetInnerHTML.
 *
 * Lessons are NOT strictly trusted repo content: Teacher tools write them to ~/.vpk/courses, and courses are
 * explicitly designed to be zipped, shared, and imported — so a third-party lesson is untrusted input. `marked`
 * passes raw HTML through by default, so without sanitization an `<img onerror=…>` / `<svg onload=…>` embedded
 * in a lesson would execute script in the app origin, which has access to every /course/* and /settings route
 * (and, via the terminal's /course/command, to running commands). DOMPurify strips event handlers, javascript:
 * URLs, <script>, etc. while keeping the tags lessons legitimately use — headings, lists, code, links, images,
 * and the <details>/<summary> that Hint / Step-by-step blocks are authored as.
 *
 * Kept as a plain function (not inline in the component) so the sanitization is unit-testable without rendering.
 * Browser-only: DOMPurify needs a DOM, which is always present where lesson prose renders.
 */
export function renderLessonHtml(markdown: string): string {
  return DOMPurify.sanitize(marked.parse(markdown, { async: false }) as string);
}
