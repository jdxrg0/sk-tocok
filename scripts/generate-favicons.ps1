Add-Type -AssemblyName System.Drawing

$csharp = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class IconBuilder {
    public static Bitmap CreateCircular(Image source, int size) {
        Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(bmp)) {
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.CompositingQuality = CompositingQuality.HighQuality;
            g.Clear(Color.Transparent);

            using (GraphicsPath path = new GraphicsPath()) {
                // Inset by 0.5f to give a clean antialiased edge
                path.AddEllipse(0.5f, 0.5f, (float)size - 1.0f, (float)size - 1.0f);
                g.SetClip(path);

                // Slight scale to eliminate the black perimeter in source jpg
                float scale = 1.035f;
                float drawW = (float)size * scale;
                float drawH = (float)size * scale;
                float drawX = ((float)size - drawW) / 2.0f;
                float drawY = ((float)size - drawH) / 2.0f;

                g.DrawImage(source, drawX, drawY, drawW, drawH);
            }
        }
        return bmp;
    }

    public static byte[] CreateIco(Bitmap[] bitmaps) {
        using (MemoryStream ms = new MemoryStream())
        using (BinaryWriter bw = new BinaryWriter(ms)) {
            int count = bitmaps.Length;
            bw.Write((ushort)0); // Reserved
            bw.Write((ushort)1); // Type 1 = Icon
            bw.Write((ushort)count);

            byte[][] dibs = new byte[count][];
            for (int i = 0; i < count; i++) {
                Bitmap bmp = bitmaps[i];
                int w = bmp.Width;
                int h = bmp.Height;
                int andStride = ((w + 31) / 32) * 4;
                int andSize = andStride * h;
                int xorSize = w * h * 4;

                using (MemoryStream dibMs = new MemoryStream())
                using (BinaryWriter dibBw = new BinaryWriter(dibMs)) {
                    dibBw.Write((uint)40); // biSize
                    dibBw.Write(w);
                    dibBw.Write(h * 2); // doubled for ICO
                    dibBw.Write((ushort)1);
                    dibBw.Write((ushort)32);
                    dibBw.Write((uint)0);
                    dibBw.Write((uint)(xorSize + andSize));
                    dibBw.Write((int)0);
                    dibBw.Write((int)0);
                    dibBw.Write((uint)0);
                    dibBw.Write((uint)0);

                    // XOR data (bottom-up BGRA)
                    for (int y = h - 1; y >= 0; y--) {
                        for (int x = 0; x < w; x++) {
                            Color c = bmp.GetPixel(x, y);
                            dibBw.Write(c.B);
                            dibBw.Write(c.G);
                            dibBw.Write(c.R);
                            dibBw.Write(c.A);
                        }
                    }

                    // AND mask (bottom-up 1bpp)
                    for (int y = h - 1; y >= 0; y--) {
                        byte[] row = new byte[andStride];
                        for (int x = 0; x < w; x++) {
                            Color c = bmp.GetPixel(x, y);
                            if (c.A == 0) {
                                int byteIdx = x / 8;
                                int bitIdx = 7 - (x % 8);
                                row[byteIdx] |= (byte)(1 << bitIdx);
                            }
                        }
                        dibBw.Write(row);
                    }
                    dibs[i] = dibMs.ToArray();
                }
            }

            int headerSize = 6 + (16 * count);
            int currentOffset = headerSize;
            for (int i = 0; i < count; i++) {
                Bitmap bmp = bitmaps[i];
                byte bW = (byte)(bmp.Width >= 256 ? 0 : bmp.Width);
                byte bH = (byte)(bmp.Height >= 256 ? 0 : bmp.Height);
                byte[] dibBytes = dibs[i];

                bw.Write(bW);
                bw.Write(bH);
                bw.Write((byte)0); // color count
                bw.Write((byte)0); // reserved
                bw.Write((ushort)1); // planes
                bw.Write((ushort)32); // bpp
                bw.Write((uint)dibBytes.Length);
                bw.Write((uint)currentOffset);

                currentOffset += dibBytes.Length;
            }

            for (int i = 0; i < count; i++) {
                bw.Write(dibs[i]);
            }

            bw.Flush();
            return ms.ToArray();
        }
    }
}
'@

Add-Type -TypeDefinition $csharp -ReferencedAssemblies "System.Drawing"

$sourcePath = Join-Path $PSScriptRoot "..\public\sk-logo.jpg"
$publicDir = Join-Path $PSScriptRoot "..\public"

Write-Host "Loading source logo from: $sourcePath"
$sourceImg = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePath))

# Generate individual Bitmaps
$b16 = [IconBuilder]::CreateCircular($sourceImg, 16)
$b32 = [IconBuilder]::CreateCircular($sourceImg, 32)
$b48 = [IconBuilder]::CreateCircular($sourceImg, 48)
$b180 = [IconBuilder]::CreateCircular($sourceImg, 180)
$b192 = [IconBuilder]::CreateCircular($sourceImg, 192)
$b512 = [IconBuilder]::CreateCircular($sourceImg, 512)

# Save ICO
$icoPath = Join-Path $publicDir "favicon.ico"
$icoBytes = [IconBuilder]::CreateIco(@($b16, $b32, $b48))
[System.IO.File]::WriteAllBytes($icoPath, $icoBytes)
Write-Host "Saved: $icoPath ($($icoBytes.Length) bytes)"

# Save PNGs
$png16Path = Join-Path $publicDir "favicon-16x16.png"
$b16.Save($png16Path, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved: $png16Path"

$png32Path = Join-Path $publicDir "favicon-32x32.png"
$b32.Save($png32Path, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved: $png32Path"

$png48Path = Join-Path $publicDir "favicon-48x48.png"
$b48.Save($png48Path, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved: $png48Path"

$appleTouchPath = Join-Path $publicDir "apple-touch-icon.png"
$b180.Save($appleTouchPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved: $appleTouchPath"

$pwa192Path = Join-Path $publicDir "icon-192.png"
$b192.Save($pwa192Path, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved: $pwa192Path"

$pwa512Path = Join-Path $publicDir "icon-512.png"
$b512.Save($pwa512Path, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved: $pwa512Path"

# Cleanup
$b16.Dispose()
$b32.Dispose()
$b48.Dispose()
$b180.Dispose()
$b192.Dispose()
$b512.Dispose()
$sourceImg.Dispose()

Write-Host "Favicons generated successfully!"
