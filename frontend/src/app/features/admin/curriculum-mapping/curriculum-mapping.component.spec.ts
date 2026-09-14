import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CurriculumMappingComponent } from './curriculum-mapping.component';

describe('CurriculumMappingComponent', () => {
  let component: CurriculumMappingComponent;
  let fixture: ComponentFixture<CurriculumMappingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurriculumMappingComponent]
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
