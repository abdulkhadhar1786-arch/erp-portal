import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Settings } from './settings';
import { commonTestProviders } from '../../../../testing/test-providers';

describe('Settings', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [...commonTestProviders]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads with the component', () => {
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
    http.expectOne('/api/auth/session').flush({ success: true, username: 'admin', role: 'admin' });
    http.expectOne('/api/health').flush({ success: true, service: 'available', database: 'connected', checkedAt: new Date().toISOString() });
    http.expectOne('/api/sales/quotes/profile').flush({ success: true, profile: { companyName: 'Northstar Services', defaultValidityDays: 45 } });
  });

  it('shows the current administrator and MongoDB health', () => {
    const fixture = TestBed.createComponent(Settings);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/auth/session').flush({ success: true, username: 'admin', role: 'admin' });
    http.expectOne('/api/health').flush({
      success: true, service: 'available', database: 'connected', checkedAt: new Date().toISOString()
    });
    http.expectOne('/api/sales/quotes/profile').flush({
      success: true,
      profile: { companyName: 'Northstar Services', companyWebsite: 'https://northstar.example', defaultValidityDays: 45 }
    });

    expect(component.account?.username).toBe('admin');
    expect(component.companyProfile.companyName).toBe('Northstar Services');
    expect(component.companyProfile.companyWebsite).toBe('https://northstar.example');
    expect(component.companyProfile.defaultValidityDays).toBe(45);
    expect(component.health?.database).toBe('connected');
    expect(component.loadingAccount).toBe(false);
    expect(component.loadingHealth).toBe(false);

    component.saveCompanyProfile();
    const saveRequest = http.expectOne('/api/sales/quotes/profile');
    expect(saveRequest.request.method).toBe('PUT');
    expect(saveRequest.request.body.companyName).toBe('Northstar Services');
    expect(saveRequest.request.body.companyWebsite).toBe('https://northstar.example');
    saveRequest.flush({ success: true, profile: saveRequest.request.body });
    expect(component.companyProfileMessage).toContain('Company profile saved');
  });

  it('saves quotation defaults from their own settings tab', () => {
    const fixture = TestBed.createComponent(Settings);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/auth/session').flush({ success: true, username: 'admin', role: 'admin' });
    http.expectOne('/api/health').flush({ success: true, service: 'available', database: 'connected', checkedAt: new Date().toISOString() });
    http.expectOne('/api/sales/quotes/profile').flush({
      success: true,
      profile: { companyName: 'Northstar Services', defaultValidityDays: 45, defaultTerms: 'Payment due within 15 days.' }
    });

    component.activeSettingsTab = 'quotation-defaults';
    component.companyProfile.defaultValidityDays = 60;
    component.saveQuotationDefaults();

    const saveRequest = http.expectOne('/api/sales/quotes/profile');
    expect(saveRequest.request.method).toBe('PUT');
    expect(saveRequest.request.body.companyName).toBe('Northstar Services');
    expect(saveRequest.request.body.defaultValidityDays).toBe(60);
    expect(saveRequest.request.body.defaultTerms).toBe('Payment due within 15 days.');
    saveRequest.flush({ success: true, profile: saveRequest.request.body });
    expect(component.companyProfileMessage).toBe('Quotation defaults saved.');
  });
});
