/**
 * Shrinks a photo in the browser before it is uploaded: a centred square, at most 480px,
 * as a JPEG data URL. The API accepts up to 400 KB; this lands around 40.
 */
export async function shrinkPhoto(file: File, edge = 480): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(edge, side);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");

  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
