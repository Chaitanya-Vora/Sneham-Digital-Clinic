// Phone photos are 3–8 MB; a follow-up photo only needs to be clear enough to
// compare against the next one. Downscaling before upload keeps saves fast on
// clinic Wi-Fi/mobile data and keeps storage small. Falls back to the original
// file if the browser can't decode it, so a photo is never lost to this step.
export async function compressImage(file: File, maxEdge = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
    return out && out.size < file.size ? out : file
  } catch {
    return file
  }
}
