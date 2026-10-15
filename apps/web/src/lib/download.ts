const REVOKE_DELAY_MS = 10_000;

/** Hands a file to the browser as a download. */
export function download(name: string, content: Blob): void {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // Revoked later: right after click() some browsers have not started the download yet.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
