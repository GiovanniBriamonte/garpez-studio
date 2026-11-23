import CoreGraphics
import Foundation
import ImageIO

let path = "/Users/gyno/Desktop/Studio/Cursor/garpez-tv/.cursor/frames/hp-f021.png"
let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil)!
guard let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fatalError("no") }
let w = cg.width
let h = cg.height
var px = [UInt8](repeating: 0, count: w * h * 4)
let drew = px.withUnsafeMutableBytes { raw -> Bool in
  guard let ctx = CGContext(
    data: raw.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
    space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ) else { return false }
  ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
  return true
}
print("drew", drew, w, h)
let x = 160
var ys: [Int] = []
for y in 100..<(h - 30) {
  let i = (y * w + x) * 4
  let v = Int(px[i])
  if abs(v - 128) > 18 { ys.append(y) }
}
var centers: [Int] = []
var start = -1
var prev = -1
for y in ys {
  if start < 0 { start = y }
  if prev >= 0 && y > prev + 2 {
    centers.append((start + prev) / 2)
    start = y
  }
  prev = y
}
if start >= 0 { centers.append((start + prev) / 2) }
print("centers", centers)
var gaps: [Int] = []
if centers.count > 1 {
  for i in 1..<centers.count { gaps.append(centers[i] - centers[i - 1]) }
}
print("gaps", gaps)
