// src/app/features/question-gen/components/question-generator-page/question-generator-page.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-question-generator-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './question-generator-page.component.html'
})
export class QuestionGeneratorPageComponent {
  currentStep: number = 1;

  // Pre-embedded Units available in Vector DB
  availableUnits = [
    { id: 'u1', name: 'Unit 1: Introduction to Data Structures', docsCount: 3 },
    { id: 'u2', name: 'Unit 2: Linear Data Structures (Stacks & Queues)', docsCount: 5 },
    { id: 'u3', name: 'Unit 3: Advanced Trees and Graphs', docsCount: 2 }
  ];
  selectedUnitId: string = 'u3';

  selectedMarks: number[] = [4, 6];
  selectedCo: string = 'CO2';

  generatedQuestions: Array<{id: number, text: string, marks: number, selected: boolean}> = [];
  isGenerating: boolean = false;

  nextStep() { if (this.currentStep < 4) this.currentStep++; }
  prevStep() { if (this.currentStep > 1) this.currentStep--; }

  triggerLLMGeneration() {
    this.isGenerating = true;
    this.currentStep = 3; // Loading step

    setTimeout(() => {
      this.generatedQuestions = [
        { id: 1, text: `Explain the traversal mechanics of the selected unit using vector context.`, marks: 4, selected: true },
        { id: 2, text: `Derive the time complexity for graph search operations.`, marks: 6, selected: true }
      ];
      this.isGenerating = false;
      this.currentStep = 4; // Review & Export step
    }, 2000);
  }

  downloadPdf() {
    alert('Downloading finalized PDF containing selected questions...');
  }
}