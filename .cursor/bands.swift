import CoreGraphics
import Foundation
import ImageIO

func load(_ name: String) -> CGImage {
  let path = "/Users/gyno/Desktop/Studio/Cursor/garpez-tv/.cursor/frames/" + name
  let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil)!
  return CGImageSourceCreateImageAtIndex(src, 0, nil)!
}

func save(_ cg: CGImage, _ name: String) {
  let path = "/Users/gyno/Desktop/Studio/Cursor/garpez-tv/.cursor/frames/" + name
  let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, "public.png" as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, cg, nil)
  CGImageDestinationFinalize(dest)
}

let a = load("f016.jpg")
let b = load("f021.jpg")
let bands = [(190, 30, "y190"), (400, 40, "y400"), (490, 30, "y490")]
for (y, h, tag) in bands {
  let cropA = a.cropping(to: CGRect(x: 0, y: y, width: a.width, height: h))!
  let cropB = b.cropping(to: CGRect(x: 0, y: y, width: b.width, height: h))!
  let outW = a.width
  let outH = h * 4 * 2 + 8
  let ctx = CGContext(data: nil, width: outW, height: outH, bitsPerComponent: 8, bytesPerRow: outW * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.interpolationQuality = .none
  ctx.setFillColor(CGColor(gray: 1, alpha: 1))
  ctx.fill(CGRect(x: 0, y: 0, width: outW, height: outH))
  ctx.draw(cropA, in: CGRect(x: 0, y: outH - h * 4, width: outW, height: h * 4))
  ctx.draw(cropB, in: CGRect(x: 0, y: 0, width: outW, height: h * 4))
  save(ctx.makeImage()!, "band-\(tag).png")
  print("saved", tag)
}
