import CoreGraphics
import Foundation
import ImageIO

func load(_ path: String) -> (w: Int, h: Int, px: [UInt8]) {
  let url = URL(fileURLWithPath: path) as CFURL
  let src = CGImageSourceCreateWithURL(url, nil)!
  let cg = CGImageSourceCreateImageAtIndex(src, 0, nil)!
  let w = cg.width
  let h = cg.height
  var px = [UInt8](repeating: 0, count: w * h * 4)
  px.withUnsafeMutableBytes { raw in
    let ctx = CGContext(
      data: raw.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
  }
  return (w, h, px)
}

func L(_ px: [UInt8], _ w: Int, _ x: Int, _ y: Int) -> Double {
  let i = (y * w + x) * 4
  let r = Double(px[i])
  let g = Double(px[i + 1])
  let b = Double(px[i + 2])
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

func saveGray(_ w: Int, _ h: Int, _ bytes: [UInt8], _ path: String) {
  let cs = CGColorSpaceCreateDeviceGray()
  let data = Data(bytes)
  guard let provider = CGDataProvider(data: data as CFData),
    let cg = CGImage(
      width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 8, bytesPerRow: w,
      space: cs, bitmapInfo: CGBitmapInfo(rawValue: 0), provider: provider, decode: nil,
      shouldInterpolate: false, intent: .defaultIntent
    )
  else { return }
  let url = URL(fileURLWithPath: path) as CFURL
  let dest = CGImageDestinationCreateWithURL(url, "public.png" as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, cg, nil)
  CGImageDestinationFinalize(dest)
}

let dir = "/Users/gyno/Desktop/Studio/Cursor/garpez-tv/.cursor/frames/"
let names = ["f017", "f019", "f020", "f021", "f026"]
var imgs: [String: (w: Int, h: Int, px: [UInt8])] = [:]
for n in names { imgs[n] = load(dir + n + ".jpg") }
let w = imgs["f017"]!.w
let h = imgs["f017"]!.h
print("wh \(w) \(h)")

func rowMean(_ im: (w: Int, h: Int, px: [UInt8]), y: Int, x0: Int, x1: Int) -> Double {
  var s = 0.0
  var n = 0
  var x = x0
  while x < x1 {
    s += L(im.px, im.w, x, y)
    n += 1
    x += 2
  }
  return s / Double(max(n, 1))
}

// rows on f019 (pre-wave TV page) whose luma jumps vs neighbors, sampled in the empty gradient (left of center TV)
let pre = imgs["f019"]!
print("--- f019 left gradient row jumps ---")
var y = 120
while y < h - 80 {
  let a = rowMean(pre, y: y - 1, x0: 30, x1: 280)
  let b = rowMean(pre, y: y, x0: 30, x1: 280)
  let c = rowMean(pre, y: y + 1, x0: 30, x1: 280)
  let d = b - (a + c) / 2
  if abs(d) > 2.5 {
    print("y=\(y) d=\(String(format: "%+.2f", d)) L=\(String(format: "%.1f", b))")
  }
  y += 1
}

// f021 during wave: left side not yet covered. same
let mid = imgs["f021"]!
print("--- f021 left side jumps ---")
y = 120
while y < h - 40 {
  let a = rowMean(mid, y: y - 1, x0: 20, x1: 420)
  let b = rowMean(mid, y: y, x0: 20, x1: 420)
  let c = rowMean(mid, y: y + 1, x0: 20, x1: 420)
  let d = b - (a + c) / 2
  if abs(d) > 3 {
    print("y=\(y) d=\(String(format: "%+.2f", d)) L=\(String(format: "%.1f", b))")
  }
  y += 1
}

// amplify f019 band (page area y 150-280, full width) around local gradient
func amp(_ im: (w: Int, h: Int, px: [UInt8]), y0: Int, y1: Int, gain: Double, name: String) {
  let bh = y1 - y0
  var out = [UInt8](repeating: 128, count: w * bh)
  for yy in 0..<bh {
    let y = y0 + yy
    for x in 0..<w {
      let center = L(im.px, im.w, x, y)
      let up = L(im.px, im.w, x, max(0, y - 2))
      let dn = L(im.px, im.w, x, min(im.h - 1, y + 2))
      let v = (center - (up + dn) / 2) * gain + 128
      out[yy * w + x] = UInt8(min(255, max(0, v)))
    }
  }
  saveGray(w, bh, out, dir + name)
}

amp(pre, y0: 140, y1: 620, gain: 12, name: "amp-f019.png")
amp(mid, y0: 140, y1: 620, gain: 12, name: "amp-f021.png")
amp(imgs["f020"]!, y0: 140, y1: 620, gain: 12, name: "amp-f020.png")
amp(imgs["f026"]!, y0: 160, y1: 600, gain: 18, name: "amp-f026.png")
print("saved amps")
