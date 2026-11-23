import CoreGraphics
import Foundation
import ImageIO

let path = "/Users/gyno/Desktop/Screenshot 2026-11-23 alle 19.18.02.png"
let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil)!
let cg = CGImageSourceCreateImageAtIndex(src, 0, nil)!
let w = cg.width
let h = cg.height
print("size", w, h, "bpc", cg.bitsPerComponent, "bpp", cg.bitsPerPixel)
var px = [UInt8](repeating: 0, count: w * h * 4)
let ok = px.withUnsafeMutableBytes { raw -> Bool in
  guard let ctx = CGContext(
    data: raw.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
    space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ) else { return false }
  ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
  return true
}
print("draw", ok)

func at(_ x: Int, _ y: Int) -> (Int, Int, Int) {
  let i = (y * w + x) * 4
  return (Int(px[i]), Int(px[i + 1]), Int(px[i + 2]))
}

// Find rows in the empty middle column (between text and TV) that are not near-white
let x0 = w / 3
let x1 = w / 2
var odd: [String] = []
for y in 0..<h {
  var dark = 0
  var n = 0
  var minL = 255
  var x = x0
  while x < x1 {
    let (r, g, b) = at(x, y)
    let L = (r + g + b) / 3
    if L < minL { minL = L }
    if L < 250 { dark += 1 }
    n += 1
    x += 3
  }
  if dark > n / 10 {
    odd.append("y=\(y) dark=\(dark)/\(n) min=\(minL)")
  }
}
print("odd middle rows", odd.count)
print(odd.prefix(40).joined(separator: "\n"))

// Also scan a vertical column in the white area above the text, full x, report any row with a long nonwhite run
print("--- full-width nonwhite rows (excluding top 40 and bottom 40) ---")
var count = 0
for y in 40..<(h - 40) {
  var non = 0
  var n = 0
  var x = 20
  while x < w - 20 {
    let (r, g, b) = at(x, y)
    if r < 248 || g < 248 || b < 248 { non += 1 }
    n += 1
    x += 4
  }
  let frac = Double(non) / Double(n)
  if frac > 0.55 && frac < 0.98 {
    print(String(format: "y=%d frac=%.2f", y, frac))
    count += 1
    if count > 30 { break }
  }
}
print("done")
