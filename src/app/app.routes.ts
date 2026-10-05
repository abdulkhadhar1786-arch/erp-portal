import { Routes } from '@angular/router';

import { Login } from './features/auth/login/login';

import { adminGuard, portalGuard } from './core/guards/admin.guard';

import { AdminLayout }
  from './layout/admin-layout/admin-layout';

import { AdminDashboard }
  from './features/dashboard/admin-dashboard/admin-dashboard';

import { CustomerList }
  from './features/customers/customer-list/customer-list';

import { CustomerDetails }
  from './features/customers/customer-details/customer-details';

import { CustomerForm }
  from './features/customers/customer-form/customer-form';

import { BranchForm }
  from './features/customers/branch-form/branch-form';

import { BranchDetails }
  from './features/customers/branch-details/branch-details';

import { TicketList }
  from './features/service/ticket-list/ticket-list';

import { TicketDetails }
  from './features/service/ticket-details/ticket-details';

import { TicketForm }
  from './features/service/ticket-form/ticket-form';

import { BranchList }
  from './features/hr/branch-list/branch-list';

import { HrBranchForm }
  from './features/hr/branch-form/branch-form';

import { EmployeeList }
  from './features/hr/employee-list/employee-list';

import { EmployeeForm }
  from './features/hr/employee-form/employee-form';

import { PortalLayout }
  from './layout/portal-layout/portal-layout';

import { PortalDashboard }
  from './features/portal/portal-dashboard/portal-dashboard';

import { PortalTicketList }
  from './features/portal/portal-ticket-list/portal-ticket-list';

import { PortalTicketForm }
  from './features/portal/portal-ticket-form/portal-ticket-form';

import { PortalTicketDetails }
  from './features/portal/portal-ticket-details/portal-ticket-details';

import { ReportDashboard }
  from './features/reports/report-dashboard/report-dashboard';

import { Settings }
  from './features/settings/settings/settings';

import { LeadPipeline }
  from './features/crm/lead-pipeline/lead-pipeline';

import { Inventory }
  from './features/inventory/inventory/inventory';

import { Quotes }
  from './features/sales/quotes/quotes';

import { SalesOrders }
  from './features/sales/orders/orders';

import { SalesReports }
  from './features/sales/reports/sales-reports';

import { SpareRequests }
  from './features/service/spares/spare-requests';

import { SpareIssues }
  from './features/service/spares/spare-issues';

import { DefectiveReturns }
  from './features/service/spares/defective-returns';

import { SpareBulkUpload }
  from './features/service/spares/spare-bulk-upload';

import { OperationsModule } from './features/operations/operations-module';
import { AssetManagement } from './features/operations/asset-management';
import { BundleProducts } from './features/operations/bundle-products';
import { FinanceModule } from './features/operations/finance-module';
import { PurchaseModule } from './features/operations/purchase-module';


export const routes: Routes = [

  {
    path: 'portal/customer',
    component: PortalLayout,
    canActivate: [portalGuard('customer_admin')],
    canActivateChild: [portalGuard('customer_admin')],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: PortalDashboard, data: { portalRole: 'customer_admin' } },
      { path: 'tickets', component: PortalTicketList, data: { portalRole: 'customer_admin' } },
      { path: 'tickets/new', component: PortalTicketForm, data: { portalRole: 'customer_admin' } },
      { path: 'tickets/:id', component: PortalTicketDetails, data: { portalRole: 'customer_admin' } }
    ]
  },

  {
    path: 'portal/branch',
    component: PortalLayout,
    canActivate: [portalGuard('branch')],
    canActivateChild: [portalGuard('branch')],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: PortalDashboard, data: { portalRole: 'branch' } },
      { path: 'tickets', component: PortalTicketList, data: { portalRole: 'branch' } },
      { path: 'tickets/new', component: PortalTicketForm, data: { portalRole: 'branch' } },
      { path: 'tickets/:id', component: PortalTicketDetails, data: { portalRole: 'branch' } }
    ]
  },

  {
    path: 'login',
    component: Login
  },


  {
    path: 'admin',

    component: AdminLayout,
    canActivate: [adminGuard],
    canActivateChild: [adminGuard],

    children: [

      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },


      {
        path: 'dashboard',
        component: AdminDashboard
      },

      {
        path: 'hr/branches/add',
        component: HrBranchForm
      },

      {
        path: 'hr/branches/:id/edit',
        component: HrBranchForm
      },

      {
        path: 'hr/branches',
        component: BranchList
      },

      {
        path: 'hr/employees/add',
        component: EmployeeForm
      },

      {
        path: 'hr/employees/:id/edit',
        component: EmployeeForm
      },

      {
        path: 'hr/employees',
        component: EmployeeList
      },

      {
        path: 'reports',
        redirectTo: 'service/reports'
      },

      {
        path: 'settings',
        component: Settings
      },


      /* =========================
         CUSTOMERS
         ========================= */

      {
        path: 'sales/reports',
        component: SalesReports
      },

      {
        path: 'sales/quotes',
        component: Quotes
      },

      {
        path: 'sales/orders',
        component: SalesOrders
      },

      {
        path: 'inventory',
        component: Inventory
      },

      { path: 'operations/inward-challans', redirectTo: 'purchase/orders', pathMatch: 'full' },
      { path: 'operations/outward-challans', redirectTo: 'operations/delivery-challans', pathMatch: 'full' },
      { path: 'operations/deliveries', redirectTo: 'operations/delivery-challans', pathMatch: 'full' },
      { path: 'operations/delivery-challans', component: OperationsModule, data: { mode: 'delivery-challans' } },
      { path: 'inventory/adjustments', component: OperationsModule, data: { mode: 'adjustment' } },
      { path: 'inventory/reports', component: OperationsModule, data: { mode: 'inventory-reports' } },
      { path: 'inventory/bundles', component: BundleProducts },
      { path: 'assets', component: AssetManagement, data: { mode: 'assets' } },
      { path: 'assets/devices', component: AssetManagement, data: { mode: 'devices' } },
      { path: 'assets/warranty', component: AssetManagement, data: { mode: 'warranty' } },
      { path: 'finance', component: FinanceModule, data: { mode: 'finance' } },
      { path: 'finance/invoices', component: FinanceModule, data: { mode: 'invoices' } },
      { path: 'finance/expenses', component: FinanceModule, data: { mode: 'expenses' } },
      { path: 'finance/reports', component: FinanceModule, data: { mode: 'reports' } },
      { path: 'purchase/vendors', component: PurchaseModule, data: { mode: 'vendors' } },
      { path: 'purchase/orders', component: PurchaseModule, data: { mode: 'orders' } },
      { path: 'purchase/reports', component: PurchaseModule, data: { mode: 'reports' } },

      {
        path: 'crm/leads',
        component: LeadPipeline
      },

      {
        path: 'customers/add',
        component: CustomerForm
      },

      {
        path: 'customers/:id/edit',
        component: CustomerForm
      },

      {
        path:
          'customers/:customerId/branches/add',

        component: BranchForm
      },

      {
        path:
          'customers/:customerId/branches/:branchId/edit',

        component: BranchForm
      },

      {
        path:
          'customers/:customerId/branches/:branchId',

        component: BranchDetails
      },

      {
        path:
          'customers/:id',

        component: CustomerDetails
      },

      {
        path: 'customers',
        component: CustomerList
      },


      /* =========================
         SERVICE
         ========================= */

      {
        path:
          'service/tickets',

        component: TicketList
      },

      {
        path: 'service/reports',
        component: ReportDashboard
      },

      {
        path: 'service/spares/issues',
        component: SpareIssues
      },

      {
        path: 'service/spares/requests',
        component: SpareRequests
      },

      {
        path: 'service/spares/returns',
        component: DefectiveReturns
      },

      {
        path: 'service/spares/bulk-upload',
        component: SpareBulkUpload
      },

      {
        path:
          'service/tickets/create',

        component: TicketForm
      },

      {
        path:
          'service/tickets/:id',

        component: TicketDetails
      }

    ]

  },


  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },


  {
    path: '**',
    redirectTo: 'login'
  }

];
