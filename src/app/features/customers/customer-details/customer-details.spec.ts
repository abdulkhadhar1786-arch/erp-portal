import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerDetails } from './customer-details';
import { commonTestProviders } from '../../../../testing/test-providers';

describe('CustomerDetails', () => {
  let component: CustomerDetails;
  let fixture: ComponentFixture<CustomerDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerDetails],
      providers: [...commonTestProviders],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
