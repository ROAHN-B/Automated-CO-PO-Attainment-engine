import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-reference-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reference-manager.component.html'
})
export class ReferenceManagerComponent {
  // Mode toggle: 'existing' or 'new'
  unitMode: 'existing' | 'new' = 'existing';
  
  selectedUnitId: string = 'unit-1';
  newUnitName: string = '';
  selectedFiles: File[] = [];
  isEmbedding: boolean = false;
  successMessage: string = '';

  existingUnits = [
    { id: 'unit-1', name: 'Unit 1: Introduction to Data Structures', docsCount: 3 },
    { id: 'unit-2', name: 'Unit 2: Linear Data Structures (Stacks & Queues)', docsCount: 5 },
    { id: 'unit-3', name: 'Unit 3: Advanced Trees and Graphs', docsCount: 2 }
  ];

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    for (let i = 0; i < files.length; i++) {
      this.selectedFiles.push(files[i]);
    }
  }

  uploadAndVectorize() {
    this.isEmbedding = true;
    this.successMessage = '';

    // Simulate vector embedding storage (Mayuri's backend endpoint)
    setTimeout(() => {
      this.isEmbedding = false;
      this.successMessage = 'Documents successfully parsed, chunked, and stored in the Vector Database!';
      this.selectedFiles = [];
      this.newUnitName = '';
    }, 2000);
  }
}