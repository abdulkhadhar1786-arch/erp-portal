import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TicketDetails } from './ticket-details';
import { commonTestProviders } from '../../../../testing/test-providers';

describe('TicketDetails', () => {
  let component: TicketDetails;
  let fixture: ComponentFixture<TicketDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketDetails],
      providers: [...commonTestProviders],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
