import { describe, it, expect } from 'vitest';
import { iconForKind } from './kindIcons';

describe('iconForKind', () => {
  it('returns the real Kubernetes icon filename for a listed kind', () => {
    expect(iconForKind('Pod')).toBe('pod.svg');
    expect(iconForKind('Service')).toBe('svc.svg');
    expect(iconForKind('Endpoints')).toBe('ep.svg');
  });

  it('falls back to the generic k8 icon for an unlisted kind', () => {
    expect(iconForKind('SomeCustomResource')).toBe('k8.svg');
  });
});
