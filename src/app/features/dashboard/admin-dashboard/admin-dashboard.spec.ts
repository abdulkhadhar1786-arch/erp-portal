import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminDashboard } from './admin-dashboard';
import { commonTestProviders } from '../../../../testing/test-providers';

describe('AdminDashboard', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [...commonTestProviders]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads with the component', () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
    http.expectOne('/api/customers').flush({ customers: [] });
    http.expectOne('/api/hr/employees').flush({ employees: [] });
    http.expectOne('/api/hr/branch-offices').flush({ branchOffices: [] });
    http.expectOne('/api/tickets').flush({ tickets: [] });
  });

  it('builds metrics and office workload from live service records', () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/customers').flush({ customers: [{ _id: 'cus1' }] });
    http.expectOne('/api/hr/employees').flush({ employees: [{ _id: 'emp1', officeBranchId: 'off1' }] });
    http.expectOne('/api/hr/branch-offices').flush({
      branchOffices: [{ _id: 'off1', code: 'OFF-0001', name: 'Chennai', status: 'Active', employeeCount: 1 }]
    });
    http.expectOne('/api/tickets').flush({ tickets: [{
      _id: 'ticket1', ticketNumber: 'TKT-1001', subject: 'Network down', customerName: 'Acme',
      branchName: 'Main', assignedTo: 'Engineer', assignedEmployeeId: 'emp1', status: 'In Progress',
      priority: 'High', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    }] });

    expect(component.stats).toEqual({
      customers: 1, companyBranches: 1, employees: 1, openTickets: 1, inProgress: 1, resolved: 0
    });
    expect(component.offices[0].openTickets).toBe(1);
    expect(component.recentTickets[0].ticketNumber).toBe('TKT-1001');
  });
});
