export interface GenerationObjectKeys {
  sourceObjectKey: string;
  sourcePdfObjectKey: string;
  manualObjectKey: string;
  manualPdfObjectKey: string;
  summaryPdfObjectKey: string;
  collectionObjectKey: string;
}

export function generationObjectKeys(prefix: string): GenerationObjectKeys {
  return {
    sourceObjectKey: `${prefix}/source-code.docx`,
    sourcePdfObjectKey: `${prefix}/source-code.pdf`,
    manualObjectKey: `${prefix}/user-manual.docx`,
    manualPdfObjectKey: `${prefix}/user-manual.pdf`,
    summaryPdfObjectKey: `${prefix}/application-summary.pdf`,
    collectionObjectKey: `${prefix}/collection-form.md`,
  };
}
