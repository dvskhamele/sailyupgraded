import JSZip from "jszip";

export interface ExtractedExcelImage {
  row: number; // 0-indexed row (0 = header, 1 = first data row)
  col: number; // 0-indexed col (0 = Column A)
  sheetName?: string;
  buffer: Buffer;
  mimeType: string;
  dataUri: string;
  filename: string;
}

export function detectImageMimeType(
  buffer: Buffer | Uint8Array,
  filename?: string
): string {
  if (buffer && buffer.length >= 4) {
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return "image/png";
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return "image/gif";
    }
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46
    ) {
      return "image/webp";
    }
  }

  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "png") return "image/png";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "gif") return "image/gif";
    if (ext === "webp") return "image/webp";
    if (ext === "svg") return "image/svg+xml";
    if (ext === "bmp") return "image/bmp";
  }

  return "image/png";
}

function normalizePath(baseDir: string, relativePath: string): string {
  const parts = (baseDir + "/" + relativePath).split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  return stack.join("/");
}

function parseRelationships(relsXml: string): Map<string, string> {
  const rels = new Map<string, string>();
  const relRegex = /<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = relRegex.exec(relsXml)) !== null) {
    rels.set(match[1], match[2]);
  }
  return rels;
}

function colLetterToIndex(colStr: string): number {
  let index = 0;
  for (let i = 0; i < colStr.length; i++) {
    index = index * 26 + (colStr.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Extract all embedded images from an Excel workbook (.xlsx).
 * Returns a map of extracted images indexed by:
 * - `${sheetName}:${col}:${row}`
 * - `${sheetName}:${row}`
 * - `${row}` (for single sheet or default sheet)
 */
export async function extractWorkbookImages(
  buffer: ArrayBuffer | Buffer
): Promise<ExtractedExcelImage[]> {
  const images: ExtractedExcelImage[] = [];

  try {
    const zip = await JSZip.loadAsync(buffer);

    // 1. Map sheet filenames to sheet names from workbook.xml
    const sheetMap = new Map<string, string>(); // e.g. "sheet1.xml" -> "Agents"
    const workbookXmlFile = zip.file("xl/workbook.xml");
    const workbookRelsFile = zip.file("xl/_rels/workbook.xml.rels");

    if (workbookXmlFile && workbookRelsFile) {
      const workbookXml = await workbookXmlFile.async("text");
      const workbookRels = await workbookRelsFile.async("text");
      const rels = parseRelationships(workbookRels);

      const sheetRegex =
        /<sheet\s+[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/gi;
      let sheetMatch: RegExpExecArray | null;
      while ((sheetMatch = sheetRegex.exec(workbookXml)) !== null) {
        const name = sheetMatch[1];
        const rId = sheetMatch[2];
        const target = rels.get(rId);
        if (target) {
          const sheetFileName = target.replace(/^.*[\\/]/, "");
          sheetMap.set(sheetFileName, name);
        }
      }
    }

    // 2. Iterate through all sheet files in xl/worksheets/
    const sheetFiles = Object.keys(zip.files).filter(
      (path) => path.startsWith("xl/worksheets/") && path.endsWith(".xml")
    );

    for (const sheetPath of sheetFiles) {
      const sheetFileName = sheetPath.replace(/^.*[\\/]/, "");
      const sheetName = sheetMap.get(sheetFileName) || sheetFileName.replace(".xml", "");
      const sheetRelsPath = `xl/worksheets/_rels/${sheetFileName}.rels`;
      const sheetRelsFile = zip.file(sheetRelsPath);

      if (!sheetRelsFile) continue;

      const sheetRelsXml = await sheetRelsFile.async("text");
      const sheetRels = parseRelationships(sheetRelsXml);

      // Find drawing relationships
      for (const [rId, target] of sheetRels.entries()) {
        const drawingPath = normalizePath("xl/worksheets", target);
        const drawingFile = zip.file(drawingPath);
        if (!drawingFile) continue;

        const drawingDir = drawingPath.substring(0, drawingPath.lastIndexOf("/"));
        const drawingFileName = drawingPath.substring(drawingPath.lastIndexOf("/") + 1);
        const drawingRelsPath = `${drawingDir}/_rels/${drawingFileName}.rels`;
        const drawingRelsFile = zip.file(drawingRelsPath);
        const drawingRels = drawingRelsFile
          ? parseRelationships(await drawingRelsFile.async("text"))
          : new Map<string, string>();

        const drawingXml = await drawingFile.async("text");

        // Parse anchors in drawingXml
        const anchorRegex =
          /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/gi;
        let anchorMatch: RegExpExecArray | null;

        while ((anchorMatch = anchorRegex.exec(drawingXml)) !== null) {
          const anchorXml = anchorMatch[1];

          // Parse from col and row
          const fromColMatch = /<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/i.exec(anchorXml);
          const fromRowMatch = /<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/i.exec(anchorXml);
          const blipMatch = /<a:blip\s+[^>]*r:embed="([^"]+)"/i.exec(anchorXml);

          if (fromColMatch && fromRowMatch && blipMatch) {
            const col = parseInt(fromColMatch[1], 10);
            const row = parseInt(fromRowMatch[1], 10);
            const imageRelId = blipMatch[1];
            const imageTarget = drawingRels.get(imageRelId);

            if (imageTarget) {
              const imagePath = normalizePath(drawingDir, imageTarget);
              const imageFile = zip.file(imagePath);

              if (imageFile) {
                const imgBuffer = await imageFile.async("nodebuffer");
                const filename = imagePath.split("/").pop() || "image.png";
                const mimeType = detectImageMimeType(imgBuffer, filename);
                const dataUri = `data:${mimeType};base64,${imgBuffer.toString("base64")}`;

                images.push({
                  row,
                  col,
                  sheetName,
                  buffer: imgBuffer,
                  mimeType,
                  dataUri,
                  filename,
                });
              }
            }
          }
        }
      }

      // Check In-Cell images (DISPIMG in sheetXml)
      const cellImagesFile = zip.file("xl/cellimages.xml");
      const cellImagesRelsFile =
        zip.file("xl/_rels/cellimages.xml.rels") ||
        zip.file("xl/cellimages.xml.rels");

      if (cellImagesFile && cellImagesRelsFile) {
        const cellImagesXml = await cellImagesFile.async("text");
        const cellImagesRelsXml = await cellImagesRelsFile.async("text");
        const cellImagesRels = parseRelationships(cellImagesRelsXml);

        const cellImageMap = new Map<string, string>(); // imageId -> mediaPath
        const cellImgRegex =
          /<etc:cellImage[^>]*>[\s\S]*?<xdr:cNvPr[^>]*name="([^"]+)"[\s\S]*?<a:blip[^>]*r:embed="([^"]+)"/gi;
        let cImgMatch: RegExpExecArray | null;

        while ((cImgMatch = cellImgRegex.exec(cellImagesXml)) !== null) {
          const imgName = cImgMatch[1];
          const embedId = cImgMatch[2];
          const mediaTarget = cellImagesRels.get(embedId);
          if (mediaTarget) {
            cellImageMap.set(imgName, normalizePath("xl", mediaTarget));
          }
        }

        // Scan worksheet for DISPIMG references
        const sheetXmlFile = zip.file(sheetPath);
        if (sheetXmlFile) {
          const sheetXml = await sheetXmlFile.async("text");
          const cellRegex =
            /<c\s+[^>]*r="([A-Z]+)(\d+)"[^>]*>[\s\S]*?(?:DISPIMG\("([^"]+)"|<v>([^<]+)<\/v>)/gi;
          let cellMatch: RegExpExecArray | null;

          while ((cellMatch = cellRegex.exec(sheetXml)) !== null) {
            const colLetter = cellMatch[1];
            const rowNumber = parseInt(cellMatch[2], 10); // 1-based row
            const imgId = cellMatch[3] || cellMatch[4];

            if (imgId && cellImageMap.has(imgId)) {
              const imagePath = cellImageMap.get(imgId)!;
              const imgFile = zip.file(imagePath);
              if (imgFile) {
                const imgBuffer = await imgFile.async("nodebuffer");
                const filename = imagePath.split("/").pop() || "image.png";
                const mimeType = detectImageMimeType(imgBuffer, filename);
                const dataUri = `data:${mimeType};base64,${imgBuffer.toString("base64")}`;

                images.push({
                  row: rowNumber - 1, // convert to 0-indexed row
                  col: colLetterToIndex(colLetter),
                  sheetName,
                  buffer: imgBuffer,
                  mimeType,
                  dataUri,
                  filename,
                });
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[extractWorkbookImages] Error extracting images from workbook:", err);
  }

  return images;
}
