import XCTest
@testable import BlinqScribe

final class WavChunkerTests: XCTestCase {

    func testHeaderBytes() {
        let pcm = Data(count: 100)
        let wav = WavChunker.wavData(pcm: pcm)
        XCTAssertEqual(wav.count, 44 + 100)
        XCTAssertEqual(String(data: wav.prefix(4), encoding: .ascii), "RIFF")
        XCTAssertEqual(String(data: wav.dropFirst(8).prefix(4), encoding: .ascii), "WAVE")
        XCTAssertEqual(String(data: wav.dropFirst(12).prefix(4), encoding: .ascii), "fmt ")
        XCTAssertEqual(String(data: wav.dropFirst(36).prefix(4), encoding: .ascii), "data")
        func u16(_ offset: Int) -> UInt16 {
            wav.withUnsafeBytes { raw in
                UInt16(littleEndian: raw.load(fromByteOffset: offset, as: UInt16.self))
            }
        }
        func u32(_ offset: Int) -> UInt32 {
            wav.withUnsafeBytes { raw in
                UInt32(littleEndian: raw.load(fromByteOffset: offset, as: UInt32.self))
            }
        }
        XCTAssertEqual(u32(4), UInt32(36 + 100))
        XCTAssertEqual(u32(16), 16)
        XCTAssertEqual(u16(20), 1)
        XCTAssertEqual(u16(22), 1)
        XCTAssertEqual(u32(24), 16000)
        XCTAssertEqual(u32(28), 32000)
        XCTAssertEqual(u16(32), 2)
        XCTAssertEqual(u16(34), 16)
        XCTAssertEqual(u32(40), 100)
    }

    func testChunkSizeIs15Seconds() {
        XCTAssertEqual(WavChunker.bytesPerChunk, 480_000)
        XCTAssertEqual(WavChunker.sampleRate, 16000)
        var chunker = WavChunker()
        let ready = chunker.append(Data(count: WavChunker.bytesPerChunk))
        XCTAssertEqual(ready.count, 1)
        XCTAssertEqual(ready.first?.index, 0)
        XCTAssertEqual(ready.first?.wav.count, 480_000 + 44)
        XCTAssertNil(chunker.flush())
    }

    func testTwoChunksKeepOrder() {
        var chunker = WavChunker()
        let ready = chunker.append(Data(count: WavChunker.bytesPerChunk * 2))
        XCTAssertEqual(ready.map(\.index), [0, 1])
    }

    func testFinalPartialChunk() {
        var chunker = WavChunker()
        XCTAssertTrue(chunker.append(Data(count: 1000)).isEmpty)
        let last = chunker.flush()
        XCTAssertEqual(last?.index, 0)
        XCTAssertEqual(last?.wav.count, 44 + 1000)
        XCTAssertEqual(last?.wav.dropFirst(44).count, 1000)
        XCTAssertNil(chunker.flush())
    }

    func testPartialAfterFullChunk() {
        var chunker = WavChunker()
        let ready = chunker.append(Data(count: WavChunker.bytesPerChunk + 2000))
        XCTAssertEqual(ready.count, 1)
        let last = chunker.flush()
        XCTAssertEqual(last?.index, 1)
        XCTAssertEqual(last?.wav.count, 44 + 2000)
    }
}
