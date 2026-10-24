import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { AiAssessmentService } from './ai-assessment.service';

describe('AiAssessmentService', () => {
  let service: AiAssessmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    service = TestBed.inject(AiAssessmentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
