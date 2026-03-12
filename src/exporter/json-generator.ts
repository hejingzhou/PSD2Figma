export function generateCodePromptJson(node: SceneNode): any {
  const result: any = {
    id: node.id,
    name: node.name,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    visible: node.visible,
    opacity: node.opacity,
    blendMode: node.blendMode,
  };

  // Add type specific properties
  if (node.type === 'TEXT') {
    result.characters = node.characters;
    result.fontSize = node.fontSize;
    result.fontName = node.fontName;
    result.textAlignHorizontal = node.textAlignHorizontal;
    result.textAlignVertical = node.textAlignVertical;
    // Fills
    if (Array.isArray(node.fills)) {
        result.fills = node.fills.map(fill => {
            if (fill.type === 'SOLID') {
                return { type: 'SOLID', color: fill.color, opacity: fill.opacity };
            }
            return { type: fill.type };
        });
    }
  } else if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || node.type === 'VECTOR') {
      if (Array.isArray(node.fills)) {
        result.fills = node.fills.map(fill => {
            if (fill.type === 'IMAGE') {
                return { type: 'IMAGE', scaleMode: fill.scaleMode, imageHash: fill.imageHash, url: `https://cdn.example.com/images/${fill.imageHash}.png` };
            }
            if (fill.type === 'SOLID') {
                return { type: 'SOLID', color: fill.color, opacity: fill.opacity };
            }
            return { type: fill.type };
        });
    }
    if (Array.isArray(node.strokes)) {
        result.strokes = node.strokes.map(stroke => {
             if (stroke.type === 'SOLID') {
                return { type: 'SOLID', color: stroke.color, opacity: stroke.opacity };
            }
            return { type: stroke.type };
        });
        result.strokeWeight = node.strokeWeight;
    }
    // Effects (Shadows)
    if (Array.isArray(node.effects)) {
        result.effects = node.effects.map(effect => ({
            type: effect.type,
            visible: effect.visible,
            radius: effect.radius,
            offset: effect.offset,
            spread: effect.spread,
            color: effect.color,
            blendMode: effect.blendMode
        }));
    }
  }

  // Children
  if ('children' in node) {
    result.children = node.children.map(child => generateCodePromptJson(child));
  }

  return result;
}
