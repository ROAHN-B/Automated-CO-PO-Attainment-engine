import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PoPsoManagementComponent } from './po-pso-management.component';

describe('PoPsoManagementComponent', () => {
  let component: PoPsoManagementComponent;
  let fixture: ComponentFixture<PoPsoManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoPsoManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PoPsoManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
