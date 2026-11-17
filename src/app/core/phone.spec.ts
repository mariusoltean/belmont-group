import { toTelHref } from './phone';

describe('toTelHref', () => {
  it('turns a Romanian national number into an international tel: link', () => {
    expect(toTelHref('0743 573 008')).toBe('tel:+40743573008');
    expect(toTelHref('0743/573008')).toBe('tel:+40743573008');
    expect(toTelHref('+40 743 573 008')).toBe('tel:+40743573008');
  });
});
