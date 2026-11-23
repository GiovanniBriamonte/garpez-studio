import AVFoundation
import AppKit
import CoreGraphics
import Foundation
import ImageIO

let input = "/Users/gyno/Desktop/Registrazione schermo 2026-11-23 alle 19.12.02.mov"
let outDir = "/Users/gyno/Desktop/Studio/Cursor/garpez-tv/.cursor/frames"
let url = URL(fileURLWithPath: input)
let asset = AVURLAsset(url: url)
let sem = DispatchSemaphore(value: 0)

func writePNG(_ cg: CGImage, _ path: String) {
  let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, "public.png" as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, cg, nil)
  CGImageDestinationFinalize(dest)
}

Task {
  let dur = try await asset.load(.duration)
  let tracks = try await asset.loadTracks(withMediaType: .video)
  let track = tracks[0]
  let size = try await track.load(.naturalSize)
  let transform = try await track.load(.preferredTransform)
  print("duration \(CMTimeGetSeconds(dur)) natural \(size) transform \(transform)")
  let gen = AVAssetImageGenerator(asset: asset)
  gen.appliesPreferredTrackTransform = true
  gen.requestedTimeToleranceBefore = .zero
  gen.requestedTimeToleranceAfter = .zero
  // around the first transition: frames at 0.12s were index 18-23 => 2.16-2.76s
  let times = stride(from: 2.05, through: 2.70, by: 0.05).map { CMTime(seconds: $0, preferredTimescale: 600) }
  for (i, time) in times.enumerated() {
    let cg = try gen.copyCGImage(at: time, actualTime: nil)
    let path = "\(outDir)/hi\(String(format: "%02d", i)).png"
    // downscale only if huge, keep width 1600 for inspection
    let maxW = 1600
    if cg.width > maxW {
      let h = Int(Double(cg.height) * Double(maxW) / Double(cg.width))
      let cs = CGColorSpaceCreateDeviceRGB()
      let ctx = CGContext(data: nil, width: maxW, height: h, bitsPerComponent: 8, bytesPerRow: maxW * 4, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
      ctx.interpolationQuality = .high
      ctx.draw(cg, in: CGRect(x: 0, y: 0, width: maxW, height: h))
      writePNG(ctx.makeImage()!, path)
      print("wrote \(path) from \(cg.width)x\(cg.height)")
    } else {
      writePNG(cg, path)
      print("wrote \(path) \(cg.width)x\(cg.height)")
    }
  }
  sem.signal()
}
sem.wait()
