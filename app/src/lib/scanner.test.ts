// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from '@zxing/library'
import { isValidBarcode } from '../../../shared/domain'

describe('real ZXing fallback codec', () => {
  it('decodes a synthetic EAN-13 image including its leading digits', () => {
    const left = ['0001011', '0100111', '0110011', '0010011', '0111101', '0011101'].join('')
    const right = ['1100110', '1101100', '1000010', '1011100', '1001110', '1000100'].join('')
    const bars = `101${left}01010${right}101`
    const width = (bars.length + 24) * 3
    const height = 140
    const barcode = '5901234123457'
    // Synthetic EAN-13: first digit 5 uses LGGLLG parity; 12 white modules on each side.
    const luminance = new Uint8ClampedArray(width * height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) luminance[y * width + x] = bars[Math.floor(x / 3) - 12] === '1' ? 0 : 255
    }
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height)))
    const result = new MultiFormatReader().decode(bitmap, new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]]]))
    expect(result.getText()).toBe(barcode)
    expect(isValidBarcode(result.getText())).toBe(true)
  })
})
