import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { CoPoMappingComponent } from './co-po-mapping.component';

describe('CoPoMappingComponent', () => {
  let component: CoPoMappingComponent;
  let fixture: ComponentFixture<CoPoMappingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoPoMappingComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
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
