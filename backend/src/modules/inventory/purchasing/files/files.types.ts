/** What the screens receive for any photo or PDF on a purchase file (`FileRef`, docs/API_CONTRACT.md §31.1). */
export interface FileRef {
  id: string;
  fileName: string;
  size: number;
  /** Always null from the server: a screen asks for a short-lived link (`GET /uploads/:id/url`) when it needs the picture. */
  thumbnail: string | null;
}

export interface FileDownload {
  url: string;
  expiresAt: string;
  fileName: string;
}

export interface UploadedFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}
