import CoreGraphics
import Foundation
import ImageIO

func load(_ name: String) -> (w: Int, h: Int, px: [UInt8]) {
  let path = "/Users/gyno/Desktop/Studio/Cursor/garpez-tv/.cursor/frames/" + name
  let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil)!
  let cg = CGImageSourceCreateImageAtIndex(src, 0, nil)!
  let w = cg.width, h = cg.height
  var px = [UInt8](repeating: 0, count: w * h * 4)
  _ = px.withUnsafeMutableBytes { raw -> Bool in
    guard let ctx = CGContext(data: raw.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
    return true
  }
  return (w, h, px)
}

func luma(_ im: (w: Int, h: Int, px: [UInt8]), _ x: Int, _ y: Int) -> Double {
  let i = (y * im.w + x) * 4
  return 0.2126 * Double(im.px[i]) + 0.7152 * Double(im.px[i + 1]) + 0.0722 * Double(im.px[i + 2])
}

let im = load("f021.jpg")
let base = load("f016.jpg")
print("size", im.w, im.h)

// consistent horizontal edge: median |L(y)-L(y-1)| across left area, minus the smooth gradient expectation
var scores: [(Int, Double)] = []
for y in 90..<(im.h - 40) {
  var acc = 0.0
  var n = 0
  var x = 30
  while x < 480 {
    let d = luma(im, x, y) - luma(im, x, y - 1)
    let d0 = luma(base, x, y) - luma(base, x, y - 1)
    acc += abs(d - d0) // change vs pre-transition frame
    n += 1
    x += 4
  }
  scores.append((y, acc / Double(n)))
}
let top = scores.sorted { $0.1 > $1.1 }.prefix(15)
print("biggest new horizontal edges vs f016:")
for (y, s) in top { print(String(format: "y=%d score=%.2f", y, s)) }
