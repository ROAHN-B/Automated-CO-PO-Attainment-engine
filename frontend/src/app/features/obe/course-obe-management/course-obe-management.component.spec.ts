import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { CourseObeManagementComponent } from './course-obe-management.component';

describe('CourseObeManagementComponent', () => {
  let component: CourseObeManagementComponent;
  let fixture: ComponentFixture<CourseObeManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseObeManagementComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CourseObeManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
