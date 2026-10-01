import { download } from './download';

const SCALE = 2;

/** The picture of the map (the text of an SVG) as a PNG file, twice as sharp as on screen. It needs a browser (canvas). */
export async function downloadMindmapPng(svg: string, name: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The picture of the map could not be made.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.width * SCALE;
    canvas.height = image.height * SCALE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The canvas has no 2d context.');
    context.scale(SCALE, SCALE);
    context.drawImage(image, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('No PNG was made.'))),
        'image/png'
      );
    });
    download(`${name}.png`, png);
  } finally {
    URL.revokeObjectURL(url);
  }
}
