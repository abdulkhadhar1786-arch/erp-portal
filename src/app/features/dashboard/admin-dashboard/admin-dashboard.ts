import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CustomerService } from '../../../core/services/customer.service';
import { EmployeeRecord, HrService, OfficeBranchRecord } from '../../../core/services/hr.service';
import { Ticket, TicketHistoryEvent, TicketService } from '../../../core/services/ticket.service';
import { CrmLead, CrmService, LeadStage } from '../../../core/services/crm.service';
import { InventoryItem, InventoryService } from '../../../core/services/inventory.service';

interface OfficeSummary extends OfficeBranchRecord {
  employees: number;
  openTickets: number;
  inProgress: number;
  resolved: number;
}

interface ActivityItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.html'
})
export class AdminDashboard implements OnInit {
  loading = true;
  errorMessage = '';
  tickets: Ticket[] = [];
  recentTickets: Ticket[] = [];
  offices: OfficeSummary[] = [];
  activities: ActivityItem[] = [];
  recentLeads: CrmLead[] = [];
  lowStockItems: InventoryItem[] = [];
  pipelineStages: { stage: LeadStage; count: number; value: number; color: string }[] = [];
  lastUpdated = '';
  stats = {
    customers: 0,
    companyBranches: 0,
    employees: 0,
    openTickets: 0,
    inProgress: 0,
    resolved: 0,
    activeLeads: 0,
    pipelineValue: 0,
    followUpsDue: 0,
    inventoryItems: 0,
    reorderAlerts: 0
  };

  constructor(
    private customersApi: CustomerService,
    private hrApi: HrService,
    private ticketsApi: TicketService,
    private crmApi: CrmService,
    private inventoryApi: InventoryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({
      customers: this.customersApi.getCustomers(),
      employees: this.hrApi.getEmployees(),
      offices: this.hrApi.getOfficeBranches(),
      tickets: this.ticketsApi.getTickets(),
      leads: this.crmApi.getLeads(),
      inventory: this.inventoryApi.getItems()
    }).subscribe({
      next: ({ customers, employees, offices, tickets, leads, inventory }) => {
        this.tickets = tickets.tickets ?? [];
        const allLeads = leads.leads ?? [];
        const activeInventory = (inventory.items ?? []).filter(item => item.status === 'Active');
        const lowStock = activeInventory.filter(item => item.quantityOnHand <= item.reorderLevel);
        const activeLeads = allLeads.filter(lead => lead.stage !== 'Won' && lead.stage !== 'Lost');
        const allEmployees = employees.employees ?? [];
        const dueCutoff = new Date();
        dueCutoff.setHours(23, 59, 59, 999);
        this.stats = {
          customers: customers.customers?.length ?? 0,
          companyBranches: offices.branchOffices?.length ?? 0,
          employees: allEmployees.length,
          openTickets: this.tickets.filter(ticket => !this.isResolved(ticket.status)).length,
          inProgress: this.tickets.filter(ticket => ticket.status === 'In Progress').length,
          resolved: this.tickets.filter(ticket => this.isResolved(ticket.status)).length,
          activeLeads: activeLeads.length,
          pipelineValue: activeLeads.reduce((total, lead) => total + lead.expectedValue, 0),
          followUpsDue: activeLeads.filter(lead => !!lead.nextFollowUp && new Date(lead.nextFollowUp) <= dueCutoff).length,
          inventoryItems: activeInventory.length,
          reorderAlerts: lowStock.length
        };
        this.lowStockItems = [...lowStock]
          .sort((left, right) => left.quantityOnHand - right.quantityOnHand)
          .slice(0, 5);
        const stageOrder: LeadStage[] = ['New', 'Qualified', 'Proposal', 'Negotiation'];
        const stageColors: Record<LeadStage, string> = {
          New: '#94a3b8', Qualified: '#34d399', Proposal: '#60a5fa',
          Negotiation: '#fbbf24', Won: '#4ade80', Lost: '#fb7185'
        };
        this.pipelineStages = stageOrder.map(stage => {
          const stageLeads = activeLeads.filter(lead => lead.stage === stage);
          return {
            stage,
            count: stageLeads.length,
            value: stageLeads.reduce((total, lead) => total + lead.expectedValue, 0),
            color: stageColors[stage]
          };
        });
        this.recentLeads = [...allLeads]
          .sort((left, right) => this.timestamp(right.updatedAt) - this.timestamp(left.updatedAt))
          .slice(0, 5);
        this.offices = (offices.branchOffices ?? []).map(office =>
          this.summarizeOffice(office, allEmployees, this.tickets)
        );
        this.recentTickets = [...this.tickets]
          .sort((left, right) => this.timestamp(right.createdAt) - this.timestamp(left.createdAt))
          .slice(0, 6);
        this.activities = this.buildActivities(this.tickets);
        this.lastUpdated = new Date().toISOString();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load the operations dashboard.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  exportTickets(): void {
    if (!this.tickets.length) return;
    const columns: (keyof Ticket)[] = [
      'ticketNumber', 'subject', 'customerName', 'branchName', 'category',
      'priority', 'status', 'assignedTo', 'createdAt', 'updatedAt'
    ];
    const lines = [
      columns.join(','),
      ...this.tickets.map(ticket => columns.map(column => this.csvValue(ticket[column])).join(','))
    ];
    this.downloadCsv(lines.join('\r\n'), 'service-hub-tickets.csv');
  }

  statusClass(status: Ticket['status']): string {
    if (status === 'Resolved' || status === 'Closed') return 'border-white/10 bg-white/[0.07] text-white';
    if (status === 'New') return 'border-white/10 bg-white/[0.04] text-slate-300';
    if (status === 'On Hold') return 'border-white/10 bg-white/[0.03] text-slate-400';
    return 'border-white/10 bg-white/[0.06] text-slate-200';
  }

  private summarizeOffice(
    office: OfficeBranchRecord,
    employees: EmployeeRecord[],
    tickets: Ticket[]
  ): OfficeSummary {
    const officeEmployees = employees.filter(employee => employee.officeBranchId === office._id);
    const employeeIds = new Set(officeEmployees.map(employee => employee._id));
    const officeTickets = tickets.filter(ticket => !!ticket.assignedEmployeeId && employeeIds.has(ticket.assignedEmployeeId));
    return {
      ...office,
      employees: officeEmployees.length,
      openTickets: officeTickets.filter(ticket => !this.isResolved(ticket.status)).length,
      inProgress: officeTickets.filter(ticket => ticket.status === 'In Progress').length,
      resolved: officeTickets.filter(ticket => this.isResolved(ticket.status)).length
    };
  }

  private buildActivities(tickets: Ticket[]): ActivityItem[] {
    return tickets.flatMap(ticket => {
      const history: TicketHistoryEvent[] = ticket.history?.length
        ? ticket.history
        : [{
            type: 'created',
            title: 'Ticket received',
            description: 'The service request was created.',
            actorName: 'Service desk',
            actorRole: 'system',
            createdAt: ticket.createdAt
          }];
      return history.map((event, index) => ({
        id: `${ticket._id}:${index}`,
        title: `${event.title} · ${ticket.ticketNumber}`,
        description: event.description,
        createdAt: event.createdAt
      }));
    })
      .sort((left, right) => this.timestamp(right.createdAt) - this.timestamp(left.createdAt))
      .slice(0, 8);
  }

  private isResolved(status: Ticket['status']): boolean {
    return status === 'Resolved' || status === 'Closed';
  }

  private timestamp(value: string): number {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private csvValue(value: unknown): string {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  }

  private downloadCsv(content: string, filename: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
