import { describe, it, expect, vi } from 'vitest';
import { generateCodePromptJson } from './json-generator';

describe('generateCodePromptJson', () => {
  it('should generate correct JSON for a basic frame', () => {
    const node = {
      id: '1:1',
      name: 'Frame 1',
      type: 'FRAME',
      x: 0,
      y: 0,
      width: 100,
      height: 200,
      visible: true,
      opacity: 1,
      blendMode: 'NORMAL',
      children: [],
    };

    const result = generateCodePromptJson(node as any);

    expect(result).toEqual({
      id: '1:1',
      name: 'Frame 1',
      type: 'FRAME',
      x: 0,
      y: 0,
      width: 100,
      height: 200,
      visible: true,
      opacity: 1,
      blendMode: 'NORMAL',
      children: [],
    });
  });

  it('should generate correct JSON for text node', () => {
    const node = {
      id: '1:2',
      name: 'Text',
      type: 'TEXT',
      x: 10,
      y: 10,
      width: 50,
      height: 20,
      visible: true,
      opacity: 1,
      blendMode: 'NORMAL',
      characters: 'Hello',
      fontSize: 16,
      fontName: { family: 'Inter', style: 'Regular' },
      textAlignHorizontal: 'LEFT',
      textAlignVertical: 'TOP',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 }],
    };

    const result = generateCodePromptJson(node as any);

    expect(result).toMatchObject({
      type: 'TEXT',
      characters: 'Hello',
      fontSize: 16,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 }],
    });
  });

  it('should handle image fills correctly', () => {
    const node = {
      id: '1:3',
      name: 'Image',
      type: 'RECTANGLE',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      visible: true,
      opacity: 1,
      blendMode: 'NORMAL',
      fills: [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: 'abc' }],
      effects: [],
    };

    const result = generateCodePromptJson(node as any);

    expect(result.fills[0]).toEqual({
      type: 'IMAGE',
      scaleMode: 'FILL',
      imageHash: 'abc',
      url: 'https://cdn.example.com/images/abc.png',
    });
  });
});
