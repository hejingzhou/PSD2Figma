/// <reference types="@figma/plugin-typings" />
import type { Layer } from 'ag-psd';
import { mapBlendMode } from './utils/figma-helpers';
import {
  toPositiveSize,
  toPosition,
  toNodeOpacity,
  toBoundsSize,
  getLayerBounds,
  isBoundsOverlap,
  getNodeWidth,
  getNodeHeight,
  copyCornerRadiiFromNode,
  getUnitValue,
} from './utils/convert-helpers';

const getLayerStackRank = (layer: Layer, fallback: number) => {
  const typed = layer as Record<string, unknown>;
  const candidates = [
    typed.zIndex,
    typed.itemIndex,
    typed.layerIndex,
    typed.stackIndex,
    (typed.meta as Record<string, unknown> | undefined)?.zIndex,
    (typed.meta as Record<string, unknown> | undefined)?.itemIndex
  ];
  for (const candidate of candidates) {
    const rank = (typeof candidate === 'number' && Number.isFinite(candidate)) ? candidate : null;
    if (rank !== null) return rank;
  }
  return fallback;
};

const normalizeLayerOrder = (layers: Layer[]) => {
  const ranked = layers.map((layer, index) => ({
    layer,
    index,
    rank: getLayerStackRank(layer, index)
  }));
  const changed = ranked.some((item) => item.rank !== item.index);
  if (!changed) return { orderedLayers: layers, changed: false };
  ranked.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.index - b.index;
  });
  return {
    orderedLayers: ranked.map((item) => item.layer),
    changed: true
  };
};

const auditImageStacking = (layers: Layer[]) => {
  const imageLayers = layers
    .map((layer, index) => ({ layer, index, bounds: getLayerBounds(layer) }))
    .filter(
      (item) =>
        Boolean((item.layer as any).imageBytes) &&
        Boolean(item.bounds) &&
        !item.layer.hidden
    );
  for (let i = 0; i < imageLayers.length; i++) {
    for (let j = i + 1; j < imageLayers.length; j++) {
      const lower = imageLayers[i];
      const upper = imageLayers[j];
      if (!isBoundsOverlap(lower.bounds, upper.bounds)) continue;
      if (lower.index > upper.index) continue;
      console.log(`[LayerAudit] 重叠图层: ${lower.layer.name}(${lower.index}) < ${upper.layer.name}(${upper.index})`);
    }
  }
};

const extractCornerRadii = (descriptor: any) => {
  const radii = descriptor?.keyOriginRRectRadii;
  if (!radii) return null;
  return {
    topLeft: toPositiveSize(getUnitValue(radii.topLeft), 0),
    topRight: toPositiveSize(getUnitValue(radii.topRight), 0),
    bottomRight: toPositiveSize(getUnitValue(radii.bottomRight), 0),
    bottomLeft: toPositiveSize(getUnitValue(radii.bottomLeft), 0)
  };
};

const getCornerRadii = (layer: Layer) => {
  const descriptors = (layer as any).vectorOrigination?.keyDescriptorList;
  if (!descriptors || !Array.isArray(descriptors) || descriptors.length === 0) return null;
  for (const descriptor of descriptors) {
    const radii = extractCornerRadii(descriptor);
    if (radii) return radii;
  }
  return null;
};

const applyCornerRadii = (node: RectangleNode | FrameNode, layer: Layer) => {
    const radii = getCornerRadii(layer);
    if (radii) {
        if (radii.topLeft === radii.topRight && 
            radii.topLeft === radii.bottomRight && 
            radii.topLeft === radii.bottomLeft) {
            node.cornerRadius = radii.topLeft;
        } else {
            node.topLeftRadius = radii.topLeft;
            node.topRightRadius = radii.topRight;
            node.bottomRightRadius = radii.bottomRight;
            node.bottomLeftRadius = radii.bottomLeft;
        }
    }
};

const getMaskBounds = (layer: Layer) => {
  const mask = (layer as any).mask;
  if (!mask || mask.disabled) return null;
  const left = toPosition(mask.left);
  const top = toPosition(mask.top);
  const width = toBoundsSize(mask.left, mask.right);
  const height = toBoundsSize(mask.top, mask.bottom);
  if (width <= 0 || height <= 0) return null;
  return { left, top, width, height };
};

export async function createLayers(
  layers: Layer[],
  parent: BaseNode & ChildrenMixin,
  parentLeft = 0,
  parentTop = 0,
  missingFonts?: Set<string>
) {
  let clippingState:
    | { baseNode: SceneNode; baseX: number; baseY: number; baseWidth: number; baseHeight: number; container: FrameNode | null }
    | null = null;

  const { orderedLayers, changed } = normalizeLayerOrder(layers);
  if (changed) console.log('[LayerAudit] 已按 PSD 堆叠索引重排同级图层');
  auditImageStacking(orderedLayers);

  for (const layer of orderedLayers) {
    if (layer.hidden) continue;
    if ((layer as any).adjustment) continue;

    const width = toPositiveSize(layer.width, 0);
    const height = toPositiveSize(layer.height, 0);
    const hasDimensions = width > 0 && height > 0;

    let node: SceneNode | null = null;

    if (layer.children?.length) {
      const group = figma.createFrame();
      group.name = layer.name || '分组';
      const groupWidth = width || toBoundsSize(layer.left, layer.right);
      const groupHeight = height || toBoundsSize(layer.top, layer.bottom);
      group.resize(groupWidth || 100, groupHeight || 100);
      group.fills = [];
      group.clipsContent = groupWidth > 0 && groupHeight > 0;
      applyCornerRadii(group, layer);
      parent.appendChild(group);
      await createLayers(layer.children, group, toPosition(layer.left), toPosition(layer.top), missingFonts);
      node = group;
    } else if (layer.text) {
      node = await createTextNode(layer, missingFonts);
      if (node) parent.appendChild(node);
    } else if ((layer as any).imageBytes) {
      node = createImageNode(layer, width, height);
      if (node) parent.appendChild(node);
    } else if (hasDimensions) {
      node = createShapeNode(layer, width, height);
      if (node) parent.appendChild(node);
    }

    if (!node) continue;

    const nodeX = toPosition(layer.left) - parentLeft;
    const nodeY = toPosition(layer.top) - parentTop;
    node.x = nodeX;
    node.y = nodeY;

    let renderNode: SceneNode = node;
    const maskBounds = getMaskBounds(layer);
    if (maskBounds) {
      renderNode = createMaskFrame(layer, node, maskBounds, parent, parentLeft, parentTop);
    }

    handleClipping(layer, renderNode, parent, clippingState, (state) => (clippingState = state));
    applyLayerProperties(renderNode, layer);
  }
}

async function createTextNode(layer: Layer, missingFonts?: Set<string>): Promise<TextNode | null> {
  const textNode = figma.createText();
  textNode.name = layer.name || '文本';
  
  const fontFamily = layer.text.style?.font?.name || 'Inter';
  const fontStyle = layer.text.style?.font?.style || 'Regular';
  
  try {
    await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
    textNode.fontName = { family: fontFamily, style: fontStyle };
  } catch {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    textNode.fontName = { family: 'Inter', style: 'Regular' };
    missingFonts?.add(`${fontFamily} ${fontStyle}`);
  }

  textNode.characters = layer.text.text || '';
  textNode.fontSize = toPositiveSize(layer.text.style?.fontSize, 12);
  
  if (layer.text.style?.fillColor) {
    const color = layer.text.style.fillColor;
    textNode.fills = [{
      type: 'SOLID',
      color: { r: (color.r || 0)/255, g: (color.g || 0)/255, b: (color.b || 0)/255 },
      opacity: (color.a ?? 255) / 255
    }];
  }
  
  return textNode;
}

function createImageNode(layer: Layer, width: number, height: number): RectangleNode | null {
  const imageBytes = (layer as any).imageBytes;
  if (!imageBytes) return null;
  
  const image = figma.createImage(imageBytes);
  const rect = figma.createRectangle();
  rect.name = layer.name || '图像';
  
  const imageWidth = width || toBoundsSize(layer.left, layer.right) || (layer as any).originalWidth || 100;
  const imageHeight = height || toBoundsSize(layer.top, layer.bottom) || (layer as any).originalHeight || 100;
  rect.resize(imageWidth, imageHeight);
  
  rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];
  applyCornerRadii(rect, layer);
  
  return rect;
}

function createShapeNode(layer: Layer, width: number, height: number): RectangleNode {
  const rect = figma.createRectangle();
  rect.name = layer.name || '矢量/形状';
  rect.resize(width, height);
  rect.fills = [];
  applyCornerRadii(rect, layer);
  if ((layer as any).clippingMask) rect.name += '（蒙版）';
  return rect;
}

function createMaskFrame(layer: Layer, node: SceneNode, maskBounds: { left: number; top: number; width: number; height: number }, parent: BaseNode & ChildrenMixin, parentLeft: number, parentTop: number): FrameNode {
  const clipFrame = figma.createFrame();
  clipFrame.name = `${layer.name || '图层'} 蒙版`;
  clipFrame.resize(maskBounds.width, maskBounds.height);
  clipFrame.fills = [];
  clipFrame.clipsContent = true;
  copyCornerRadiiFromNode(node, clipFrame);
  clipFrame.x = maskBounds.left - parentLeft;
  clipFrame.y = maskBounds.top - parentTop;
  
  const parentChildren = (parent as any).children as SceneNode[];
  const originalIndex = Array.isArray(parentChildren) ? parentChildren.indexOf(node) : -1;
  if (originalIndex >= 0) (parent as any).insertChild?.(originalIndex, clipFrame);
  else parent.appendChild(clipFrame);
  
  node.x = toPosition(layer.left) - parentLeft - clipFrame.x;
  node.y = toPosition(layer.top) - parentTop - clipFrame.y;
  clipFrame.appendChild(node);
  return clipFrame;
}

function handleClipping(layer: Layer, renderNode: SceneNode, parent: BaseNode & ChildrenMixin, clippingState: { baseNode: SceneNode; baseX: number; baseY: number; baseWidth: number; baseHeight: number; container: FrameNode | null } | null, setClippingState: (state: typeof clippingState) => void) {
  const renderX = renderNode.x;
  const renderY = renderNode.y;
  const layerClipping = Boolean((layer as any).clipping);
  
  if (layerClipping && clippingState) {
    if (!clippingState.container) {
      const clipContainer = figma.createFrame();
      clipContainer.name = `${clippingState.baseNode.name || '图层'} 裁剪`;
      clipContainer.resize(clippingState.baseWidth, clippingState.baseHeight);
      clipContainer.fills = [];
      clipContainer.clipsContent = true;
      clipContainer.x = clippingState.baseX;
      clipContainer.y = clippingState.baseY;
      
      const parentChildren = (parent as any).children as SceneNode[];
      const baseIndex = Array.isArray(parentChildren) ? parentChildren.indexOf(clippingState.baseNode) : -1;
      if (baseIndex >= 0) (parent as any).insertChild?.(baseIndex, clipContainer);
      else parent.appendChild(clipContainer);
      
      clippingState.baseNode.x = clippingState.baseX - clipContainer.x;
      clippingState.baseNode.y = clippingState.baseY - clipContainer.y;
      copyCornerRadiiFromNode(clippingState.baseNode, clipContainer);
      clipContainer.appendChild(clippingState.baseNode);
      clippingState.container = clipContainer;
    }
    const container = clippingState.container;
    if (container) {
      renderNode.x = renderX - container.x;
      renderNode.y = renderY - container.y;
      container.appendChild(renderNode);
    }
  } else if (!layerClipping) {
    const baseWidth = getNodeWidth(renderNode);
    const baseHeight = getNodeHeight(renderNode);
    setClippingState(baseWidth > 0 && baseHeight > 0 ? { baseNode: renderNode, baseX: renderX, baseY: renderY, baseWidth, baseHeight, container: null } : null);
  } else {
    setClippingState(null);
  }
}

function applyLayerProperties(renderNode: SceneNode, layer: Layer) {
  renderNode.visible = !layer.hidden;
  renderNode.opacity = toNodeOpacity(layer.opacity);
  
  if (layer.blendMode) {
    try {
      renderNode.blendMode = mapBlendMode(layer.blendMode);
    } catch (e) {
      console.warn(`混合模式 ${layer.blendMode} 不受支持`, e);
    }
  }
  
  renderNode.setPluginData('psdLayerId', String((layer as any).id || ''));
  renderNode.setPluginData('psdBlendMode', layer.blendMode || 'normal');
  renderNode.setPluginData('psdOpacity', String(layer.opacity || 1));
  renderNode.setSharedPluginData('psd2figma', 'originalName', layer.name || '');
}
