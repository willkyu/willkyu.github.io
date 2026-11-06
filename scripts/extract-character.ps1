param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [int]$LightThreshold = 160,
  [int]$ErodeRadius = 2,
  [int]$OutlineRadius = 3,
  [switch]$Remove37ConnectedStar
)

Add-Type -AssemblyName System.Drawing
if (-not ('CharacterPixelExtractor' -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;

public static class CharacterPixelExtractor
{
    private static void ClearMaskSegment(bool[] mask, int width, int height, double x1, double y1, double x2, double y2, double radius)
    {
        int minX = Math.Max(0, (int)Math.Floor(Math.Min(x1, x2) - radius));
        int maxX = Math.Min(width - 1, (int)Math.Ceiling(Math.Max(x1, x2) + radius));
        int minY = Math.Max(0, (int)Math.Floor(Math.Min(y1, y2) - radius));
        int maxY = Math.Min(height - 1, (int)Math.Ceiling(Math.Max(y1, y2) + radius));
        double vx = x2 - x1;
        double vy = y2 - y1;
        double lengthSquared = vx * vx + vy * vy;

        for (int y = minY; y <= maxY; y++)
        {
            for (int x = minX; x <= maxX; x++)
            {
                double t = lengthSquared == 0 ? 0 : ((x - x1) * vx + (y - y1) * vy) / lengthSquared;
                t = Math.Max(0, Math.Min(1, t));
                double px = x1 + t * vx;
                double py = y1 + t * vy;
                double dx = x - px;
                double dy = y - py;
                if (dx * dx + dy * dy <= radius * radius) mask[y * width + x] = false;
            }
        }
    }

    public static string Extract(string inputPath, string outputPath, int threshold, int erodeRadius, int outlineRadius, bool remove37ConnectedStar)
    {
        using (var source = new Bitmap(inputPath))
        {
        int width = source.Width;
        int height = source.Height;
        int length = width * height;
        var light = new bool[length];

        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                Color color = source.GetPixel(x, y);
                int luminance = (299 * color.R + 587 * color.G + 114 * color.B) / 1000;
                light[y * width + x] = color.A > 0 && luminance >= threshold;
            }
        }

        var core = new bool[length];
        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                bool survives = true;
                for (int oy = -erodeRadius; oy <= erodeRadius && survives; oy++)
                {
                    for (int ox = -erodeRadius; ox <= erodeRadius; ox++)
                    {
                        if (ox * ox + oy * oy > erodeRadius * erodeRadius) continue;
                        int nx = x + ox;
                        int ny = y + oy;
                        if (nx < 0 || nx >= width || ny < 0 || ny >= height || !light[ny * width + nx])
                        {
                            survives = false;
                            break;
                        }
                    }
                }
                core[y * width + x] = survives;
            }
        }

        var visited = new bool[length];
        var largest = new List<int>();
        var componentSizes = new List<int>();
        var componentDetails = new List<string>();
        int componentCount = 0;
        int[] dx = { -1, 0, 1, -1, 1, -1, 0, 1 };
        int[] dy = { -1, -1, -1, 0, 0, 1, 1, 1 };

        for (int start = 0; start < length; start++)
        {
            if (!core[start] || visited[start]) continue;
            componentCount++;
            var component = new List<int>();
            var queue = new Queue<int>();
            int minX = width, minY = height, maxX = 0, maxY = 0;
            queue.Enqueue(start);
            visited[start] = true;

            while (queue.Count > 0)
            {
                int current = queue.Dequeue();
                component.Add(current);
                int x = current % width;
                int y = current / width;
                minX = Math.Min(minX, x);
                minY = Math.Min(minY, y);
                maxX = Math.Max(maxX, x);
                maxY = Math.Max(maxY, y);

                for (int direction = 0; direction < 8; direction++)
                {
                    int nx = x + dx[direction];
                    int ny = y + dy[direction];
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                    int next = ny * width + nx;
                    if (!core[next] || visited[next]) continue;
                    visited[next] = true;
                    queue.Enqueue(next);
                }
            }

            componentSizes.Add(component.Count);
            if (component.Count >= 200) componentDetails.Add(string.Format("{0}@{1},{2}-{3},{4}", component.Count, minX, minY, maxX, maxY));
            if (component.Count > largest.Count) largest = component;
        }

        if (largest.Count == 0) throw new InvalidOperationException("No foreground component was found.");

        var mask = new bool[length];
        int restoreRadius = erodeRadius + outlineRadius;
        foreach (int pixel in largest)
        {
            int x = pixel % width;
            int y = pixel / width;
            for (int oy = -restoreRadius; oy <= restoreRadius; oy++)
            {
                for (int ox = -restoreRadius; ox <= restoreRadius; ox++)
                {
                    if (ox * ox + oy * oy > restoreRadius * restoreRadius) continue;
                    int nx = x + ox;
                    int ny = y + oy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                    mask[ny * width + nx] = true;
                }
            }
        }

        // 37.png has one thin star ray touching the top hair highlight. This removes only
        // the ray above the observed hair boundary; RGB pixels elsewhere remain untouched.
        if (remove37ConnectedStar && width == 500 && height == 667)
        {
            ClearMaskSegment(mask, width, height, 170, 120, 179, 154, 4);
            ClearMaskSegment(mask, width, height, 179, 154, 186, 158, 4);
        }

        using (var output = new Bitmap(width, height, PixelFormat.Format32bppArgb))
        {
            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    int index = y * width + x;
                    Color original = source.GetPixel(x, y);
                    output.SetPixel(x, y, mask[index]
                        ? Color.FromArgb(255, original.R, original.G, original.B)
                        : Color.FromArgb(0, 0, 0, 0));
                }
            }

            string directory = System.IO.Path.GetDirectoryName(outputPath);
            if (!string.IsNullOrEmpty(directory)) System.IO.Directory.CreateDirectory(directory);
            output.Save(outputPath, ImageFormat.Png);
        }
        componentSizes.Sort();
        componentSizes.Reverse();
        int previewCount = Math.Min(8, componentSizes.Count);
        return string.Format("size={0}x{1}; components={2}; largest={3}; topComponents={4}; details={5}; erodeRadius={6}; outlineRadius={7}", width, height, componentCount, largest.Count, string.Join(",", componentSizes.GetRange(0, previewCount).ToArray()), string.Join(" | ", componentDetails.ToArray()), erodeRadius, outlineRadius);
        }
    }
}
'@
}

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$result = [CharacterPixelExtractor]::Extract($resolvedInput, $resolvedOutput, $LightThreshold, $ErodeRadius, $OutlineRadius, $Remove37ConnectedStar.IsPresent)
Write-Output $result
Write-Output "output=$resolvedOutput"
