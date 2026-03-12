import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLayers } from './converter';
import { Layer } from 'ag-psd';

// Mock global figma
const mockParent = {
  appendChild: vi.fn(),
  insertChild: vi.fn(),
  children: [],
  setPluginData: vi.fn(),
  setSharedPluginData: vi.fn(),
  resize: vi.fn(), // Add resize here
} as any;

describe('createLayers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const createMockNode = (type: string) => {
      const node: any = {
        ...mockParent,
        type,
        appendChild: vi.fn(),
        fills: [],
        clipsContent: false,
        width: 0,
        height: 0
      };
      node.resize = vi.fn((w: number, h: number) => {
        node.width = w;
        node.height = h;
      });
      return node;
    };
    (global as any).figma = {
        createFrame: vi.fn(() => createMockNode('FRAME')),
        createText: vi.fn(() => ({ ...createMockNode('TEXT'), fontName: {} })),
        createRectangle: vi.fn(() => createMockNode('RECTANGLE')),
        createImage: vi.fn(() => ({ hash: 'mock-hash' })),
        loadFontAsync: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('should create a group (Frame) for layer with children', async () => {
    const layers: Layer[] = [
      {
        name: 'Group 1',
        children: [{ name: 'Child 1', width: 100, height: 100 }],
        width: 200,
        height: 200,
      },
    ];

    await createLayers(layers, mockParent);

    expect(figma.createFrame).toHaveBeenCalled();
    expect(mockParent.appendChild).toHaveBeenCalled();
  });

  it('should create a text node for text layer', async () => {
    const layers: Layer[] = [
      {
        name: 'Text Layer',
        text: { text: 'Hello', style: { fontSize: 16, font: { name: 'Arial', style: 'Bold' } } },
      },
    ];

    await createLayers(layers, mockParent);

    expect(figma.createText).toHaveBeenCalled();
    expect(mockParent.appendChild).toHaveBeenCalled();
    expect(figma.loadFontAsync).toHaveBeenCalledWith({ family: 'Arial', style: 'Bold' });
  });

  it('should create a rectangle with image fill for raster layer', async () => {
    const layers: Layer[] = [
      {
        name: 'Image Layer',
        // @ts-ignore
        imageBytes: new Uint8Array([1, 2, 3]),
        width: 200,
        height: 100,
      },
    ];

    await createLayers(layers, mockParent);

    expect(figma.createImage).toHaveBeenCalled();
    expect(figma.createRectangle).toHaveBeenCalled();
    expect(mockParent.appendChild).toHaveBeenCalled();
  });

  it('should create a rectangle for unknown layer type', async () => {
    const layers: Layer[] = [
      {
        name: 'Unknown Layer',
        width: 50,
        height: 50,
      },
    ];

    await createLayers(layers, mockParent);

    expect(figma.createRectangle).toHaveBeenCalled();
    expect(mockParent.appendChild).toHaveBeenCalled();
  });

  it('should wrap masked image layer in clipping frame', async () => {
    const layers: Layer[] = [
      {
        name: 'Masked Image',
        // @ts-ignore
        imageBytes: new Uint8Array([1, 2, 3]),
        left: 20,
        top: 30,
        width: 200,
        height: 100,
        // @ts-ignore
        vectorOrigination: {
          keyDescriptorList: [
            {
              keyOriginRRectRadii: {
                topLeft: { value: 14 },
                topRight: { value: 14 },
                bottomRight: { value: 14 },
                bottomLeft: { value: 14 }
              }
            }
          ]
        },
        // @ts-ignore
        mask: { left: 30, top: 40, right: 180, bottom: 120 },
      },
    ];

    await createLayers(layers, mockParent);

    expect(figma.createFrame).toHaveBeenCalledTimes(1);
    const clipFrame = (figma.createFrame as any).mock.results[0].value;
    expect(clipFrame.resize).toHaveBeenCalledWith(150, 80);
    expect(clipFrame.appendChild).toHaveBeenCalled();
    expect(clipFrame.cornerRadius).toBe(14);
  });

  it('should handle number type corner radii (robustness check)', async () => {
    const layers: Layer[] = [
      {
        name: 'Number Radii',
        width: 100,
        height: 100,
        // @ts-ignore
        vectorOrigination: {
          keyDescriptorList: [
            {
              keyOriginRRectRadii: {
                topLeft: 20,
                topRight: 20,
                bottomRight: 20,
                bottomLeft: 20
              }
            }
          ]
        },
      },
    ];

    await createLayers(layers, mockParent);

    const rect = (figma.createRectangle as any).mock.results[0].value;
    expect(rect.cornerRadius).toBe(20);
  });

  it('should apply group corner radius from non-first descriptor', async () => {
    const layers: Layer[] = [
      {
        name: 'Group Radius',
        width: 200,
        height: 120,
        // @ts-ignore
        vectorOrigination: {
          keyDescriptorList: [
            { keyOriginType: 'other' },
            {
              keyOriginRRectRadii: {
                topLeft: { value: 18 },
                topRight: { value: 18 },
                bottomRight: { value: 18 },
                bottomLeft: { value: 18 }
              }
            }
          ]
        },
        children: [{ name: 'Child', width: 20, height: 20 }],
      },
    ];

    await createLayers(layers, mockParent);

    const group = (figma.createFrame as any).mock.results[0].value;
    expect(group.cornerRadius).toBe(18);
  });

  it('should inherit frame corner radii for clipping container', async () => {
    const layers: Layer[] = [
      {
        name: 'Base Group',
        width: 120,
        height: 80,
        left: 10,
        top: 20,
        // @ts-ignore
        vectorOrigination: {
          keyDescriptorList: [
            {
              keyOriginRRectRadii: {
                topLeft: { value: 8 },
                topRight: { value: 12 },
                bottomRight: { value: 16 },
                bottomLeft: { value: 20 }
              }
            }
          ]
        },
        children: [{ name: 'Child', width: 40, height: 20 }],
      },
      {
        name: 'Clipped',
        // @ts-ignore
        imageBytes: new Uint8Array([1, 2, 3]),
        width: 220,
        height: 120,
        left: 0,
        top: 0,
        clipping: true,
      },
    ];

    await createLayers(layers, mockParent);

    expect(figma.createFrame).toHaveBeenCalledTimes(2);
    const clipContainer = (figma.createFrame as any).mock.results[1].value;
    expect(clipContainer.topLeftRadius).toBe(8);
    expect(clipContainer.topRightRadius).toBe(12);
    expect(clipContainer.bottomRightRadius).toBe(16);
    expect(clipContainer.bottomLeftRadius).toBe(20);
  });

  it('should clip clipping-layer to previous base layer bounds', async () => {
    const layers: Layer[] = [
      {
        name: 'Base',
        width: 100,
        height: 60,
        left: 10,
        top: 20,
      },
      {
        name: 'Clipped',
        // @ts-ignore
        imageBytes: new Uint8Array([1, 2, 3]),
        width: 220,
        height: 120,
        left: 0,
        top: 0,
        clipping: true,
      },
    ];

    await createLayers(layers, mockParent);

    expect(figma.createFrame).toHaveBeenCalledTimes(1);
    const clipFrame = (figma.createFrame as any).mock.results[0].value;
    expect(clipFrame.resize).toHaveBeenCalledWith(100, 60);
    expect(clipFrame.appendChild).toHaveBeenCalledTimes(2);
  });

  it('should track missing fonts', async () => {
    const layers: Layer[] = [
      {
        name: 'Text Layer',
        text: { text: 'Hello', style: { fontSize: 16, font: { name: 'UnknownFont', style: 'Regular' } } },
      },
    ];

    // Mock loadFontAsync to fail for the first call (specific font) but succeed for fallback
    (figma.loadFontAsync as any).mockImplementation((font: any) => {
        if (font.family === 'UnknownFont') {
            return Promise.reject(new Error('Font not found'));
        }
        return Promise.resolve();
    });

    const missingFonts = new Set<string>();
    await createLayers(layers, mockParent, 0, 0, missingFonts);

    expect(missingFonts.has('UnknownFont Regular')).toBe(true);
    expect(figma.loadFontAsync).toHaveBeenCalledWith({ family: 'UnknownFont', style: 'Regular' });
    expect(figma.loadFontAsync).toHaveBeenCalledWith({ family: 'Inter', style: 'Regular' });
  });
});
