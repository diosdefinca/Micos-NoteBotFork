/**
 * Minimal OGG/Opus muxer for wrapping raw Opus packets into a valid OGG container.
 * Implements RFC 3533 (OGG) and RFC 7845 (OGG/Opus).
 */

// CRC32 lookup table for OGG
const crcTable: number[] = [];
for (let i = 0; i < 256; i++) {
  let r = i << 24;
  for (let j = 0; j < 8; j++) {
    r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1);
  }
  crcTable[i] = r >>> 0;
}

function oggCrc32(data: Buffer): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = ((crc << 8) ^ crcTable[((crc >>> 24) ^ data[i]!) & 0xff]!) >>> 0;
  }
  return crc;
}

function buildOggPage(
  streamSerial: number,
  pageSequence: number,
  granulePosition: bigint,
  headerType: number,
  packets: Buffer[],
): Buffer {
  // Build lacing table
  const lacingValues: number[] = [];
  for (const packet of packets) {
    let remaining = packet.length;
    while (remaining >= 255) {
      lacingValues.push(255);
      remaining -= 255;
    }
    lacingValues.push(remaining);
  }

  const headerSize = 27 + lacingValues.length;
  const dataSize = packets.reduce((sum, p) => sum + p.length, 0);
  const page = Buffer.alloc(headerSize + dataSize);

  // OGG page header
  page.write('OggS', 0);                                    // capture pattern
  page.writeUInt8(0, 4);                                     // stream version
  page.writeUInt8(headerType, 5);                            // header type
  page.writeBigUInt64LE(granulePosition, 6);                 // granule position
  page.writeUInt32LE(streamSerial, 14);                      // stream serial
  page.writeUInt32LE(pageSequence, 18);                      // page sequence
  page.writeUInt32LE(0, 22);                                 // CRC (placeholder)
  page.writeUInt8(lacingValues.length, 26);                  // segment count

  // Lacing table
  for (let i = 0; i < lacingValues.length; i++) {
    page.writeUInt8(lacingValues[i]!, 27 + i);
  }

  // Packet data
  let offset = headerSize;
  for (const packet of packets) {
    packet.copy(page, offset);
    offset += packet.length;
  }

  // Calculate and write CRC
  const crc = oggCrc32(page);
  page.writeUInt32LE(crc, 22);

  return page;
}

function buildOpusHead(channels: number, sampleRate: number): Buffer {
  const head = Buffer.alloc(19);
  head.write('OpusHead', 0);       // magic
  head.writeUInt8(1, 8);           // version
  head.writeUInt8(channels, 9);    // channel count
  head.writeUInt16LE(3840, 10);    // pre-skip (80ms at 48kHz)
  head.writeUInt32LE(sampleRate, 12); // input sample rate
  head.writeInt16LE(0, 16);        // output gain
  head.writeUInt8(0, 18);          // channel mapping family
  return head;
}

function buildOpusTags(): Buffer {
  const vendor = 'notebot';
  const buf = Buffer.alloc(8 + 4 + vendor.length + 4);
  buf.write('OpusTags', 0);
  buf.writeUInt32LE(vendor.length, 8);
  buf.write(vendor, 12);
  buf.writeUInt32LE(0, 12 + vendor.length); // no user comments
  return buf;
}

/**
 * Wrap raw Opus packets into an OGG/Opus container.
 * @param opusPackets Array of raw Opus frame buffers (20ms each at 48kHz)
 * @param sampleRate Sample rate (48000)
 * @param channels Channel count (2 for stereo)
 * @returns Buffer containing a valid OGG/Opus file
 */
export function createOggOpus(opusPackets: Buffer[], sampleRate: number, channels: number): Buffer {
  const serial = Math.floor(Math.random() * 0xFFFFFFFF);
  const pages: Buffer[] = [];
  let pageSeq = 0;

  // Page 0: OpusHead (BOS = beginning of stream)
  pages.push(buildOggPage(serial, pageSeq++, 0n, 0x02, [buildOpusHead(channels, sampleRate)]));

  // Page 1: OpusTags
  pages.push(buildOggPage(serial, pageSeq++, 0n, 0x00, [buildOpusTags()]));

  // Audio pages: batch packets into pages (max ~10 packets per page)
  const PACKETS_PER_PAGE = 10;
  const samplesPerPacket = 960; // 20ms at 48kHz
  let granule = BigInt(0);

  for (let i = 0; i < opusPackets.length; i += PACKETS_PER_PAGE) {
    const batch = opusPackets.slice(i, i + PACKETS_PER_PAGE);
    granule += BigInt(batch.length * samplesPerPacket);

    const isLast = i + PACKETS_PER_PAGE >= opusPackets.length;
    const headerType = isLast ? 0x04 : 0x00; // EOS flag on last page

    pages.push(buildOggPage(serial, pageSeq++, granule, headerType, batch));
  }

  return Buffer.concat(pages);
}
