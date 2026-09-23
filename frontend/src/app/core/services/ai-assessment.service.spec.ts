import { TestBed } from '@angular/core/testing';

import { AiAssessmentService } from './ai-assessment.service';

describe('AiAssessmentService', () => {
  let service: AiAssessmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AiAssessmentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
