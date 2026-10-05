import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EmployeePayload, EmployeeRecord, HrService, HrStatus, OfficeBranchRecord } from '../../../core/services/hr.service';

@Component({
  selector: 'app-employee-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './employee-form.html'
})
export class EmployeeForm implements OnInit {
  id = '';
  offices: OfficeBranchRecord[] = [];
  loading = true;
  saving = false;
  submitted = false;
  errorMessage = '';
  loginPassword = '';
  canLogin = false;
  employee: EmployeePayload = {
    name: '', email: '', phone: '', jobTitle: '', department: '',
    officeBranchId: '', hireDate: '', status: 'Active'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: HrService,
    private cdr: ChangeDetectorRef
  ) {}

  get editing(): boolean { return !!this.id; }

  get activeOffices(): OfficeBranchRecord[] {
    return this.offices.filter(office => office.status === 'Active' || (this.editing && office._id === this.employee.officeBranchId));
  }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    let pending = this.editing ? 2 : 1;
    const done = (): void => {
      pending -= 1;
      if (pending === 0) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    };
    this.service.getOfficeBranches().subscribe({
      next: response => {
        this.offices = response.branchOffices;
        if (!this.employee.officeBranchId) this.employee.officeBranchId = this.activeOffices[0]?._id ?? '';
        done();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load branch offices.';
        done();
      }
    });
    if (!this.editing) return;
    this.service.getEmployee(this.id).subscribe({
      next: ({ employee }) => {
        this.canLogin = employee.canLogin;
        this.employee = {
          name: employee.name,
          email: employee.email,
          phone: employee.phone,
          jobTitle: employee.jobTitle,
          department: employee.department,
          officeBranchId: employee.officeBranchId,
          hireDate: employee.hireDate ? employee.hireDate.slice(0, 10) : '',
          status: employee.status
        };
        if (!this.offices.some(office => office._id === employee.officeBranchId)) {
          this.offices = [...this.offices, {
            _id: employee.officeBranchId,
            code: employee.officeBranchCode,
            name: employee.officeBranchName,
            email: '', phone: '', address: '', city: '', state: '',
            status: 'Inactive' as HrStatus,
            employeeCount: 1
          }];
        }
        done();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load employee.';
        done();
      }
    });
  }

  save(): void {
    this.submitted = true;
    this.errorMessage = '';
    if (
      !this.employee.name.trim() || !this.employee.officeBranchId ||
      (this.employee.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.employee.email)) ||
      (this.loginPassword.length > 0 && (this.loginPassword.length < 8 || !this.employee.email.trim()))
    ) return;
    const payload: EmployeePayload = {
      ...this.employee,
      name: this.employee.name.trim(),
      email: this.employee.email.trim(),
      phone: this.employee.phone.trim(),
      jobTitle: this.employee.jobTitle.trim(),
      department: this.employee.department.trim(),
      ...(this.loginPassword ? { password: this.loginPassword } : {})
    };
    this.saving = true;
    const request = this.editing
      ? this.service.updateEmployee(this.id, payload)
      : this.service.createEmployee(payload);
    request.subscribe({
      next: ({ employee: saved }: { employee: EmployeeRecord }) => {
        this.saving = false;
        this.cdr.markForCheck();
        void this.router.navigate(['/admin/hr/employees']);
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to save employee.';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }
}
