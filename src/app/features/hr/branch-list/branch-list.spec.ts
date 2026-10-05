import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BranchList } from './branch-list';
import { commonTestProviders } from '../../../../testing/test-providers';

describe('BranchList', () => {
  let component: BranchList;
  let fixture: ComponentFixture<BranchList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BranchList],
      providers: [...commonTestProviders],
    }).compileComponents();

    fixture = TestBed.createComponent(BranchList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
