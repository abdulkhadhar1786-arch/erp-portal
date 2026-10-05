import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BranchDetails } from './branch-details';
import { commonTestProviders } from '../../../../testing/test-providers';

describe('BranchDetails', () => {
  let component: BranchDetails;
  let fixture: ComponentFixture<BranchDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BranchDetails],
      providers: [...commonTestProviders],
    }).compileComponents();

    fixture = TestBed.createComponent(BranchDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
