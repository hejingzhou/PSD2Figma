/// <reference types="@figma/plugin-typings" />

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const toPositiveSize = (value: unknown, fallback = 100): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return value;
};

export const getUnitValue = (value: unknown): number | undefined => {
    if (typeof value === 'number') return value;
    if (value && typeof value === 'object' && 'value' in value) return (value as { value: number }).value;
    return undefined;
};

export const toPosition = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return value;
};

export const toFiniteNumberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export const toNodeOpacity = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  if (value > 1) return clamp(value / 255, 0, 1);
  return clamp(value, 0, 1);
};

export const toBoundsSize = (start: unknown, end: unknown): number => {
  if (typeof start !== 'number' || !Number.isFinite(start)) return 0;
  if (typeof end !== 'number' || !Number.isFinite(end)) return 0;
  return toPositiveSize(end - start, 0);
};

export const getLayerBounds = (layer: { left?: unknown; top?: unknown; width?: unknown; height?: unknown; right?: unknown; bottom?: unknown }) => {
  const left = toPosition(layer.left);
  const top = toPosition(layer.top);
  const width = toPositiveSize(layer.width, toBoundsSize(layer.left, layer.right));
  const height = toPositiveSize(layer.height, toBoundsSize(layer.top, layer.bottom));
  if (width <= 0 || height <= 0) return null;
  return { left, top, width, height };
};

export const isBoundsOverlap = (
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number }
) =>
  a.left < b.left + b.width &&
  a.left + a.width > b.left &&
  a.top < b.top + b.height &&
  a.top + a.height > b.top;

export const getNodeWidth = (node: SceneNode): number => {
  const value = (node as any).width;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

export const getNodeHeight = (node: SceneNode): number => {
  const value = (node as any).height;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

export const copyCornerRadiiFromNode = (source: SceneNode, target: FrameNode) => {
  if (source.type !== 'RECTANGLE' && source.type !== 'FRAME') return;
  const sourceNode = source as RectangleNode | FrameNode;
  if (sourceNode.cornerRadius !== figma.mixed) {
    if (typeof sourceNode.cornerRadius === 'number') {
      target.cornerRadius = sourceNode.cornerRadius;
    }
    return;
  }
  target.topLeftRadius = sourceNode.topLeftRadius;
  target.topRightRadius = sourceNode.topRightRadius;
  target.bottomRightRadius = sourceNode.bottomRightRadius;
  target.bottomLeftRadius = sourceNode.bottomLeftRadius;
};
