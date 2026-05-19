export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: mime });
  downloadBlob(blob, filename);
}

export function downloadJson(obj: unknown, filename: string): void {
  downloadText(JSON.stringify(obj, null, 2), filename, 'application/json');
}
