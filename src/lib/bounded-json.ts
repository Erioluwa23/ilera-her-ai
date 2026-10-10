export class BodyTooLarge extends Error {}
export async function boundedJson(
  req: Request,
  maximum: number,
): Promise<unknown> {
  if (Number(req.headers.get("content-length")) > maximum)
    throw new BodyTooLarge();
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Missing request.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > maximum) {
        await reader.cancel();
        throw new BodyTooLarge();
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
