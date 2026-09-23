import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoPoMappingComponent } from './co-po-mapping.component';

describe('CoPoMappingComponent', () => {
  let component: CoPoMappingComponent;
  let fixture: ComponentFixture<CoPoMappingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoPoMappingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CoPoMappingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
