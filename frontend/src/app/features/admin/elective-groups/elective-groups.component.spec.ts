import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ElectiveGroupsComponent } from './elective-groups.component';

describe('ElectiveGroupsComponent', () => {
  let component: ElectiveGroupsComponent;
  let fixture: ComponentFixture<ElectiveGroupsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ElectiveGroupsComponent]
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
