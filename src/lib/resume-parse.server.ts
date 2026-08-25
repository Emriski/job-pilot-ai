import { unzipSync, strFromU8 } from "fflate";
import { extractText, getDocumentProxy } from "unpdf";

import { cleanText } from "./security";

export const MAX_RESUME_BYTES = 8 * 1024 * 1024;

export class ResumeFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeFileError";
  }
}

const UNREADABLE = "We couldn't safely read this file. Please upload a valid PDF or DOCX.";

export type DetectedKind = "pdf" | "docx";

/**
 * File-signature detection. The declared MIME type and the filename are hints
 * only — the actual bytes decide. Anything else (executables, scripts, HTML,
 * archives, legacy .doc) is rejected.
 */
export function detectFileKind(bytes: Uint8Array): DetectedKind {
  if (bytes.length < 8) throw new ResumeFileError(UNREADABLE);

  // %PDF-
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";

  // PK zip container — must actually be an OOXML wordprocessing document.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(bytes);
    } catch {
      throw new ResumeFileError(UNREADABLE);
    }
    if (!entries["word/document.xml"]) throw new ResumeFileError(UNREADABLE);
    return "docx";
  }

  throw new ResumeFileError(UNREADABLE);
}

export function validateUpload(bytes: Uint8Array, declaredMime: string, filename: string): DetectedKind {
  if (bytes.length === 0) throw new ResumeFileError("That file is empty. Please upload a valid PDF or DOCX.");
  if (bytes.length > MAX_RESUME_BYTES) throw new ResumeFileError("That file is larger than 8MB. Please upload a smaller PDF or DOCX.");

  const kind = detectFileKind(bytes);
  const extension = filename.toLowerCase().split(".").pop() ?? "";
  const allowedMimes =
    kind === "pdf"
      ? ["application/pdf", "application/x-pdf", ""]
      : ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream", ""];

  if (extension && extension !== kind) throw new ResumeFileError(UNREADABLE);
  if (declaredMime && !allowedMimes.includes(declaredMime.toLowerCase())) throw new ResumeFileError(UNREADABLE);

  return kind;
}

/**
 * Text-only extraction. We never execute anything from the document: PDFs are
 * read through a text extractor with no JS execution, and DOCX files are read
 * as XML — macros, embedded objects and external references are ignored.
 */
export async function extractResumeText(bytes: Uint8Array, kind: DetectedKind): Promise<string> {
  if (kind === "pdf") {
    try {
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      return cleanText(Array.isArray(text) ? text.join("\n") : text, 60000);
    } catch (error) {
      console.error("[resume] pdf extraction failed", error);
      throw new ResumeFileError(UNREADABLE);
    }
  }

  try {
    const entries = unzipSync(bytes);
    const parts: string[] = [];
    for (const name of ["word/document.xml", "word/header1.xml", "word/footer1.xml"]) {
      const entry = entries[name];
      if (entry) parts.push(strFromU8(entry));
    }


    const xml = parts.join("\n");
    const text = xml
      .replace(/<w:p[ >]/g, "\n<w:p ")
      .replace(/<w:tab\b[^>]*\/>/g, "  ")
      .replace(/<w:br\b[^>]*\/>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    return cleanText(text, 60000);
  } catch (error) {
    console.error("[resume] docx extraction failed", error);
    throw new ResumeFileError(UNREADABLE);
  }
}

export function assertUsableText(text: string): void {
  if (text.replace(/\s/g, "").length < 200) {
    throw new ResumeFileError(
      "We couldn't read enough text from this file. If it's a scanned image, please upload a text-based PDF or DOCX.",
    );
  }
}
