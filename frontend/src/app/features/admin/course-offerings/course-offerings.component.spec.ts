import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { CourseOfferingsComponent } from './course-offerings.component';

describe('CourseOfferingsComponent', () => {
  let component: CourseOfferingsComponent;
  let fixture: ComponentFixture<CourseOfferingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseOfferingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
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
