export const resumeMaxBytes = 5 * 1024 * 1024;
export const resumeFileTypes = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

export type Resume = {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: (typeof resumeFileTypes)[keyof typeof resumeFileTypes];
  fileSizeBytes: number;
  createdAt: string;
  updatedAt: string;
};
