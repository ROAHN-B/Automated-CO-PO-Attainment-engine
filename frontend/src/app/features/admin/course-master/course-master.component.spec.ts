import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { CourseMasterComponent } from './course-master.component';

describe('CourseMasterComponent', () => {
  let component: CourseMasterComponent;
  let fixture: ComponentFixture<CourseMasterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseMasterComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CourseMasterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
