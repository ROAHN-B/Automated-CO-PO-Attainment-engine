import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourseOfferingsComponent } from './course-offerings.component';

describe('CourseOfferingsComponent', () => {
  let component: CourseOfferingsComponent;
  let fixture: ComponentFixture<CourseOfferingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseOfferingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CourseOfferingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
