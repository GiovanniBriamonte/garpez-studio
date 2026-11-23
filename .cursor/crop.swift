import CoreGraphics
import Foundation
import ImageIO

let dir = "/Users/gyno/Desktop/Studio/Cursor/garpez-tv/.cursor/frames/"
let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: dir + "f021.jpg") as CFURL, nil)!
let cg = CGImageSourceCreateImageAtIndex(src, 0, nil)!
// crop left empty area of the page (below header, left of TV) and scale Y x4
let crop = cg.cropping(to: CGRect(x: 40, y: 180, width: 280, height: 360))!
let outW = crop.width
let outH = crop.height * 3
let cs = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: nil, width: outW, height: outH, bitsPerComponent: 8, bytesPerRow: outW * 4, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.interpolationQuality = .none
ctx.draw(crop, in: CGRect(x: 0, y: 0, width: outW, height: outH))
let out = ctx.makeImage()!
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: dir + "crop-f021.png") as CFURL, "public.png" as CFString, 1, nil)!
CGImageDestinationAddImage(dest, out, nil)
CGImageDestinationFinalize(dest)
print("ok", outW, outH)
