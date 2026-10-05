import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';
import { AppTheme, ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css'
})
export class AdminLayout {
  readonly workspaceSections: Record<string, { title: string; links: { label: string; path: string }[] }> = {
    crm: { title: 'Customer lifecycle', links: [
      { label: 'Leads', path: '/admin/crm/leads' }, { label: 'Customers', path: '/admin/customers' },
      { label: 'Quotes', path: '/admin/sales/quotes' }, { label: 'Sales orders', path: '/admin/sales/orders' },
      { label: 'Sales reports', path: '/admin/sales/reports' }
    ] },
    sales: { title: 'Sales & billing', links: [
      { label: 'Quotes', path: '/admin/sales/quotes' }, { label: 'Sales orders', path: '/admin/sales/orders' },
      { label: 'Invoices', path: '/admin/finance/invoices' }, { label: 'Finance', path: '/admin/finance' }
    ] },
    service: { title: 'Service lifecycle', links: [
      { label: 'Tickets', path: '/admin/service/tickets' }, { label: 'Spare requests', path: '/admin/service/spares/requests' },
      { label: 'Spare issues', path: '/admin/service/spares/issues' }, { label: 'Defective returns', path: '/admin/service/spares/returns' },
      { label: 'Stock', path: '/admin/inventory' }, { label: 'Service reports', path: '/admin/service/reports' }
    ] },
    operations: { title: 'Operations & fulfilment', links: [
      { label: 'Delivery challan', path: '/admin/operations/delivery-challans' }, { label: 'Sales orders', path: '/admin/sales/orders' },
      { label: 'Purchase orders', path: '/admin/purchase/orders' },
      { label: 'Inventory', path: '/admin/inventory' }, { label: 'Inventory reports', path: '/admin/inventory/reports' }
    ] },
    inventory: { title: 'Inventory control', links: [
      { label: 'Stock items', path: '/admin/inventory' }, { label: 'Bundles', path: '/admin/inventory/bundles' },
      { label: 'Adjustments', path: '/admin/inventory/adjustments' }, { label: 'Delivery challan', path: '/admin/operations/delivery-challans' },
      { label: 'Spare issues', path: '/admin/service/spares/issues' },
      { label: 'Reports', path: '/admin/inventory/reports' }
    ] },
    assets: { title: 'Customer assets', links: [
      { label: 'Assets', path: '/admin/assets' }, { label: 'Active devices', path: '/admin/assets/devices' },
      { label: 'Warranty', path: '/admin/assets/warranty' }, { label: 'Customers', path: '/admin/customers' },
      { label: 'Service tickets', path: '/admin/service/tickets' }
    ] },
    finance: { title: 'Finance cycle', links: [
      { label: 'Overview', path: '/admin/finance' }, { label: 'Sales invoices', path: '/admin/finance/invoices' },
      { label: 'Expenses', path: '/admin/finance/expenses' }, { label: 'Reports', path: '/admin/finance/reports' },
      { label: 'Sales orders', path: '/admin/sales/orders' }
    ] },
    purchase: { title: 'Procure to stock', links: [
      { label: 'Vendors', path: '/admin/purchase/vendors' }, { label: 'Purchase orders', path: '/admin/purchase/orders' },
      { label: 'Inventory', path: '/admin/inventory' },
      { label: 'Purchase reports', path: '/admin/purchase/reports' }
    ] },
    hr: { title: 'People & workplace', links: [
      { label: 'Employees', path: '/admin/hr/employees' }, { label: 'Office locations', path: '/admin/hr/branches' }
    ] }
  };
  workspaceTitle = '';
  workspaceLinks: { label: string; path: string }[] = [];
  logoutError = false;
  adminUsername = 'Administrator';
  searchQuery = '';
  newTicketCount = 0;
  databaseConnected = false;
  healthChecked = false;
  mobileNavOpen = false;

  constructor(
    private authService: AuthService,
    private ticketService: TicketService,
    private router: Router,
    private themeService: ThemeService
  ) {}

  get themeMode(): AppTheme {
    return this.themeService.theme;
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  ngOnInit(): void {
    this.updateWorkspaceNavigation(this.router.url);
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.updateWorkspaceNavigation(event.urlAfterRedirects);
        this.mobileNavOpen = false;
      }
    });
    this.authService.getSession().subscribe({
      next: session => this.adminUsername = session.username,
      error: () => this.adminUsername = 'Administrator'
    });
    this.authService.getHealth().subscribe({
      next: health => {
        this.databaseConnected = health.database === 'connected';
        this.healthChecked = true;
      },
      error: error => {
        this.databaseConnected = false;
        this.healthChecked = error.status !== 0;
      }
    });
    this.ticketService.getTickets(undefined, undefined, 'New').subscribe({
      next: response => this.newTicketCount = response.count ?? response.tickets?.length ?? 0,
      error: () => this.newTicketCount = 0
    });
  }

  private updateWorkspaceNavigation(url: string): void {
    const path = url.split('?')[0].replace(/\/$/, '');
    const section = path.startsWith('/admin/crm/') || path === '/admin/customers' || path.startsWith('/admin/customers/')
      ? 'crm'
      : path.startsWith('/admin/sales/') || path === '/admin/finance/invoices'
        ? 'sales'
        : path.startsWith('/admin/service/')
          ? 'service'
          : path.startsWith('/admin/operations/')
            ? 'operations'
            : path.startsWith('/admin/inventory/') || path === '/admin/inventory'
              ? 'inventory'
              : path.startsWith('/admin/assets')
                ? 'assets'
                : path.startsWith('/admin/finance')
                  ? 'finance'
                  : path.startsWith('/admin/purchase')
                    ? 'purchase'
                    : path.startsWith('/admin/hr')
                      ? 'hr'
                      : '';
    const workspace = this.workspaceSections[section];
    this.workspaceTitle = workspace?.title ?? '';
    this.workspaceLinks = workspace?.links ?? [];
  }

  searchTickets(): void {
    void this.router.navigate(['/admin/service/tickets'], {
      queryParams: {
        q: this.searchQuery.trim() || null,
        status: null,
        customerId: null,
        branchId: null
      }
    });
  }

  showNewTickets(): void {
    void this.router.navigate(['/admin/service/tickets'], {
      queryParams: { q: null, status: 'New', customerId: null, branchId: null }
    });
  }

  signOut(): void {
    this.logoutError = false;
    this.authService.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => this.logoutError = true
    });
  }
}
