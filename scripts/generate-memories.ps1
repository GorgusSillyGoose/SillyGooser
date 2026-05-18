$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$MemoriesDir = Join-Path $RepoRoot "src\assets\Memories"
$GeneratedDir = Join-Path $MemoriesDir ".generated"
$ManifestPath = Join-Path $MemoriesDir "memories.json"
$MemoryFolderPattern = '^(\d{2})-(\d{2})-(\d{4})\s+-\s+(.+)$'
$ImagePattern = '^(\d+)(?:\.(.+?))?\.(png|jpe?g|webp)$'

Add-Type -AssemblyName System.Drawing

function Convert-ToSlug {
  param([string]$Value)

  $slug = $Value.Trim().ToLowerInvariant() -replace '[^a-z0-9]+', '-'
  return ($slug -replace '^-+|-+$', '')
}

function Convert-ToTitleText {
  param([string]$Value)

  $text = $Value -replace '[_-]+', ' '
  $text = $text -replace '([a-zA-Z])([0-9])', '$1 $2'
  $text = ($text -replace '\s+', ' ').Trim()
  return (Get-Culture).TextInfo.ToTitleCase($text.ToLowerInvariant())
}

function Convert-ToAssetPath {
  param([string[]]$Segments)

  $encoded = foreach ($segment in $Segments) {
    [uri]::EscapeDataString($segment)
  }

  return "./" + ($encoded -join "/")
}

function Get-JpegEncoder {
  return [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq "image/jpeg" } |
    Select-Object -First 1
}

function New-MemoryThumbnail {
  param(
    [string]$SourcePath,
    [string]$OutputName
  )

  if (!(Test-Path $GeneratedDir)) {
    New-Item -ItemType Directory -Path $GeneratedDir | Out-Null
  }

  $outputPath = Join-Path $GeneratedDir $OutputName
  $sourceImage = [System.Drawing.Image]::FromFile($SourcePath)

  try {
    $targetWidth = 420
    $targetHeight = 560
    $sourceRatio = $sourceImage.Width / $sourceImage.Height
    $targetRatio = $targetWidth / $targetHeight

    if ($sourceRatio -gt $targetRatio) {
      $drawHeight = $targetHeight
      $drawWidth = [int][Math]::Ceiling($targetHeight * $sourceRatio)
    } else {
      $drawWidth = $targetWidth
      $drawHeight = [int][Math]::Ceiling($targetWidth / $sourceRatio)
    }

    $drawX = [int](($targetWidth - $drawWidth) / 2)
    $drawY = [int](($targetHeight - $drawHeight) / 2)

    $bitmap = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
      $graphics.Clear([System.Drawing.Color]::FromArgb(244, 228, 195))
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($sourceImage, $drawX, $drawY, $drawWidth, $drawHeight)

      $qualityParam = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 76L
      $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters 1
      $encoderParams.Param[0] = $qualityParam
      $bitmap.Save($outputPath, (Get-JpegEncoder), $encoderParams)
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  } finally {
    $sourceImage.Dispose()
  }

  return $outputPath
}

$warnings = New-Object System.Collections.Generic.List[string]
$memories = New-Object System.Collections.Generic.List[object]

if (!(Test-Path $MemoriesDir)) {
  New-Item -ItemType Directory -Path $MemoriesDir | Out-Null
}

Get-ChildItem -LiteralPath $MemoriesDir -Directory |
  Where-Object { $_.Name -ne ".generated" } |
  ForEach-Object {
    $folder = $_
    $folderMatch = [regex]::Match($folder.Name, $MemoryFolderPattern)

    if (!$folderMatch.Success) {
      $warnings.Add("Skipping `"$($folder.Name)`" because it does not match DD-MM-YYYY - Memory Title.")
      return
    }

    $day = $folderMatch.Groups[1].Value
    $month = $folderMatch.Groups[2].Value
    $year = $folderMatch.Groups[3].Value
    $title = Convert-ToTitleText $folderMatch.Groups[4].Value
    $isoDate = "$year-$month-$day"
    $parsedDate = [datetime]::ParseExact($isoDate, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)

    $images = New-Object System.Collections.Generic.List[object]
    Get-ChildItem -LiteralPath $folder.FullName -File |
      ForEach-Object {
        $imageMatch = [regex]::Match($_.Name, $ImagePattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if (!$imageMatch.Success) {
          return
        }

        $index = [int]$imageMatch.Groups[1].Value
        $description = if ($imageMatch.Groups[2].Success) { Convert-ToTitleText $imageMatch.Groups[2].Value } else { "" }
        $thumbLabel = if ($description) { $description } else { "image" }
        $thumbName = "$(Convert-ToSlug $folder.Name)-$($index.ToString("00"))-$(Convert-ToSlug $thumbLabel).jpg"
        New-MemoryThumbnail -SourcePath $_.FullName -OutputName $thumbName | Out-Null

        $images.Add([ordered]@{
          index = $index
          description = $description
          fileName = $_.Name
          src = Convert-ToAssetPath @("assets", "Memories", $folder.Name, $_.Name)
          thumbnailSrc = Convert-ToAssetPath @("assets", "Memories", ".generated", $thumbName)
        })
      }

    $sortedImages = @($images | Sort-Object index, fileName)

    if (!$sortedImages.Count) {
      $warnings.Add("Skipping `"$($folder.Name)`" because it has no numbered memory images.")
      return
    }

    $cover = @($sortedImages | Where-Object { $_.index -eq 1 } | Select-Object -First 1)[0]
    if (!$cover) {
      $cover = $sortedImages[0]
      $warnings.Add("`"$($folder.Name)`" has no 1.Description.ext cover; using $($cover.fileName).")
    }

    $memories.Add([ordered]@{
      id = "$isoDate-$(Convert-ToSlug $title)"
      folderName = $folder.Name
      title = $title
      date = $isoDate
      folderDate = $folder.LastWriteTimeUtc.ToString("o")
      coverImage = $cover.thumbnailSrc
      coverFullImage = $cover.src
      imageCount = $sortedImages.Count
      description = $cover.description
      images = $sortedImages
    })
  }

$sortedMemories = @($memories | Sort-Object @{ Expression = { [datetime]$_.date }; Descending = $false })

$manifest = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  source = "src/assets/Memories"
  folderFormat = "DD-MM-YYYY - Memory Title"
  imageFormat = "1.png, 1.jpg, 1.jpeg, 1.webp, or 1.Description.png/jpg/jpeg/webp"
  count = $sortedMemories.Count
  memories = $sortedMemories
  warnings = @($warnings)
}

$json = $manifest | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($ManifestPath, "$json`n", [System.Text.UTF8Encoding]::new($false))

foreach ($warning in $warnings) {
  Write-Warning $warning
}

Write-Host "[memories] Wrote $($sortedMemories.Count) memories to src/assets/Memories/memories.json."
