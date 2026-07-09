export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateTimeEntry(
  start: Date,
  end: Date | null,
  existingEntries: { start: Date; end: Date | null }[],
  workModel: { maxDailyHours: number; minBreakMinutes: number }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (end && end <= start) {
    errors.push('Ende muss nach dem Start liegen.');
  }

  if (end) {
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    if (durationHours > workModel.maxDailyHours) {
      errors.push(`Maximale Tagesarbeitszeit von ${workModel.maxDailyHours}h überschritten.`);
    }

    if (durationHours > 12) {
      errors.push('Dienst über 12 Stunden erfordert Admin-Freigabe.');
    } else if (durationHours > 10) {
      warnings.push('Dienst über 10 Stunden – bitte prüfen.');
    }

    if (durationHours > 6) {
      warnings.push(`Bei > 6h Arbeitszeit ist eine Pause von mind. ${workModel.minBreakMinutes} Minuten vorgeschrieben.`);
    }
  }

  for (const entry of existingEntries) {
    const entryEnd = entry.end ?? new Date();
    const checkEnd = end ?? new Date();

    if (start < entryEnd && checkEnd > entry.start) {
      errors.push('Überlappung mit einer bestehenden Buchung.');
      break;
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateAbsenceRequest(
  startDate: Date,
  endDate: Date,
  existingAbsences: { startDate: Date; endDate: Date }[],
  existingTimeEntries: { start: Date }[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (endDate < startDate) {
    errors.push('Enddatum muss nach dem Startdatum liegen.');
  }

  if (startDate < new Date()) {
    warnings.push('Abwesenheit liegt in der Vergangenheit.');
  }

  for (const absence of existingAbsences) {
    if (startDate <= absence.endDate && endDate >= absence.startDate) {
      errors.push('Überlappung mit einer bestehenden Abwesenheit.');
      break;
    }
  }

  for (const entry of existingTimeEntries) {
    const entryDate = new Date(entry.start.toDateString());
    if (entryDate >= startDate && entryDate <= endDate) {
      warnings.push('Im gewählten Zeitraum existieren Zeitbuchungen.');
      break;
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
