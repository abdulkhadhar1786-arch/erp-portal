import { CommonModule } from '@angular/common';

import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ActivatedRoute,
  Router,
  RouterLink
} from '@angular/router';
import { forkJoin } from 'rxjs';

import {
  Ticket,
  TicketService
} from '../../../core/services/ticket.service';
import { EmployeeRecord, HrService } from '../../../core/services/hr.service';


interface TimelineItem {

  title: string;

  description: string;

  date: string;

  user: string;

}


@Component({
  selector: 'app-ticket-details',
  standalone: true,

  imports: [
    CommonModule,
    RouterLink,
    FormsModule
  ],

  templateUrl: './ticket-details.html'
})
export class TicketDetails
  implements OnInit {

  @Input() embeddedTicketId = '';
  @Output() closeRequested = new EventEmitter<void>();

  ticketId = '';

  ticket: Ticket | null = null;

  readonly statuses: Ticket['status'][] = [
    'New',
    'Assigned',
    'In Progress',
    'On Hold',
    'Resolved',
    'Closed'
  ];

  selectedStatus: Ticket['status'] = 'New';

  loading = false;

  deleting = false;

  savingStatus = false;

  errorMessage = '';

  successMessage = '';

  timeline: TimelineItem[] = [];

  engineers: EmployeeRecord[] = [];
  employeesNeedingSetup: EmployeeRecord[] = [];
  hasActiveEmployees = false;

  selectedEngineerId = '';

  loadingEngineers = false;
  engineerLoadError = '';

  savingAssignment = false;


  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ticketService: TicketService,
    private hrService: HrService,
    private changeDetector: ChangeDetectorRef
  ) {}


  ngOnInit(): void {

    this.ticketId =
      this.embeddedTicketId ||
      (this.route.snapshot.paramMap.get('id') ?? '');

    console.log(
      'Loading ticket:',
      this.ticketId
    );


    if (!this.ticketId) {

      this.errorMessage =
        'Ticket ID is missing.';

      return;

    }


    this.loadTicket();
    this.loadEngineers();

  }

  closeDetails(): void {
    if (this.embeddedTicketId) {
      this.closeRequested.emit();
      return;
    }

    void this.router.navigate(['/admin/service/tickets']);
  }


  /* ==========================================================
     LOAD TICKET
     ========================================================== */

  loadTicket(): void {

    this.loading = true;

    this.errorMessage = '';

    this.successMessage = '';


    this.ticketService
      .getTicketById(
        this.ticketId
      )
      .subscribe({

        next: response => {

          console.log(
            'Ticket details response:',
            response
          );


          this.ticket =
            response.ticket;

          this.selectedStatus = response.ticket.status;
          this.selectedEngineerId = response.ticket.assignedEmployeeId ?? '';


          this.buildTimeline();


          this.loading = false;
          this.changeDetector.markForCheck();

        },


        error: error => {

          console.error(
            'Ticket details error:',
            error
          );


          this.ticket = null;

          this.timeline = [];

          this.loading = false;


          if (
            error?.status === 404
          ) {

            this.errorMessage =
              'Ticket not found.';

          } else {

            this.errorMessage =
              error?.error?.message ??
              'Unable to load ticket.';

          }

          this.changeDetector.markForCheck();

        }

      });

  }


  /* ==========================================================
     BUILD TIMELINE
     ========================================================== */

  private buildTimeline(): void {
    this.timeline = [];
    if (!this.ticket) {
      return;
    }

    const history = this.ticket.history ?? [];
    this.timeline = history.map(event => ({
      title: event.title,
      description: event.description,
      date: event.createdAt,
      user: event.actorName
    }));

    if (!history.some(event => event.type === 'created')) {
      this.timeline.push({
        title: 'Ticket Created',
        description: 'Ticket was created. Detailed activity history is unavailable for this event.',
        date: this.ticket.createdAt,
        user: this.ticket.branchName || 'System'
      });
    }

    const statusEvents = history.filter(event => event.type === 'status_changed');
    const lastStatusEvent = statusEvents[statusEvents.length - 1];
    const currentStatusTitle = `Status changed to ${this.ticket.status}`;
    if (
      (this.ticket.status !== 'New' || statusEvents.length > 0) &&
      lastStatusEvent?.title !== currentStatusTitle
    ) {
      this.timeline.push({
        title: this.ticket.status === 'Closed' ? 'Ticket Closed' : `Current status: ${this.ticket.status}`,
        description: `Ticket is currently ${this.ticket.status}. The exact transition time was not recorded.`,
        date: this.ticket.updatedAt,
        user: 'Ticket record'
      });
    }

    this.timeline.sort(
      (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
    );
  }


  /* ==========================================================
     STATUS TITLE
     ========================================================== */

  private getStatusTitle(
    status: Ticket['status']
  ): string {

    switch (status) {

      case 'Assigned':
        return 'Ticket Assigned';

      case 'In Progress':
        return 'Work Started';

      case 'On Hold':
        return 'Ticket Put On Hold';

      case 'Resolved':
        return 'Ticket Resolved';

      case 'Closed':
        return 'Ticket Closed';

      default:
        return 'Ticket Updated';

    }

  }


  /* ==========================================================
     STATUS DESCRIPTION
     ========================================================== */

  private getStatusDescription(
    status: Ticket['status']
  ): string {

    switch (status) {

      case 'Assigned':
        return 'Ticket has been assigned to an employee.';

      case 'In Progress':
        return 'Work on this ticket is currently in progress.';

      case 'On Hold':
        return 'Ticket has been placed on hold.';

      case 'Resolved':
        return 'The reported issue has been resolved.';

      case 'Closed':
        return 'The ticket has been closed.';

      default:
        return 'Ticket information was updated.';

    }

  }


  /* ==========================================================
     STATUS CLASS HELPERS
     ========================================================== */

  getStatusClass(): string {

    if (!this.ticket) {

      return '';

    }


    switch (this.ticket.status) {

      case 'New':
        return 'border-white/[0.08] bg-white/[0.04] text-slate-300';

      case 'Assigned':
        return 'border-white/[0.08] bg-white/[0.05] text-slate-200';

      case 'In Progress':
        return 'border-white/[0.08] bg-white/[0.06] text-white';

      case 'On Hold':
        return 'border-white/[0.08] bg-white/[0.04] text-slate-300';

      case 'Resolved':
        return 'border-white/[0.08] bg-white/[0.05] text-slate-200';

      case 'Closed':
        return 'border-white/[0.08] bg-white/[0.03] text-slate-400';

      default:
        return 'border-white/[0.08] bg-white/[0.04] text-slate-300';

    }

  }


  getPriorityClass(): string {

    if (!this.ticket) {

      return '';

    }


    switch (this.ticket.priority) {

      case 'Critical':
        return 'border-white/[0.10] bg-white/[0.07] text-white';

      case 'High':
        return 'border-white/[0.08] bg-white/[0.06] text-white';

      case 'Medium':
        return 'border-white/[0.08] bg-white/[0.04] text-slate-300';

      case 'Low':
        return 'border-white/[0.08] bg-white/[0.03] text-slate-400';

      default:
        return 'border-white/[0.08] bg-white/[0.04] text-slate-300';

    }

  }


  /* ==========================================================
     DELETE TICKET
     ========================================================== */

  deleteTicket(): void {

    if (!this.ticket || this.deleting || this.savingAssignment || this.savingStatus) {

      return;

    }


    const confirmed =
      window.confirm(
        `Delete ${this.ticket.ticketNumber}?`
      );


    if (!confirmed) {

      return;

    }


    this.deleting = true;

    this.errorMessage = '';


    this.ticketService
      .deleteTicket(
        this.ticket._id
      )
      .subscribe({

        next: response => {

          console.log(
            'Ticket deleted:',
            response
          );


          this.closeDetails();

        },


        error: error => {

          console.error(
            'Delete ticket error:',
            error
          );


          this.deleting = false;


          this.errorMessage =
            error?.error?.message ??
            'Unable to delete ticket.';

          this.changeDetector.markForCheck();

        }

      });

  }


  /* ==========================================================
     EDIT / UPDATE
     ========================================================== */

  updateStatus(): void {
    const status = this.selectedStatus;

    if (
      !this.ticket ||
      this.ticket.status === status ||
      this.savingStatus ||
      this.savingAssignment
    ) {

      return;

    }


    this.savingStatus = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.ticketService
      .updateTicket(
        this.ticket._id,
        {
          status
        }
      )
      .subscribe({

        next: response => {

          this.ticket =
            response.ticket;

          this.selectedStatus = response.ticket.status;
          this.buildTimeline();

          this.successMessage =
            'Ticket status updated successfully.';

          this.savingStatus = false;
          this.changeDetector.markForCheck();

        },


        error: error => {

          console.error(
            'Update ticket error:',
            error
          );


          this.errorMessage =
            error?.error?.message ??
            'Unable to update ticket.';

          this.savingStatus = false;
          this.changeDetector.markForCheck();

        }

      });

  }


  loadEngineers(): void {
    this.loadingEngineers = true;
    this.engineerLoadError = '';
    forkJoin({
      employeeResponse: this.hrService.getEmployees(),
      officeResponse: this.hrService.getOfficeBranches()
    }).subscribe({
      next: ({ employeeResponse, officeResponse }) => {
        const activeOfficeIds = new Set(
          officeResponse.branchOffices
            .filter(office => office.status === 'Active')
            .map(office => office._id)
        );
        const activeEmployees = employeeResponse.employees.filter(employee => employee.status === 'Active');
        this.hasActiveEmployees = activeEmployees.length > 0;
        this.engineers = activeEmployees.filter(employee => employee.canLogin && activeOfficeIds.has(employee.officeBranchId));
        this.employeesNeedingSetup = activeEmployees.filter(employee => !employee.canLogin || !activeOfficeIds.has(employee.officeBranchId));
        this.loadingEngineers = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.engineers = [];
        this.employeesNeedingSetup = [];
        this.hasActiveEmployees = false;
        this.engineerLoadError = 'Unable to load engineer options. Try again.';
        this.loadingEngineers = false;
        this.changeDetector.markForCheck();
      }
    });
  }

  get currentAssigneeUnavailable(): boolean {
    return !!this.selectedEngineerId && !this.engineers.some(engineer => engineer._id === this.selectedEngineerId);
  }

  assignTicket(): void {
    if (!this.ticket || this.savingAssignment || this.savingStatus) return;
    this.savingAssignment = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.ticketService.updateTicket(this.ticket._id, {
      assignedEmployeeId: this.selectedEngineerId
    }).subscribe({
      next: response => {
        this.ticket = response.ticket;
        this.selectedStatus = response.ticket.status;
        this.selectedEngineerId = response.ticket.assignedEmployeeId ?? '';
        this.buildTimeline();
        this.successMessage = 'Ticket assignment updated successfully.';
        this.savingAssignment = false;
        this.changeDetector.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to update assignment.';
        this.savingAssignment = false;
        this.changeDetector.markForCheck();
      }
    });
  }

}
