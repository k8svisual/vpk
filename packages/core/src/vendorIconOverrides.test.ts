import { describe, it, expect, afterEach } from 'vitest';
import { setVendorIconOverrides, getVendorIconOverrides, vendorIconFor } from './vendorIconOverrides';

describe('vendorIconOverrides', () => {
  afterEach(() => setVendorIconOverrides([]));

  it('resolves built-in vendor icons unchanged with no overrides set', () => {
    expect(vendorIconFor('cert-manager.io/v1')).toBe('/icons/other/cert-manager.svg');
  });

  it('replaces a built-in row\'s icon without needing a title', () => {
    setVendorIconOverrides([{ needle: 'cert-manager.io', icon: '/icons/custom/my-cert-manager.svg' }]);
    expect(vendorIconFor('cert-manager.io/v1')).toBe('/icons/custom/my-cert-manager.svg');
  });

  it('disables a built-in row entirely', () => {
    setVendorIconOverrides([{ needle: 'cert-manager.io', disabled: true }]);
    expect(vendorIconFor('cert-manager.io/v1')).toBeUndefined();
  });

  it('adds a wholly new vendor mapping not present in the built-in table', () => {
    setVendorIconOverrides([{ needle: 'acme.example.com', icon: '/icons/custom/acme.svg', title: 'Acme Corp' }]);
    expect(vendorIconFor('acme.example.com/v1')).toBe('/icons/custom/acme.svg');
  });

  it('still prefers the longer, more specific needle after an override is added', () => {
    setVendorIconOverrides([{ needle: 'coreos.com', icon: '/icons/custom/generic-coreos.svg', title: 'CoreOS (generic)' }]);
    // monitoring.coreos.com (built-in, longer) must still win over the new shorter "coreos.com" needle.
    expect(vendorIconFor('monitoring.coreos.com/v1')).toBe('/icons/other/prometheus.svg');
    expect(vendorIconFor('some.other.coreos.com/v1')).toBe('/icons/custom/generic-coreos.svg');
  });

  it('getVendorIconOverrides reflects the last call to setVendorIconOverrides', () => {
    const overrides = [{ needle: 'x.y.z', icon: '/icons/custom/x.svg' }];
    setVendorIconOverrides(overrides);
    expect(getVendorIconOverrides()).toEqual(overrides);
  });
});
