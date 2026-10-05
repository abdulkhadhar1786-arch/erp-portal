import { routes } from './app.routes';
import { ReportDashboard } from './features/reports/report-dashboard/report-dashboard';
import { Settings } from './features/settings/settings/settings';

describe('application routes', () => {
  const adminChildren = routes.find(route => route.path === 'admin')?.children ?? [];

  it('registers every administrative sidebar destination', () => {
    const expected = new Map([
      ['dashboard', true],
      ['customers', true],
      ['service/tickets', true],
      ['hr/branches', true],
      ['hr/employees', true],
      ['reports', true],
      ['settings', true]
    ]);
    for (const path of expected.keys()) {
      expect(adminChildren.some(route => route.path === path)).toBe(true);
    }
  });

  it('maps reports and settings to functional screens', () => {
    expect(adminChildren.find(route => route.path === 'reports')?.component).toBe(ReportDashboard);
    expect(adminChildren.find(route => route.path === 'settings')?.component).toBe(Settings);
  });
});
