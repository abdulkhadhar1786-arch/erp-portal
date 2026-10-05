import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ReportDashboard } from './report-dashboard';
import { commonTestProviders } from '../../../../testing/test-providers';

describe('ReportDashboard', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportDashboard],
      providers: [...commonTestProviders]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads with the component', () => {
    const fixture = TestBed.createComponent(ReportDashboard);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
    http.expectOne('/api/tickets').flush({ tickets: [] });
    http.expectOne('/api/customers').flush({ customers: [] });
    http.expectOne('/api/spares/requests').flush({ requests: [] });
    http.expectOne('/api/spares/issues').flush({ issues: [] });
    http.expectOne('/api/spares/returns').flush({ returns: [] });
    http.expectOne('/api/inventory/items').flush({ items: [] });
  });

  it('calculates ticket status and resolution metrics from live records', () => {
    const fixture = TestBed.createComponent(ReportDashboard);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const now = new Date().toISOString();
    http.expectOne('/api/tickets').flush({ tickets: [
      { _id: '1', ticketNumber: 'TKT-1', subject: 'Internet', customerName: 'Acme', branchName: 'East', category: 'Network', priority: 'High', status: 'In Progress', createdAt: now },
      { _id: '2', ticketNumber: 'TKT-2', subject: 'Printer', customerName: 'Acme', branchName: 'West', category: 'Hardware', priority: 'Medium', status: 'Resolved', createdAt: now }
    ] });
    http.expectOne('/api/customers').flush({ customers: [{ _id: 'cus1' }] });
    http.expectOne('/api/spares/requests').flush({ requests: [
      { _id: 'req1', requestNumber: 'SPR-1', status: 'Requested', quantityRequested: 3, quantityIssued: 0, createdAt: now }
    ] });
    http.expectOne('/api/spares/issues').flush({ issues: [
      { _id: 'issue1', issueNumber: 'SPI-1', sku: 'SP-1', quantity: 2, unitCost: 100, createdAt: now, issuedAt: now }
    ] });
    http.expectOne('/api/spares/returns').flush({ returns: [
      { _id: 'return1', returnNumber: 'DR-1', status: 'Submitted', quantity: 1, createdAt: now }
    ] });
    http.expectOne('/api/inventory/items').flush({ items: [
      { _id: 'stock1', status: 'Active', quantityOnHand: 2, reorderLevel: 3 }
    ] });

    expect(component.tickets.length).toBe(2);
    expect(component.openCount).toBe(1);
    expect(component.resolvedCount).toBe(1);
    expect(component.resolutionRate).toBe(50);
    expect(component.categoryRows.map(row => row.label).sort()).toEqual(['Hardware', 'Network']);
    expect(component.branchRows.length).toBe(2);
    expect(component.openSpareRequests).toBe(1);
    expect(component.issuedQuantity).toBe(2);
    expect(component.issuedValue).toBe(200);
    expect(component.returnsForInspection).toBe(1);
    expect(component.lowStockCount).toBe(1);
  });
});
