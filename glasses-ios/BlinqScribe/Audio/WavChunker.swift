import Foundation

/// Cuts 16 kHz mono 16-bit PCM into WAV chunks.
/// Chunk size is 15 seconds: 16000 samples per second times 2 bytes = 480000 bytes of PCM.
struct WavChunker: Equatable {
    static let sampleRate = 16000
    static let channels = 1
    static let bitsPerSample = 16
    static let chunkSeconds = 15
    static let bytesPerChunk = sampleRate * (bitsPerSample / 8) * channels * chunkSeconds
    static let headerSize = 44

    private(set) var pending = Data()
    private(set) var nextIndex = 0

    mutating func reset() {
        pending = Data()
        nextIndex = 0
    }

    /// Adds PCM and returns any full WAV chunks that are ready, in order.
    mutating func append(_ pcm: Data) -> [(index: Int, wav: Data)] {
        pending.append(pcm)
        var ready: [(Int, Data)] = []
        while pending.count >= Self.bytesPerChunk {
            let slice = pending.prefix(Self.bytesPerChunk)
            ready.append((nextIndex, Self.wavData(pcm: Data(slice))))
            nextIndex += 1
            pending.removeFirst(Self.bytesPerChunk)
        }
        return ready
    }

    /// Returns the final partial chunk on stop, or nil when nothing is left.
    mutating func flush() -> (index: Int, wav: Data)? {
        guard !pending.isEmpty else { return nil }
        let result = (nextIndex, Self.wavData(pcm: pending))
        nextIndex += 1
        pending = Data()
        return result
    }

    static func wavData(pcm: Data) -> Data {
        var data = header(pcmSize: pcm.count)
        data.append(pcm)
        return data
    }

    /// 44 byte WAV header: PCM format 1, 1 channel, 16000 Hz, 16 bits.
    static func header(pcmSize: Int) -> Data {
        var h = Data()
        func text(_ s: String) { h.append(Data(s.utf8)) }
        func u32(_ v: UInt32) { withUnsafeBytes(of: v.littleEndian) { h.append(contentsOf: $0) } }
        func u16(_ v: UInt16) { withUnsafeBytes(of: v.littleEndian) { h.append(contentsOf: $0) } }
        text("RIFF")
        u32(UInt32(36 + pcmSize))
        text("WAVE")
        text("fmt ")
        u32(16)
        u16(1)
        u16(UInt16(channels))
        u32(UInt32(sampleRate))
        u32(UInt32(sampleRate * channels * bitsPerSample / 8))
        u16(UInt16(channels * bitsPerSample / 8))
        u16(UInt16(bitsPerSample))
        text("data")
        u32(UInt32(pcmSize))
        return h
    }
}
