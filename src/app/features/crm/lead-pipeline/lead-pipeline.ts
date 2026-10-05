import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CrmLead, CrmService, LEAD_SOURCES, LEAD_STAGES, LeadPayload, LeadSource, LeadStage } from '../../../core/services/crm.service';

interface LeadDraft {
  companyName: string;
  contactName: string;
  contactTitle: string;
  email: string;
  phone: string;
  industry: string;
  source: LeadSource;
  stage: LeadStage;
  expectedValue: number;
  probability: number;
  targetCloseDate: string;
  campaign: string;
  competitor: string;
  lostReason: string;
  owner: string;
  nextFollowUp: string;
  notes: string;
}

function emptyDraft(): LeadDraft {
  return {
    companyName: '', contactName: '', contactTitle: '', email: '', phone: '', industry: '',
    source: 'Website', stage: 'New', expectedValue: 0, probability: 10, targetCloseDate: '',
    campaign: '', competitor: '', lostReason: '', owner: '', nextFollowUp: '', notes: ''
  };
}

@Component({
  selector: 'app-lead-pipeline',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './lead-pipeline.html',
  styleUrl: './lead-pipeline.css'
})
export class LeadPipeline implements OnInit {
  readonly stages = LEAD_STAGES;
  readonly activeStages = LEAD_STAGES.slice(0, 4);
  readonly sources = LEAD_SOURCES;
  leads: CrmLead[] = [];
  loading = true;
  saving = false;
  modalOpen = false;
  searchText = '';
  sourceFilter = '';
  ownerFilter = '';
  stageFilter = '';
  sortBy: 'updatedAt' | 'expectedValue' | 'probability' | 'nextFollowUp' = 'updatedAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  viewMode: 'board' | 'list' = 'board';
  page = 1;
  pageSize = 20;
  errorMessage = '';
  draft = emptyDraft();
  editingId = '';
  savingStageId = '';
  convertingId = '';
  notice = '';

  constructor(private crm: CrmService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.crm.getLeads().subscribe({
      next: response => {
        this.leads = response.leads ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load the CRM pipeline.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get activeLeads(): CrmLead[] {
    return this.leads.filter(lead => lead.stage !== 'Won' && lead.stage !== 'Lost');
  }

  get pipelineValue(): number {
    return this.activeLeads.reduce((total, lead) => total + lead.expectedValue, 0);
  }

  get weightedPipelineValue(): number {
    return this.activeLeads.reduce((total, lead) => total + lead.expectedValue * (lead.probability ?? 10) / 100, 0);
  }

  get winRate(): number {
    const closed = this.leads.filter(lead => lead.stage === 'Won' || lead.stage === 'Lost');
    return closed.length ? Math.round(closed.filter(lead => lead.stage === 'Won').length / closed.length * 100) : 0;
  }

  get ownerOptions(): string[] {
    return [...new Set(this.leads.map(lead => lead.owner.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  get followUpsToWork(): CrmLead[] {
    return this.activeLeads.filter(lead => !!lead.nextFollowUp)
      .sort((a, b) => Date.parse(a.nextFollowUp!) - Date.parse(b.nextFollowUp!)).slice(0, 5);
  }

  get wonValue(): number {
    return this.leads.filter(lead => lead.stage === 'Won')
      .reduce((total, lead) => total + lead.expectedValue, 0);
  }

  get followUpsDue(): number {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return this.activeLeads.filter(lead => !!lead.nextFollowUp && new Date(lead.nextFollowUp) <= today).length;
  }

  isFollowUpDue(lead: CrmLead): boolean {
    if (!lead.nextFollowUp) return false;
    const followUp = new Date(lead.nextFollowUp);
    const today = new Date();
    followUp.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return followUp <= today;
  }

  get matchingLeads(): CrmLead[] {
    const query = this.searchText.trim().toLowerCase();
    return this.leads.filter(lead => {
      const searchable = [lead.leadNumber, lead.companyName, lead.contactName, lead.email, lead.industry,
        lead.owner, lead.source, lead.campaign ?? '', lead.competitor ?? ''];
      return (!query || searchable.some(value => value.toLowerCase().includes(query))) &&
        (!this.sourceFilter || lead.source === this.sourceFilter) &&
        (!this.ownerFilter || (this.ownerFilter === '__unassigned' ? !lead.owner : lead.owner === this.ownerFilter)) &&
        (!this.stageFilter || lead.stage === this.stageFilter);
    });
  }

  get sortedLeads(): CrmLead[] {
    const direction = this.sortDirection === 'asc' ? 1 : -1;
    return [...this.matchingLeads].sort((a, b) => {
      if (this.sortBy === 'nextFollowUp' && (!!a.nextFollowUp !== !!b.nextFollowUp)) return a.nextFollowUp ? -1 : 1;
      const left = this.sortBy === 'expectedValue' ? a.expectedValue
        : this.sortBy === 'probability' ? (a.probability ?? 0)
          : this.sortBy === 'nextFollowUp' ? (a.nextFollowUp ? Date.parse(a.nextFollowUp) : 0)
            : Date.parse(a.updatedAt);
      const right = this.sortBy === 'expectedValue' ? b.expectedValue
        : this.sortBy === 'probability' ? (b.probability ?? 0)
          : this.sortBy === 'nextFollowUp' ? (b.nextFollowUp ? Date.parse(b.nextFollowUp) : 0)
            : Date.parse(b.updatedAt);
      return (left - right) * direction || a.companyName.localeCompare(b.companyName);
    });
  }

  get pageCount(): number { return Math.max(1, Math.ceil(this.sortedLeads.length / this.pageSize)); }
  get currentPage(): number { return Math.min(this.page, this.pageCount); }
  get pageLeads(): CrmLead[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedLeads.slice(start, start + this.pageSize);
  }

  changePage(page: number): void { this.page = Math.min(this.pageCount, Math.max(1, page)); }

  exportCsv(): void {
    const columns = ['Lead', 'Company', 'Contact', 'Title', 'Email', 'Phone', 'Industry', 'Source', 'Campaign', 'Stage', 'Expected value', 'Probability', 'Weighted value', 'Target close', 'Competitor', 'Owner', 'Next follow-up', 'Lost reason', 'Notes'];
    const rows = this.sortedLeads.map(lead => [lead.leadNumber, lead.companyName, lead.contactName, lead.contactTitle,
      lead.email, lead.phone, lead.industry, lead.source, lead.campaign, lead.stage, lead.expectedValue,
      lead.probability ?? 10, Math.round(lead.expectedValue * (lead.probability ?? 10) / 100), lead.targetCloseDate?.slice(0, 10) ?? '',
      lead.competitor ?? '', lead.owner, lead.nextFollowUp?.slice(0, 10) ?? '', lead.lostReason ?? '', lead.notes]);
    const csv = [columns, ...rows].map(row => row.map(value => {
      let cell = String(value ?? '');
      if (/^[=+\-@]/.test(cell.trimStart())) cell = `'${cell}`;
      return `"${cell.replaceAll('"', '""')}"`;
    }).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `crm-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  leadsFor(stage: LeadStage): CrmLead[] {
    return this.sortedLeads.filter(lead => lead.stage === stage);
  }

  stageValue(stage: LeadStage): number {
    return this.leadsFor(stage).reduce((total, lead) => total + lead.expectedValue, 0);
  }

  get closedLeads(): CrmLead[] {
    return this.sortedLeads.filter(lead => lead.stage === 'Won' || lead.stage === 'Lost');
  }

  openCreate(): void {
    this.editingId = '';
    this.draft = emptyDraft();
    this.errorMessage = '';
    this.modalOpen = true;
  }

  openEdit(lead: CrmLead): void {
    this.editingId = lead._id;
    this.draft = {
      companyName: lead.companyName,
      contactName: lead.contactName,
      contactTitle: lead.contactTitle ?? '',
      email: lead.email,
      phone: lead.phone,
      industry: lead.industry,
      source: lead.source,
      stage: lead.stage,
      expectedValue: lead.expectedValue,
      probability: lead.probability ?? 10,
      targetCloseDate: lead.targetCloseDate ? lead.targetCloseDate.slice(0, 10) : '',
      campaign: lead.campaign ?? '',
      competitor: lead.competitor ?? '',
      lostReason: lead.lostReason ?? '',
      owner: lead.owner,
      nextFollowUp: lead.nextFollowUp ? lead.nextFollowUp.slice(0, 10) : '',
      notes: lead.notes
    };
    this.errorMessage = '';
    this.modalOpen = true;
  }

  closeModal(): void {
    if (this.saving) return;
    this.modalOpen = false;
  }

  saveLead(): void {
    if (this.saving) return;
    if (!Number.isFinite(Number(this.draft.expectedValue)) || Number(this.draft.expectedValue) < 0 ||
      !Number.isFinite(Number(this.draft.probability)) || Number(this.draft.probability) < 0 || Number(this.draft.probability) > 100) {
      this.errorMessage = 'Enter a valid value and a probability between 0 and 100.';
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    const payload: LeadPayload = {
      ...this.draft,
      companyName: this.draft.companyName.trim(),
      contactName: this.draft.contactName.trim(),
      email: this.draft.email.trim(),
      phone: this.draft.phone.trim(),
      contactTitle: this.draft.contactTitle.trim(),
      industry: this.draft.industry.trim(),
      owner: this.draft.owner.trim(),
      nextFollowUp: this.draft.nextFollowUp || null,
      targetCloseDate: this.draft.targetCloseDate || null,
      campaign: this.draft.campaign.trim(),
      competitor: this.draft.competitor.trim(),
      lostReason: this.draft.lostReason.trim(),
      notes: this.draft.notes.trim()
    };
    const request = this.editingId
      ? this.crm.updateLead(this.editingId, payload)
      : this.crm.createLead(payload);
    request.subscribe({
      next: ({ lead }) => {
        if (this.editingId) {
          this.leads = this.leads.map(existing => existing._id === lead._id ? lead : existing);
        } else {
          this.leads = [lead, ...this.leads];
        }
        this.notice = `${lead.leadNumber} saved.`;
        this.saving = false;
        this.modalOpen = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to save this lead.';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  changeStage(lead: CrmLead, stage: LeadStage): void {
    if (this.savingStageId || lead.stage === stage) return;
    this.savingStageId = lead._id;
    this.crm.updateLead(lead._id, {
      companyName: lead.companyName,
      contactName: lead.contactName,
      contactTitle: lead.contactTitle,
      email: lead.email,
      phone: lead.phone,
      industry: lead.industry,
      source: lead.source,
      stage,
      expectedValue: lead.expectedValue,
      probability: lead.probability,
      targetCloseDate: lead.targetCloseDate,
      campaign: lead.campaign,
      competitor: lead.competitor,
      lostReason: lead.lostReason,
      owner: lead.owner,
      nextFollowUp: lead.nextFollowUp,
      notes: lead.notes
    }).subscribe({
      next: ({ lead: updated }) => {
        this.leads = this.leads.map(existing => existing._id === updated._id ? updated : existing);
        this.savingStageId = '';
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to update lead stage.';
        this.savingStageId = '';
        this.cdr.markForCheck();
      }
    });
  }

  convertLead(lead: CrmLead): void {
    if (this.convertingId || lead.stage !== 'Won' || lead.customerId) return;
    this.convertingId = lead._id;
    this.errorMessage = '';
    this.crm.convertLeadToCustomer(lead._id).subscribe({
      next: ({ lead: updated, customer }) => {
        this.leads = this.leads.map(existing => existing._id === updated._id ? updated : existing);
        this.convertingId = '';
        this.notice = `${customer.code} · ${customer.name} is now available to Sales and Service.`;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to convert this won opportunity.';
        this.convertingId = '';
        this.cdr.markForCheck();
      }
    });
  }

  quoteLink(lead: CrmLead): string[] { return ['/admin/sales/quotes']; }

  stageTone(stage: LeadStage): string {
    return `stage-${stage.toLowerCase()}`;
  }
}
