import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router'; // <-- 1. Import Router

@Component({
  selector: 'app-institution-setup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './institution-setup.component.html'
})
export class InstitutionSetupComponent implements OnInit {
  institutionForm!: FormGroup;
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  private fb = inject(FormBuilder);
  private router = inject(Router); // <-- 2. Inject Router using modern inject() pattern

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.institutionForm = this.fb.group({
      institutionCode: ['', [Validators.required]],
      institutionName: ['', [Validators.required]],
      shortName: ['', [Validators.required]],
      institutionType: ['AUTONOMOUS', [Validators.required]],
      institutionCategory: ['ENGINEERING', [Validators.required]],
      universityName: ['', [Validators.required]],
      universityCode: [''],
      aicteCode: [''],
      nbaAccredited: [false],
      naacGrade: [''],
      establishmentYear: [null, [Validators.min(1800), Validators.max(2026)]],
      principalName: [''],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      alternatePhone: [''],
      website: [''],
      logoUrl: [''],
      address: this.fb.group({
        street: ['', [Validators.required]],
        city: ['', [Validators.required]],
        state: ['', [Validators.required]],
        country: ['', [Validators.required]],
        postalCode: ['', [Validators.required]]
      }),
      status: ['ACTIVE', [Validators.required]],
      timezone: ['Asia/Kolkata'],
      currency: ['INR'],
      language: ['en']
    });
  }

  onSubmit(): void {
    if (this.institutionForm.invalid) {
      this.institutionForm.markAllAsTouched();
      this.errorMessage = 'Please fix the highlighted errors before saving.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = this.institutionForm.value;

    // Simulate API request persistence to database
    setTimeout(() => {
      console.log('Saving Institution Configuration:', payload);
      this.isSubmitting = false;
      this.successMessage = 'Institution profile updated successfully.';

      // <-- 3. Redirect to the next Module 1 step after a short delay
      setTimeout(() => {
        this.router.navigate(['/admin/academic-config']);
      }, 1000);

    }, 1000);
  }
}