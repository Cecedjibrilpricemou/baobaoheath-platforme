import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Epidemio } from './epidemio';

describe('Epidemio', () => {
  let component: Epidemio;
  let fixture: ComponentFixture<Epidemio>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Epidemio],
    }).compileComponents();

    fixture = TestBed.createComponent(Epidemio);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
