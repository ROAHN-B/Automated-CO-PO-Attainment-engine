import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionGeneratorPageComponent } from './question-generator-page.component';

describe('QuestionGeneratorPageComponent', () => {
  let component: QuestionGeneratorPageComponent;
  let fixture: ComponentFixture<QuestionGeneratorPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionGeneratorPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuestionGeneratorPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
