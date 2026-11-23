import CoreGraphics
import Foundation
import ImageIO

func load(_ path: String) -> (w: Int, h: Int, px: [UInt8]) {
  let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil)!
  let cg = CGImageSourceCreateImageAtIndex(src, 0, nil)!
  let w = cg.width, h = cg.height
  var px = [UInt8](repeating: 0, count: w * h * 4)
  px.withUnsafeMutableBytes { raw in
    let ctx = CGContext(data: raw.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
  }
  return (w, h, px)
}

let dir = "/Users/gyno/Desktop/Studio/Cursor/garpez-tv/.cursor/frames/"
let a = load(dir + "f016.jpg")
let b = load(dir + "f019.jpg")
let c = load(dir + "f021.jpg")
let w = a.w, h = a.h

func save(_ bytes: [UInt8], _ path: String, _ bw: Int, _ bh: Int) {
  let data = Data(bytes)
  let provider = CGDataProvider(data: data as CFData)!
  let cg = CGImage(width: bw, height: bh, bitsPerComponent: 8, bitsPerPixel: 8, bytesPerRow: bw, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGBitmapInfo(rawValue: 0), provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
  let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, "public.png" as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, cg, nil)
  CGImageDestinationFinalize(dest)
}

// abs diff f016 vs f019, contrast stretched
var diff = [UInt8](repeating: 0, count: w * h)
var maxd = 0
for i in 0..<(w * h) {
  let d = abs(Int(a.px[i * 4]) - Int(b.px[i * 4])) + abs(Int(a.px[i * 4 + 1]) - Int(b.px[i * 4 + 1])) + abs(Int(a.px[i * 4 + 2]) - Int(b.px[i * 4 + 2]))
  if d > maxd { maxd = d }
  diff[i] = UInt8(min(255, d * 8))
}
print("max diff 16-19", maxd)
save(diff, dir + "diff-16-19.png", w, h)

// high-pass of f021 only where the highpass is strong AND the pixel is not part of the TV (we'll just save full)
var hp = [UInt8](repeating: 128, count: w * h)
for y in 2..<(h - 2) {
  for x in 0..<w {
    let i = (y * w + x) * 4
    let u = ((y - 2) * w + x) * 4
    let d = ((y + 2) * w + x) * 4
    let Lc = 0.3 * Double(c.px[i]) + 0.6 * Double(c.px[i + 1]) + 0.1 * Double(c.px[i + 2])
    let Lu = 0.3 * Double(c.px[u]) + 0.6 * Double(c.px[u + 1]) + 0.1 * Double(c.px[u + 2])
    let Ld = 0.3 * Double(c.px[d]) + 0.6 * Double(c.px[d + 1]) + 0.1 * Double(c.px[d + 2])
    let v = (Lc - (Lu + Ld) / 2) * 10 + 128
    hp[y * w + x] = UInt8(min(255, max(0, v)))
  }
}
save(hp, dir + "hp-f021.png", w, h)
print("saved")
