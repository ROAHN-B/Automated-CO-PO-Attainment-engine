import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { PoPsoManagementComponent } from './po-pso-management.component';

describe('PoPsoManagementComponent', () => {
  let component: PoPsoManagementComponent;
  let fixture: ComponentFixture<PoPsoManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoPsoManagementComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
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
