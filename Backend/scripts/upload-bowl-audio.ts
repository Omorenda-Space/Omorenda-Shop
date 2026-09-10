/**
 * Convert bowl recording videos to MP3 and optionally upload them to Pinata.
 *
 * Usage (from Backend):
 *   npm run bowls:audio:upload -- --source-dir "D:\path\to\Bowl Sounds" --dry-run
 *   npm run bowls:audio:upload -- --source-dir "D:\path\to\Bowl Sounds" --convert-only
 *   npm run bowls:audio:upload -- --source-dir "D:\path\to\Bowl Sounds" --limit 1
 *   npm run bowls:audio:upload -- --source-dir "D:\path\to\Bowl Sounds"
 *
 * The output directory and manifest are intentionally ignored by Git.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type Recording = {
  bowlNumber: number;
  sourceFile: string;
};

type ManifestEntry = {
  bowlNumber: number;
  sourceFile: string;
  sourceSha256: string;
  audioFile: string;
  audioSha256: string;
  cid: string;
  audioUrl: string;
  pinSize: number | null;
  uploadedAt: string;
};

type CliOptions = {
  sourceDir: string;
  outputDir: string;
  dryRun: boolean;
  convertOnly: boolean;
  force: boolean;
  limit?: number;
};

const scriptDir = __dirname;
const backendDir = path.resolve(scriptDir, "..");
const inventoryPath = path.join(scriptDir, "bowl-recordings.json");
const defaultOutputDir = path.join(backendDir, "data", "bowl-audio-ipfs");

function readFlagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function parseOptions(): CliOptions {
  const args = process.argv.slice(2);
  const sourceDir = readFlagValue(args, "--source-dir") ?? process.env.BOWL_RECORDINGS_DIR ?? "";
  const outputDir = path.resolve(readFlagValue(args, "--output-dir") ?? defaultOutputDir);
  const limitValue = readFlagValue(args, "--limit");
  const limit = limitValue === undefined ? undefined : Number(limitValue);

  if (!sourceDir) {
    throw new Error("Provide --source-dir or set BOWL_RECORDINGS_DIR");
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }

  return {
    sourceDir: path.resolve(sourceDir),
    outputDir,
    dryRun: args.includes("--dry-run"),
    convertOnly: args.includes("--convert-only"),
    force: args.includes("--force"),
    limit,
  };
}

function sha256(filePath: string): string {
  const hash = createHash("sha256");
  const file = fs.readFileSync(filePath);
  hash.update(file);
  return hash.digest("hex");
}

function loadInventory(): Recording[] {
  const parsed: unknown = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("Recording inventory must be an array");

  const seen = new Set<number>();
  return parsed.map((value, index) => {
    if (!value || typeof value !== "object") {
      throw new Error(`Invalid inventory entry at index ${index}`);
    }
    const entry = value as Partial<Recording>;
    if (!Number.isInteger(entry.bowlNumber) || Number(entry.bowlNumber) < 1) {
      throw new Error(`Invalid bowlNumber at index ${index}`);
    }
    if (typeof entry.sourceFile !== "string" || !entry.sourceFile.trim()) {
      throw new Error(`Invalid sourceFile at index ${index}`);
    }
    if (seen.has(entry.bowlNumber!)) {
      throw new Error(`Duplicate bowlNumber ${entry.bowlNumber}`);
    }
    seen.add(entry.bowlNumber!);
    return { bowlNumber: entry.bowlNumber!, sourceFile: entry.sourceFile };
  });
}

function loadManifest(manifestPath: string): ManifestEntry[] {
  if (!fs.existsSync(manifestPath)) return [];
  const parsed: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`Expected an array in ${manifestPath}`);
  return parsed as ManifestEntry[];
}

function writeManifest(manifestPath: string, entries: ManifestEntry[]): void {
  const sorted = [...entries].sort((a, b) => a.bowlNumber - b.bowlNumber);
  const temporaryPath = `${manifestPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, manifestPath);
}

function convertToMp3(sourcePath: string, audioPath: string, force: boolean): void {
  if (fs.existsSync(audioPath) && !force) return;

  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      sourcePath,
      "-vn",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-ac",
      "2",
      audioPath,
    ],
    { encoding: "utf8" },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`FFmpeg failed for ${path.basename(sourcePath)}: ${result.stderr.trim()}`);
  }
}

function gatewayUrl(cid: string): string {
  const configured = process.env.PINATA_GATEWAY?.trim();
  if (!configured) return `https://gateway.pinata.cloud/ipfs/${cid}`;

  const base = configured.startsWith("http") ? configured : `https://${configured}`;
  return `${base.replace(/\/+$/, "")}/ipfs/${cid}`;
}

async function uploadToPinata(audioPath: string, bowlNumber: number): Promise<{
  cid: string;
  pinSize: number | null;
  uploadedAt: string;
}> {
  const jwt = process.env.PINATA_JWT?.trim();
  if (!jwt) throw new Error("PINATA_JWT is required for uploads");

  const bytes = fs.readFileSync(audioPath);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: "audio/mpeg" }), path.basename(audioPath));
  form.append(
    "pinataMetadata",
    JSON.stringify({
      name: `Singing bowl ${bowlNumber} audio`,
      keyvalues: { bowlNumber: String(bowlNumber), mediaType: "audio-preview" },
    }),
  );
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const detail =
      typeof body.error === "string"
        ? body.error
        : typeof body.message === "string"
          ? body.message
          : `HTTP ${response.status}`;
    throw new Error(`Pinata upload failed: ${detail}`);
  }
  if (typeof body.IpfsHash !== "string" || !body.IpfsHash) {
    throw new Error("Pinata response did not contain an IPFS hash");
  }

  return {
    cid: body.IpfsHash,
    pinSize: typeof body.PinSize === "number" ? body.PinSize : null,
    uploadedAt: typeof body.Timestamp === "string" ? body.Timestamp : new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  const allRecordings = loadInventory();
  const recordings = options.limit ? allRecordings.slice(0, options.limit) : allRecordings;
  const missing = recordings.filter(
    recording => !fs.existsSync(path.join(options.sourceDir, recording.sourceFile)),
  );
  if (missing.length) {
    throw new Error(`Missing source files: ${missing.map(item => item.sourceFile).join(", ")}`);
  }

  console.log(`Validated ${recordings.length} recording(s) in ${options.sourceDir}`);
  console.log(`Output: ${options.outputDir}`);
  if (options.dryRun) {
    for (const recording of recordings) {
      console.log(`[dry-run] bowl ${recording.bowlNumber}: ${recording.sourceFile}`);
    }
    return;
  }

  fs.mkdirSync(options.outputDir, { recursive: true });
  const manifestPath = path.join(options.outputDir, "audio-upload-manifest.json");
  const manifest = loadManifest(manifestPath);

  for (const recording of recordings) {
    const padded = String(recording.bowlNumber).padStart(3, "0");
    const sourcePath = path.join(options.sourceDir, recording.sourceFile);
    const audioFile = `bowl-${padded}.mp3`;
    const audioPath = path.join(options.outputDir, audioFile);

    console.log(`Converting bowl ${recording.bowlNumber}...`);
    convertToMp3(sourcePath, audioPath, options.force);
    const sourceSha256 = sha256(sourcePath);
    const audioSha256 = sha256(audioPath);

    if (options.convertOnly) {
      console.log(`Converted ${audioFile}`);
      continue;
    }

    const existing = manifest.find(
      item =>
        item.bowlNumber === recording.bowlNumber &&
        item.sourceSha256 === sourceSha256 &&
        item.audioSha256 === audioSha256 &&
        item.cid,
    );
    if (existing && !options.force) {
      console.log(`Skipping bowl ${recording.bowlNumber}; already uploaded as ${existing.cid}`);
      continue;
    }

    console.log(`Uploading bowl ${recording.bowlNumber}...`);
    const uploaded = await uploadToPinata(audioPath, recording.bowlNumber);
    const entry: ManifestEntry = {
      bowlNumber: recording.bowlNumber,
      sourceFile: recording.sourceFile,
      sourceSha256,
      audioFile,
      audioSha256,
      cid: uploaded.cid,
      audioUrl: gatewayUrl(uploaded.cid),
      pinSize: uploaded.pinSize,
      uploadedAt: uploaded.uploadedAt,
    };
    const previousIndex = manifest.findIndex(item => item.bowlNumber === recording.bowlNumber);
    if (previousIndex === -1) manifest.push(entry);
    else manifest[previousIndex] = entry;
    writeManifest(manifestPath, manifest);
    console.log(`Uploaded ${audioFile}: ${entry.audioUrl}`);
  }

  console.log(options.convertOnly ? "Conversion complete." : `Upload complete. Manifest: ${manifestPath}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
