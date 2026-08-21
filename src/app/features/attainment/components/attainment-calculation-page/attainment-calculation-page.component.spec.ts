import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttainmentCalculationPageComponent } from './attainment-calculation-page.component';

describe('AttainmentCalculationPageComponent', () => {
  let component: AttainmentCalculationPageComponent;
  let fixture: ComponentFixture<AttainmentCalculationPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttainmentCalculationPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttainmentCalculationPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
