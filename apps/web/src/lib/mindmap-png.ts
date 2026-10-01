import { download } from './download';
import { type MapColors, mindmapSvg } from './mindmap-export';
import type { Layout } from './mindmap-layout';

const SCALE = 2;

/** The map as a PNG file, twice as sharp as it is on screen. It needs a browser (canvas). */
export async function downloadMindmapPng(
  layout: Layout,
  colors: MapColors,
  name: string
): Promise<void> {
  const svg = mindmapSvg(layout, colors);
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
