import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KIND_COLOR as CORE_KIND_COLOR, WHEEL_KINDS as CORE_WHEEL_KINDS } from '@vpk/core';
import { VENDOR_ICONS as CORE_VENDOR_ICONS } from '@vpk/core';
import { KIND_COLOR as WEB_KIND_COLOR, WHEEL_KINDS as WEB_WHEEL_KINDS } from './kindColors';
import { VENDOR_ICONS as WEB_VENDOR_ICONS } from './vendorIcons';

/**
 * @vpk/web deliberately duplicates a handful of @vpk/core's static data tables rather than importing them
 * (thin-client architecture — @vpk/web never depends on @vpk/core at runtime; this test file is the one
 * sanctioned exception, dev-dependency only, so it can catch the two copies silently drifting apart).
 */

function readCoreSource(fileName: string): string {
  return readFileSync(new URL(`../../core/src/${fileName}`, import.meta.url), 'utf8');
}

function readWebSource(fileName: string): string {
  return readFileSync(new URL(`./${fileName}`, import.meta.url), 'utf8');
}

function extractRecordLiteral(source: string, varName: string): Record<string, string> {
  const match = source.match(new RegExp(`const ${varName}: Record<string, string> = (\\{[\\s\\S]*?\\n\\});`));
  if (!match) throw new Error(`${varName} table not found in source`);
  return new Function(`return ${match[1]}`)();
}

describe('core/web static table drift guard', () => {
  it('KIND_COLOR matches between @vpk/core and @vpk/web', () => {
    expect(WEB_KIND_COLOR).toEqual(CORE_KIND_COLOR);
  });

  it('WHEEL_KINDS matches between @vpk/core and @vpk/web', () => {
    expect([...WEB_WHEEL_KINDS].sort()).toEqual([...CORE_WHEEL_KINDS].sort());
  });

  it('VENDOR_ICONS matches between @vpk/core and @vpk/web', () => {
    expect(WEB_VENDOR_ICONS).toEqual(CORE_VENDOR_ICONS);
  });

  it('KIND_ICON matches between @vpk/core and @vpk/web (not exported, compared via source)', () => {
    const coreTable = extractRecordLiteral(readCoreSource('kindIcons.ts'), 'KIND_ICON');
    const webTable = extractRecordLiteral(readWebSource('kindIcons.ts'), 'KIND_ICON');
    expect(webTable).toEqual(coreTable);
  });
});
