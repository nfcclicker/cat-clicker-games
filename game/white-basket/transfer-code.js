"use strict";

const transferPrefix = "OSAKANA1";
const checksumTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value;
});

function checksum(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ checksumTable[(value ^ byte) & 255];
  return ((value ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

function packTransfer(bytes) {
  const out = new Uint8Array(4 + bytes.length + Math.ceil(bytes.length / 8));
  new DataView(out.buffer).setUint32(0, bytes.length);
  const positions = new Int32Array(65536).fill(-1);
  const lookup = (at) => ((bytes[at] * 251 + bytes[at + 1]) * 251 + bytes[at + 2]) & 65535;
  let source = 0;
  let target = 4;
  while (source < bytes.length) {
    const flags = target++;
    let mask = 0;
    for (let bit = 0; bit < 8 && source < bytes.length; bit++) {
      const at = source;
      let length = 0;
      let distance = 0;
      if (at + 2 < bytes.length) {
        const previous = positions[lookup(at)];
        distance = at - previous;
        if (previous >= 0 && distance <= 4096) {
          const limit = Math.min(18, bytes.length - at);
          while (length < limit && bytes[previous + length] === bytes[at + length]) length++;
        }
      }
      if (length >= 3) {
        mask |= 1 << bit;
        const encoded = ((distance - 1) << 4) | (length - 3);
        out[target++] = encoded >>> 8;
        out[target++] = encoded & 255;
        source += length;
      } else {
        out[target++] = bytes[source++];
      }
      for (let pos = at; pos < source && pos + 2 < bytes.length; pos++) positions[lookup(pos)] = pos;
    }
    out[flags] = mask;
  }
  return out.subarray(0, target);
}

function unpackTransfer(bytes) {
  if (bytes.length > maxSaveBytes + Math.ceil(maxSaveBytes / 8) + 4) throw new Error("圧縮データが大きすぎます。"); if (bytes.length < 5) throw new Error("コードのデータが途中で切れています。");
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  if (!length || length > maxSaveBytes) throw new Error("コードのデータ容量が範囲外です。");
  const out = new Uint8Array(length);
  let source = 4;
  let target = 0;
  while (target < length) {
    if (source >= bytes.length) if (bytes.length < 5) throw new Error("コードのデータが途中で切れています。");
    const flags = bytes[source++];
    for (let bit = 0; bit < 8 && target < length; bit++) {
      if (flags & (1 << bit)) {
        if (source + 1 >= bytes.length) throw new Error("コードの圧縮データが不正です。");
        const encoded = (bytes[source++] << 8) | bytes[source++];
        const distance = (encoded >>> 4) + 1;
        const size = (encoded & 15) + 3;
        if (distance > target || target + size > length) throw new Error("コードの圧縮データが不正です。");
        for (let i = 0; i < size; i++) {
          out[target] = out[target - distance];
          target++;
        }
      } else {
        if (source >= bytes.length) if (bytes.length < 5) throw new Error("コードのデータが途中で切れています。");
        out[target++] = bytes[source++];
      }
    }
  }
  if (source !== bytes.length) throw new Error("コードに余分なデータがあります。");
  return out;
}

function encodeTransferCode(archive) {
  const text = new TextEncoder().encode(JSON.stringify(archive));
  if (text.length > maxSaveBytes) throw new Error("セーブデータが大きすぎます。");
  const bytes = packTransfer(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return transferPrefix + "." + checksum(bytes) + "." +
    btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeTransferCode(input) {
  if (typeof input !== "string" || input.length > maxSaveBytes * 2) throw new Error("コードが長すぎます。");
  const code = input.replace(/\s/g, "");
  const match = /^OSAKANA1\.([0-9a-f]{8})\.([A-Za-z0-9_-]+)$/.exec(code);
  if (!match) throw new Error("このゲームの引き継ぎコードを貼り付けてください。");
  const bytes = Uint8Array.from(atob(match[2].replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
  if (checksum(bytes) !== match[1]) throw new Error("コードが壊れているか、コピーが途中です。");
  const raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(unpackTransfer(bytes)));
  validateSaveArchive(raw);
  return raw;
}
