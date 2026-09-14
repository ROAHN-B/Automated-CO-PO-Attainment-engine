import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourseObeManagementComponent } from './course-obe-management.component';

describe('CourseObeManagementComponent', () => {
  let component: CourseObeManagementComponent;
  let fixture: ComponentFixture<CourseObeManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseObeManagementComponent]
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
