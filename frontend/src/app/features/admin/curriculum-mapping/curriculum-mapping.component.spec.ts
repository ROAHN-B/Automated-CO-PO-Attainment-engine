import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { CurriculumMappingComponent } from './curriculum-mapping.component';

describe('CurriculumMappingComponent', () => {
  let component: CurriculumMappingComponent;
  let fixture: ComponentFixture<CurriculumMappingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurriculumMappingComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CurriculumMappingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
