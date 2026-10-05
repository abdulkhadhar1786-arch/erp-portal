import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DefectiveReturn, SpareIssue, SpareService } from '../../../core/services/spare.service';

@Component({
  selector: 'app-defective-returns',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './defective-returns.html'
})
export class DefectiveReturns implements OnInit {
  issues: SpareIssue[] = [];
  returns: DefectiveReturn[] = [];
  issueId = '';
  quantity = 1;
  reason = '';
  loading = true;
  saving = false;
  busyId = '';
  errorMessage = '';
  notice = '';

  constructor(private spares: SpareService, private route: ActivatedRoute, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.issueId = params.get('issueId') ?? this.issueId;
      this.cdr.markForCheck();
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({ issues: this.spares.getIssues(), returns: this.spares.getReturns() }).subscribe({
      next: ({ issues, returns }) => {
        this.issues = issues.issues ?? [];
        this.returns = returns.returns ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load defective return records.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get eligibleIssues(): SpareIssue[] {
    return this.issues.filter(issue => this.remaining(issue) > 0);
  }

  get submittedCount(): number {
    return this.returns.filter(record => record.status === 'Submitted').length;
  }

  remaining(issue: SpareIssue): number {
    return Math.max(0, issue.quantity - issue.returnedQuantity);
  }

  submit(): void {
    if (this.saving) return;
    this.saving = true;
    this.errorMessage = '';
    this.notice = '';
    this.spares.createReturn({ issueId: this.issueId, quantity: Number(this.quantity), reason: this.reason.trim() }).subscribe({
      next: ({ return: record }) => {
        this.returns = [record, ...this.returns];
        const issue = this.issues.find(item => item._id === record.issueId);
        if (issue) issue.returnedQuantity += record.quantity;
        this.issueId = '';
        this.quantity = 1;
        this.reason = '';
        this.notice = `${record.returnNumber} submitted and linked to ${record.issueNumber}.`;
        this.saving = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to submit this defective return.';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  updateStatus(record: DefectiveReturn, status: 'Received' | 'Rejected'): void {
    if (this.busyId || record.status !== 'Submitted') return;
    this.busyId = record._id;
    this.errorMessage = '';
    this.spares.updateReturn(record._id, status).subscribe({
      next: ({ return: updated }) => {
        this.returns = this.returns.map(existing => existing._id === updated._id ? updated : existing);
        if (status === 'Rejected') {
          const issue = this.issues.find(item => item._id === updated.issueId);
          if (issue) issue.returnedQuantity = Math.max(0, issue.returnedQuantity - updated.quantity);
        }
        this.notice = `${updated.returnNumber} marked ${updated.status.toLowerCase()}.`;
        this.busyId = '';
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to update defective return.';
        this.busyId = '';
        this.cdr.markForCheck();
      }
    });
  }
}
