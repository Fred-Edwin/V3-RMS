import { describe, expect, it } from 'vitest';

import { domainOf, suggestEmails } from './hire-email';

describe('suggested sign-in emails', () => {
  it('builds first.last, first initial and last, then first.last2', () => {
    expect(suggestEmails('Wanjiru Kamau', 'wendocoffee.com')).toEqual(['wanjiru.kamau@wendocoffee.com', 'wkamau@wendocoffee.com', 'wanjiru.kamau2@wendocoffee.com']);
  });
  it('uses the last word as the surname and drops accents, spaces and punctuation', () => {
    expect(suggestEmails("Mary-Anne O'Néill Njeri", 'x.co')[0]).toBe('maryanne.njeri@x.co');
  });
  it('skips an address that is already taken', () => {
    expect(suggestEmails('Joy Chebet', 'x.co', ['Joy.Chebet@x.co'])[0]).toBe('jchebet@x.co');
  });
  it('offers the first name alone for a one-word name, and nothing without a name or a domain', () => {
    expect(suggestEmails('Peter', 'x.co')).toEqual(['peter@x.co', 'peter2@x.co']);
    expect(suggestEmails('', 'x.co')).toEqual([]);
    expect(suggestEmails('Joy Chebet', null)).toEqual([]);
  });
  it('reads the domain from an email', () => {
    expect(domainOf('Mercy@WendoCoffee.com')).toBe('wendocoffee.com');
    expect(domainOf('nope')).toBeNull();
    expect(domainOf(undefined)).toBeNull();
  });
});
