import { createLayers } from './converter';
import { generateCodePromptJson } from './exporter/json-generator';

figma.showUI(__html__, { width: 400, height: 600 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'parse-psd') {
    const { psd } = msg;
    console.log('主线程已接收 PSD 数据');
    
    // Create a new page for the PSD import
    const page = figma.createPage();
    page.name = `导入 PSD - ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
    figma.currentPage = page;

    let rootNode: SceneNode | null = null;

    try {
        const root = figma.createFrame();
        root.name = psd.name || 'PSD 根节点';
        root.resize(psd.width || 100, psd.height || 100);
        root.clipsContent = true;
        page.appendChild(root);
        rootNode = root;

        const missingFonts = new Set<string>();
        await createLayers(Array.isArray(psd.children) ? psd.children : [], root, 0, 0, missingFonts);
        
        if (missingFonts.size > 0) {
            const fontList = Array.from(missingFonts).join(', ');
            // Truncate if too long
            const displayList = fontList.length > 50 ? fontList.substring(0, 50) + '...' : fontList;
            figma.notify(`PSD 导入完成，但部分字体缺失: ${displayList}`, { timeout: 6000 });
        } else {
            figma.notify('PSD 导入成功！');
        }
        figma.ui.postMessage({ type: 'import-status', level: 'success', message: 'PSD 已在主线程导入成功。' });
        
        figma.viewport.scrollAndZoomIntoView([root]);

    } catch (e) {
        console.error('导入失败：', e);
        const detail = e instanceof Error ? e.message : String(e);
        figma.ui.postMessage({ type: 'import-status', level: 'error', message: `主线程导入失败：${detail}` });
        figma.notify('导入失败，正在回滚...', { error: true });
        if (rootNode) {
            rootNode.remove();
        } else {
            page.remove();
        }
    }
  } else if (msg.type === 'generate-code-prompt') {
      // Traverse the current selection or page and generate JSON
      // For simplicity, let's target the current selection
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
          figma.notify('请先选中导入后的画板，再生成代码提示词。');
          return;
      }

      const node = selection[0];
      // Generate JSON
      const data = generateCodePromptJson(node);

      console.log('已生成代码提示词 JSON：', JSON.stringify(data, null, 2));
      figma.notify('代码提示词 JSON 已生成（请查看控制台）');
      // In a real app, we might send this back to UI to display or download
      figma.ui.postMessage({ type: 'code-prompt-generated', data });
  }
};
