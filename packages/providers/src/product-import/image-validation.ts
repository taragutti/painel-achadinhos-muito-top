const signatures = [
  { format: "jpeg", extension: [".jpg", ".jpeg"], matches: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { format: "png", extension: [".png"], matches: (bytes: Uint8Array) => bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]) },
  { format: "webp", extension: [".webp"], matches: (bytes: Uint8Array) => text(bytes, 0, 4) === "RIFF" && text(bytes, 8, 12) === "WEBP" },
  { format: "avif", extension: [".avif"], matches: (bytes: Uint8Array) => text(bytes, 4, 12).includes("ftypavif") || text(bytes, 4, 12).includes("ftypavis") },
] as const;

export function validateImageSignature(bytes: Uint8Array, filename?: string): "jpeg" | "png" | "webp" | "avif" {
  const signature = signatures.find((candidate) => candidate.matches(bytes));
  if (!signature) throw new Error("IMAGE_FORMAT_INVALID");
  if (filename) {
    const lowercase = filename.toLowerCase();
    if (!signature.extension.some((extension) => lowercase.endsWith(extension))) throw new Error("IMAGE_CONTENT_MISMATCH");
  }
  return signature.format;
}

function text(bytes: Uint8Array, start: number, end: number) { return new TextDecoder("ascii").decode(bytes.slice(start, end)); }
