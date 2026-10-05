import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthResponse, ApiHealth, AuthService } from '../../../core/services/auth.service';
import { QuoteProfile, SalesService } from '../../../core/services/sales.service';

const emptyCompanyProfile: QuoteProfile = {
  companyName: '',
  companyAddress: '',
  companyState: '',
  companyPhone: '',
  companyEmail: '',
  companyWebsite: '',
  companyPan: '',
  companyGstin: '',
  companyMsme: '',
  bankName: '',
  bankAccountNumber: '',
  bankBranch: '',
  bankIfsc: '',
  contactName: '',
  contactPhone: '',
  contactMobile: '',
  contactEmail: '',
  authorizedSignatory: '',
  defaultValidityDays: 30,
  defaultTerms: ''
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings implements OnInit {
  activeSettingsTab: 'company-profile' | 'quotation-defaults' | 'account' = 'company-profile';
  account?: AuthResponse;
  health?: ApiHealth;
  accountError = '';
  healthError = '';
  loadingAccount = true;
  loadingHealth = true;
  signingOut = false;
  companyProfile: QuoteProfile = { ...emptyCompanyProfile };
  loadingCompanyProfile = true;
  savingCompanyProfile = false;
  companyProfileError = '';
  companyProfileMessage = '';

  constructor(
    private auth: AuthService,
    private sales: SalesService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.refresh();
    this.loadCompanyProfile();
  }

  onSettingsTabKeydown(event: KeyboardEvent): void {
    const tabs = event.currentTarget instanceof HTMLElement
      ? event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      : undefined;
    if (!tabs?.length) return;

    const currentIndex = Array.from(tabs).indexOf(event.currentTarget as HTMLButtonElement);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  }

  refresh(): void {
    this.refreshAccount();
    this.refreshHealth();
  }

  loadCompanyProfile(): void {
    this.loadingCompanyProfile = true;
    this.companyProfileError = '';
    this.companyProfileMessage = '';
    this.sales.getQuoteProfile().subscribe({
      next: ({ profile }) => {
        this.companyProfile = { ...emptyCompanyProfile, ...profile };
        this.loadingCompanyProfile = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.companyProfileError = error?.error?.message ?? 'Unable to load the company profile.';
        this.loadingCompanyProfile = false;
        this.cdr.markForCheck();
      }
    });
  }

  saveCompanyProfile(): void {
    this.saveProfile('Company profile saved. New quotations will use these details.');
  }

  saveQuotationDefaults(): void {
    this.saveProfile('Quotation defaults saved.');
  }

  private saveProfile(successMessage: string): void {
    if (this.savingCompanyProfile || this.loadingCompanyProfile) return;

    this.savingCompanyProfile = true;
    this.companyProfileError = '';
    this.companyProfileMessage = '';
    const profile: QuoteProfile = {
      ...this.companyProfile,
      companyName: this.companyProfile.companyName.trim(),
      companyAddress: this.companyProfile.companyAddress.trim(),
      companyState: this.companyProfile.companyState.trim(),
      companyPhone: this.companyProfile.companyPhone.trim(),
      companyEmail: this.companyProfile.companyEmail.trim(),
      companyWebsite: this.companyProfile.companyWebsite.trim(),
      companyPan: this.companyProfile.companyPan.trim().toUpperCase(),
      companyGstin: this.companyProfile.companyGstin.trim().toUpperCase(),
      companyMsme: this.companyProfile.companyMsme.trim().toUpperCase(),
      bankName: this.companyProfile.bankName.trim(),
      bankAccountNumber: this.companyProfile.bankAccountNumber.trim(),
      bankBranch: this.companyProfile.bankBranch.trim(),
      bankIfsc: this.companyProfile.bankIfsc.trim().toUpperCase(),
      contactName: this.companyProfile.contactName.trim(),
      contactPhone: this.companyProfile.contactPhone.trim(),
      contactMobile: this.companyProfile.contactMobile.trim(),
      contactEmail: this.companyProfile.contactEmail.trim(),
      authorizedSignatory: this.companyProfile.authorizedSignatory.trim(),
      defaultValidityDays: Number(this.companyProfile.defaultValidityDays),
      defaultTerms: this.companyProfile.defaultTerms.trim()
    };

    this.sales.updateQuoteProfile(profile).subscribe({
      next: ({ profile: savedProfile }) => {
        this.companyProfile = { ...emptyCompanyProfile, ...savedProfile };
        this.companyProfileMessage = successMessage;
        this.savingCompanyProfile = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.companyProfileError = error?.error?.message ?? 'Unable to save the company profile.';
        this.savingCompanyProfile = false;
        this.cdr.markForCheck();
      }
    });
  }

  refreshAccount(): void {
    this.loadingAccount = true;
    this.accountError = '';
    this.auth.getSession().subscribe({
      next: account => {
        this.account = account;
        this.loadingAccount = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.accountError = error?.error?.message ?? 'Unable to load the signed-in account.';
        this.loadingAccount = false;
        this.cdr.markForCheck();
      }
    });
  }

  refreshHealth(): void {
    this.loadingHealth = true;
    this.healthError = '';
    this.auth.getHealth().subscribe({
      next: health => {
        this.health = health;
        this.loadingHealth = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.health = error?.error?.database
          ? error.error as ApiHealth
          : undefined;
        this.healthError = error?.status === 503
          ? 'The API is reachable, but the database is disconnected.'
          : 'Unable to reach the API health endpoint.';
        this.loadingHealth = false;
        this.cdr.markForCheck();
      }
    });
  }

  signOut(): void {
    if (this.signingOut) return;
    this.signingOut = true;
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => {
        this.signingOut = false;
        this.accountError = 'Unable to sign out. Check the service connection and try again.';
        this.cdr.markForCheck();
      }
    });
  }
}
