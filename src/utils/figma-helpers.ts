export function mapBlendMode(psdBlendMode: string): BlendMode {
  switch (psdBlendMode) {
    case 'pass through': return 'PASS_THROUGH';
    case 'normal': return 'NORMAL';
    case 'darken': return 'DARKEN';
    case 'multiply': return 'MULTIPLY';
    case 'linear burn': return 'LINEAR_BURN';
    case 'color burn': return 'COLOR_BURN';
    case 'lighten': return 'LIGHTEN';
    case 'screen': return 'SCREEN';
    case 'linear dodge': return 'LINEAR_DODGE';
    case 'color dodge': return 'COLOR_DODGE';
    case 'overlay': return 'OVERLAY';
    case 'soft light': return 'SOFT_LIGHT';
    case 'hard light': return 'HARD_LIGHT';
    case 'difference': return 'DIFFERENCE';
    case 'exclusion': return 'EXCLUSION';
    case 'hue': return 'HUE';
    case 'saturation': return 'SATURATION';
    case 'color': return 'COLOR';
    case 'luminosity': return 'LUMINOSITY';
    default: return 'NORMAL';
  }
}

export function mapTextCase(textCase: string): TextCase {
  switch (textCase) {
    case 'all caps': return 'UPPER';
    case 'small caps': return 'SMALL_CAPS'; // Figma doesn't support small caps directly via textCase property, only via OpenType features
    // For simplicity, map to ORIGINAL if not supported directly
    default: return 'ORIGINAL';
  }
}

export function mapTextDecoration(decoration: string): TextDecoration {
  switch (decoration) {
    case 'underline': return 'UNDERLINE';
    case 'strikethrough': return 'STRIKETHROUGH';
    default: return 'NONE';
  }
}
