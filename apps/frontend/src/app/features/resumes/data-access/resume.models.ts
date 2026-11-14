export const resumeMaxBytes = 2 * 1024 * 1024;
export const resumeMaxActive = 10;
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
