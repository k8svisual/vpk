// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderLessonHtml } from './lessonMarkdown';

// DOMPurify needs a DOM, hence the jsdom environment above. These lock in the security fix: a shared/imported
// lesson is untrusted input, so its rendered HTML must not be able to run script in the app origin.
describe('renderLessonHtml — lesson markdown sanitization', () => {
  it('strips an onerror handler from an embedded <img>', () => {
    const html = renderLessonHtml('Look: <img src="x" onerror="fetch(\'/course/command\')">');
    expect(html).toContain('<img');
    expect(html.toLowerCase()).not.toContain('onerror');
  });

  it('strips <script> tags', () => {
    const html = renderLessonHtml('before\n\n<script>alert(1)</script>\n\nafter');
    expect(html.toLowerCase()).not.toContain('<script');
    expect(html).toContain('after');
  });

  it('strips an onload handler from an embedded <svg>', () => {
    const html = renderLessonHtml('<svg onload="alert(1)"></svg>');
    expect(html.toLowerCase()).not.toContain('onload');
  });

  it('strips a javascript: URL from a link', () => {
    const html = renderLessonHtml('[click me](javascript:alert(1))');
    expect(html.toLowerCase()).not.toContain('javascript:');
    expect(html).toContain('click me'); // the link text survives, only the dangerous href is dropped
  });

  it('keeps the safe markdown a lesson actually uses', () => {
    const src = [
      '## Heading',
      '',
      'Some **bold** text and a [link](https://example.com).',
      '',
      '```sh',
      'kubectl get pods',
      '```',
      '',
      '<details><summary>Hint</summary>Try describe.</details>',
    ].join('\n');
    const html = renderLessonHtml(src);
    expect(html).toContain('Heading');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('kubectl get pods');
    expect(html.toLowerCase()).toContain('<details');
    expect(html.toLowerCase()).toContain('<summary');
  });

  it('keeps a course-resources image reference intact', () => {
    const html = renderLessonHtml('![diagram](/course-resources/course02/diagram.png)');
    expect(html).toContain('src="/course-resources/course02/diagram.png"');
  });
});
