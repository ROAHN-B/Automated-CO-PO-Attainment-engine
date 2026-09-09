import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Course,
  IngestReferenceRequest,
  IngestionStatus,
  ReferenceMaterial,
  ReferenceMaterialType,
  SyllabusUnit,
} from '../../core/models';
import { AiGenerationService } from '../../core/services/ai-generation.service';
import { CourseService } from '../../core/services/course.service';

type TargetMode = 'existing' | 'new';

/** Ordered pipeline steps shown during ingestion (PENDING is implicit). */
const PIPELINE: { status: IngestionStatus; label: string }[] = [
  { status: 'PARSING', label: 'Parsing' },
  { status: 'CHUNKING', label: 'Chunking' },
  { status: 'EMBEDDING', label: 'Embedding' },
  { status: 'COMPLETED', label: 'Ready' },
];

/**
 * ReferenceManagerComponent — Part 2, "upload once, query many".
 * Faculty attach reference documents to a syllabus unit (existing or new) and
 * send them through Mayuri's parse→chunk→embed pipeline. Once a unit is embedded
 * it becomes available to the Question Generator, which never re-uploads files.
 */
@Component({
  selector: 'app-reference-manager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reference-manager.component.html',
})
export class ReferenceManagerComponent {
  private readonly ai = inject(AiGenerationService);
  private readonly courseSvc = inject(CourseService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pipeline = PIPELINE;
  readonly materialTypes: { value: ReferenceMaterialType; label: string }[] = [
    { value: 'QUESTION_BANK', label: 'Question bank' },
    { value: 'PREVIOUS_PAPER', label: 'Previous paper' },
    { value: 'LECTURE_PPT', label: 'Lecture slides' },
    { value: 'TEXTBOOK', label: 'Textbook' },
    { value: 'NOTES', label: 'Notes' },
    { value: 'OTHER', label: 'Other' },
  ];

  /* ------------------------------- state ------------------------------- */
  readonly courses = signal<Course[]>([]);
  readonly courseId = signal<string>('');
  readonly units = signal<SyllabusUnit[]>([]);
  readonly selectedUnitId = signal<string>('');
  readonly materials = signal<ReferenceMaterial[] | null>(null);

  readonly mode = signal<TargetMode>('existing');
  readonly newUnitNumber = signal<number | null>(null);
  readonly newUnitName = signal('');
  readonly materialType = signal<ReferenceMaterialType>('QUESTION_BANK');
  readonly files = signal<File[]>([]);
  readonly dragActive = signal(false);

  /* ---------------------------- ingestion ----------------------------- */
  readonly ingesting = signal(false);
  readonly done = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly progress = signal(0);
  readonly phase = signal<IngestionStatus>('PENDING');
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly selectedUnit = computed(() => this.units().find(u => u.unitId === this.selectedUnitId()) ?? null);

  readonly canSubmit = computed(() => {
    if (this.files().length === 0 || this.ingesting()) return false;
    return this.mode() === 'existing'
      ? !!this.selectedUnitId()
      : this.newUnitName().trim().length > 1 && !!this.newUnitNumber();
  });

  constructor() {
    this.courseSvc.getCourses().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(cs => {
      this.courses.set(cs);
      if (cs.length && !this.courseId()) {
        this.courseId.set(cs[0].courseId);
        this.loadUnits();
      }
    });
    this.destroyRef.onDestroy(() => this.stopTimer());
  }

  /* ------------------------------ loaders ----------------------------- */

  onCourseChange(id: string): void {
    this.courseId.set(id);
    this.selectedUnitId.set('');
    this.materials.set(null);
    this.resetIngestion();
    this.loadUnits();
  }

  private loadUnits(): void {
    this.ai.getUnits(this.courseId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(units => {
      this.units.set(units);
      const firstEmbedded = units.find(u => u.isEmbedded) ?? units[0];
      if (firstEmbedded && !this.selectedUnitId()) this.selectUnit(firstEmbedded.unitId);
    });
  }

  selectUnit(unitId: string): void {
    this.selectedUnitId.set(unitId);
    this.mode.set('existing');
    this.materials.set(null);
    this.ai.getUnitMaterials(unitId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(m => this.materials.set(m));
  }

  /* --------------------------- file handling -------------------------- */

  onDragOver(e: DragEvent): void { e.preventDefault(); this.dragActive.set(true); }
  onDragLeave(e: DragEvent): void { e.preventDefault(); this.dragActive.set(false); }
  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragActive.set(false);
    if (e.dataTransfer?.files) this.addFiles(e.dataTransfer.files);
  }
  onFileInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files) this.addFiles(input.files);
    input.value = '';
  }

  private addFiles(list: FileList): void {
    const existing = this.files();
    const merged = [...existing];
    Array.from(list).forEach(f => {
      if (!merged.some(m => m.name === f.name && m.size === f.size)) merged.push(f);
    });
    this.files.set(merged);
    this.done.set(false);
  }

  removeFile(index: number): void {
    this.files.set(this.files().filter((_, i) => i !== index));
  }

  /* ---------------------------- ingestion ----------------------------- */

  ingest(): void {
    if (!this.canSubmit()) return;

    const req: IngestReferenceRequest =
      this.mode() === 'existing'
        ? { unitId: this.selectedUnitId(), materialType: this.materialType() }
        : {
            newUnit: {
              courseId: this.courseId(),
              unitNumber: this.newUnitNumber()!,
              unitName: this.newUnitName().trim(),
            },
            materialType: this.materialType(),
          };

    this.startTimer();
    this.ai.ingestReferences(req, this.files())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: job => {
          this.stopTimer();
          this.progress.set(100);
          this.phase.set('COMPLETED');
          this.ingesting.set(false);
          this.done.set(true);
          this.files.set([]);
          this.newUnitName.set('');
          this.newUnitNumber.set(null);
          // Refresh units, then focus the (possibly new) unit.
          this.ai.getUnits(this.courseId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(units => {
            this.units.set(units);
            this.selectUnit(job.unitId);
          });
        },
        error: () => {
          this.stopTimer();
          this.ingesting.set(false);
          this.errorMsg.set('Ingestion failed. Check the files and try again.');
        },
      });
  }

  private startTimer(): void {
    this.resetIngestion();
    this.ingesting.set(true);
    this.progress.set(5);
    this.phase.set('PARSING');
    this.timer = setInterval(() => {
      const p = this.progress();
      if (p >= 92) return;
      const next = Math.min(92, p + Math.random() * 10 + 4);
      this.progress.set(Math.round(next));
      this.phase.set(next < 32 ? 'PARSING' : next < 62 ? 'CHUNKING' : 'EMBEDDING');
    }, 250);
  }

  private stopTimer(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private resetIngestion(): void {
    this.stopTimer();
    this.ingesting.set(false);
    this.done.set(false);
    this.errorMsg.set(null);
    this.progress.set(0);
    this.phase.set('PENDING');
  }

  /* ------------------------------ helpers ----------------------------- */

  /** Index of the currently active pipeline step (for the stepper UI). */
  phaseIndex(): number {
    return this.pipeline.findIndex(s => s.status === this.phase());
  }

  materialTypeLabel(t: ReferenceMaterialType): string {
    return this.materialTypes.find(m => m.value === t)?.label ?? t;
  }

  fileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
