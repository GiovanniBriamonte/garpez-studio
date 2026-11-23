import CoreGraphics
import Foundation
import ImageIO

let path = "/Users/gyno/Desktop/Studio/Cursor/garpez-tv/.cursor/frames/hp-f021.png"
let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil)!
let cg = CGImageSourceCreateImageAtIndex(src, 0, nil)!
let w = cg.width, h = cg.height
var px = [UInt8](repeating: 0, count: w * h)
px.withUnsafeMutableBytes { raw in
  let ctx = CGContext(data: raw.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGBitmapInfo(rawValue: 0))!
  ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
}
print("size", w, h)
// left band x=80...320, find rows whose mean is far from 128
var hits: [Int] = []
for y in 80..<(h - 40) {
  var s = 0
  var n = 0
  for x in stride(from: 80, to: 320, by: 2) {
    s += Int(px[y * w + x])
    n += 1
  }
  let m = Double(s) / Double(n)
  if abs(m - 128) > 6 { hits.append(y) }
}
// cluster
var clusters: [Int] = []
var prev = -10
var acc = 0
var cnt = 0
for y in hits {
  if y > prev + 3 {
    if cnt > 0 { clusters.append(acc / cnt) }
    acc = y
    cnt = 1
  } else {
    acc += y
    cnt += 1
  }
  prev = y
}
if cnt > 0 { clusters.append(acc / cnt) }
print("line centers", clusters)
if clusters.count > 2 {
  var gaps: [Int] = []
  for i in 1..<clusters.count { gaps.append(clusters[i] - clusters[i - 1]) }
  print("gaps", gaps)
}

// also measure original f021 red-block pitch on the right: rows where red is high
let jpg = CGImageSourceCreateWithURL(URL(fileURLWithPath: "/Users/gyno/Desktop/Studio/Cursor/garpez-tv/.cursor/frames/f021.jpg") as CFURL, nil)!
let jg = CGImageSourceCreateImageAtIndex(jpg, 0, nil)!
var rgba = [UInt8](repeating: 0, count: jg.width * jg.height * 4)
rgba.withUnsafeMutableBytes { raw in
  let ctx = CGContext(data: raw.baseAddress, width: jg.width, height: jg.height, bitsPerComponent: 8, bytesPerRow: jg.width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.draw(jg, in: CGRect(x: 0, y: 0, width: jg.width, height: jg.height))
}
let jw = jg.width
var redRows: [Int] = []
for y in 100..<(jg.height - 20) {
  var red = 0
  var n = 0
  // right edge
  for x in stride(from: jw - 80, to: jw - 10, by: 2) {
    let i = (y * jw + x) * 4
    if rgba[i] > 150 && rgba[i] > rgba[i + 1] + 30 { red += 1 }
    n += 1
  }
  if Double(red) / Double(n) > 0.4 { redRows.append(y) }
}
var rc: [Int] = []
prev = -10
var start = 0
for y in redRows {
  if y > prev + 2 {
    if prev > 0 { rc.append((start + prev) / 2) }
    start = y
  }
  prev = y
}
if prev > 0 { rc.append((start + prev) / 2) }
print("red block centers", rc)
if rc.count > 2 {
  var gaps: [Int] = []
  for i in 1..<rc.count { gaps.append(rc[i] - rc[i - 1]) }
  print("red gaps", gaps)
}
