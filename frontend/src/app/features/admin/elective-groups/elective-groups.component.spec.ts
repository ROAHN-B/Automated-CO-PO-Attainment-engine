import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { ElectiveGroupsComponent } from './elective-groups.component';

describe('ElectiveGroupsComponent', () => {
  let component: ElectiveGroupsComponent;
  let fixture: ComponentFixture<ElectiveGroupsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ElectiveGroupsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ElectiveGroupsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
