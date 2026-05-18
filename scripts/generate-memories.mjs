import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const memoriesDir = path.join(repoRoot, "src", "assets", "Memories");
const manifestPath = path.join(memoriesDir, "memories.json");
const thumbnailsDir = path.join(memoriesDir, ".generated");
const memoryFolderPattern = /^(\d{2})-(\d{2})-(\d{4})\s+-\s+(.+)$/;
const imagePattern = /^(\d+)(?:\.(.+?))?\.(png|jpe?g|webp)$/i;

async function loadSharp() {
  try {
    return (await import("sharp")).default;
  } catch {
    return null;
  }
}

function toSlug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTitleText(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([0-9])/gi, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function encodeAssetPath(...segments) {
  return `./${segments.map((segment) => encodeURIComponent(segment).replace(/%2F/g, "/")).join("/")}`;
}

function parseMemoryFolder(folderName) {
  const match = folderName.match(memoryFolderPattern);
  if (!match) return null;

  const [, day, month, year, rawTitle] = match;
  const isoDate = `${year}-${month}-${day}`;
  const date = new Date(`${isoDate}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    date: isoDate,
    title: toTitleText(rawTitle),
  };
}

function parseImageFile(fileName) {
  const match = fileName.match(imagePattern);
  if (!match) return null;

  return {
    index: Number(match[1]),
    description: toTitleText(match[2] || ""),
    fileName,
  };
}

async function listDirectories(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function listMemoryImages(folderName) {
  const folderPath = path.join(memoriesDir, folderName);
  const entries = await readdir(folderPath, { withFileTypes: true });

  const images = entries
    .filter((entry) => entry.isFile())
    .map((entry) => parseImageFile(entry.name))
    .filter(Boolean)
    .sort((a, b) => a.index - b.index || a.fileName.localeCompare(b.fileName))
    .map((image) => ({
      ...image,
      src: encodeAssetPath("assets", "Memories", folderName, image.fileName),
    }));

  return images;
}

async function generateThumbnail(sharp, folderName, image) {
  if (!sharp) {
    return null;
  }

  await mkdir(thumbnailsDir, { recursive: true });
  const thumbnailName = `${toSlug(folderName)}-${String(image.index).padStart(2, "0")}-${toSlug(image.description || "image")}.webp`;
  const inputPath = path.join(memoriesDir, folderName, image.fileName);
  const outputPath = path.join(thumbnailsDir, thumbnailName);

  await sharp(inputPath)
    .rotate()
    .resize({
      width: 420,
      height: 560,
      fit: "cover",
      withoutEnlargement: true,
    })
    .webp({ quality: 76, effort: 4 })
    .toFile(outputPath);

  return encodeAssetPath("assets", "Memories", ".generated", thumbnailName);
}

async function buildManifest() {
  const sharp = await loadSharp();
  const folderNames = await listDirectories(memoriesDir);
  const memories = [];
  const warnings = [];

  for (const folderName of folderNames) {
    const parsedFolder = parseMemoryFolder(folderName);
    if (!parsedFolder) {
      warnings.push(`Skipping "${folderName}" because it does not match DD-MM-YYYY - Memory Title.`);
      continue;
    }

    const folderPath = path.join(memoriesDir, folderName);
    const folderStats = await stat(folderPath);
    const images = await listMemoryImages(folderName);

    if (!images.length) {
      warnings.push(`Skipping "${folderName}" because it has no numbered memory images.`);
      continue;
    }

    for (const image of images) {
      image.thumbnailSrc = await generateThumbnail(sharp, folderName, image);
    }

    if (!sharp) {
      warnings.push("Install optional dev dependency sharp to generate lightweight WebP memory thumbnails.");
    }

    const cover = images.find((image) => image.index === 1) || images[0];
    if (cover.index !== 1) {
      warnings.push(`"${folderName}" has no 1.Description.ext cover; using ${cover.fileName}.`);
    }

    memories.push({
      id: `${parsedFolder.date}-${toSlug(parsedFolder.title)}`,
      folderName,
      title: parsedFolder.title,
      date: parsedFolder.date,
      folderDate: folderStats.mtime.toISOString(),
      coverImage: cover.thumbnailSrc || cover.src,
      coverFullImage: cover.src,
      imageCount: images.length,
      description: cover.description,
      images,
    });
  }

  memories.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    generatedAt: new Date().toISOString(),
    source: "src/assets/Memories",
    folderFormat: "DD-MM-YYYY - Memory Title",
    imageFormat: "1.png, 1.jpg, 1.jpeg, 1.webp, or 1.Description.png/jpg/jpeg/webp",
    count: memories.length,
    memories,
    warnings,
  };
}

const manifest = await buildManifest();
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

for (const warning of manifest.warnings) {
  console.warn(`[memories] ${warning}`);
}

console.log(`[memories] Wrote ${manifest.count} memories to ${path.relative(repoRoot, manifestPath)}.`);
