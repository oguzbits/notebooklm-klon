import { vi } from 'vitest';

/**
 * Catches the files a page hands to the browser as downloads. jsdom has no object URLs, so the
 * test puts its own in place; `restore` takes them back.
 */
export function captureDownloads() {
  const files: { name: string; blob: Blob }[] = [];
  const blobs = new Map<string, Blob>();
  const { createObjectURL, revokeObjectURL } = URL;
  URL.createObjectURL = (blob) => {
    const url = `blob:test-${blobs.size}`;
    blobs.set(url, blob as Blob);
    return url;
  };
  URL.revokeObjectURL = () => {};
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    const blob = blobs.get(this.href);
    if (blob) files.push({ name: this.download, blob });
  });
  return {
    files,
    restore() {
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;
      click.mockRestore();
    },
  };
}
