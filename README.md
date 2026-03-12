
# PSD 转 Figma 转换器
![cover](https://github.com/hejingzhou/PSD2Figma/blob/main/cover-v2.svg)
将 Photoshop 的 PSD 文件导入 Figma，并尽可能保留图层结构、样式与可编辑能力。

## 当前能力

- PSD 拖拽或选择导入，支持大文件解析。
- 图层重建：分组、文本、图片、基础形状。
- 样式映射：透明度、混合模式、文本颜色与字号。
- 蒙版与 clipping 容器化处理，尽可能还原裁剪关系。
- 字体容错：缺失字体自动回退并提示。
- 导入日志：UI 侧可下载处理日志。
- 导入失败自动回滚，避免污染当前画布。
- 导出能力：主线程已支持生成代码提示 JSON（当前 UI 按钮默认未开放）。

## 项目结构

- `src/ui.tsx`：插件 UI，负责 PSD 读取、预处理、日志显示与消息发送。
- `src/code.ts`：Figma 主线程入口，负责创建页面、导入节点、回滚与通知。
- `src/converter.ts`：核心转换逻辑，处理层级、蒙版、裁剪、圆角、混合模式。
- `src/exporter/json-generator.ts`：选中节点的 JSON 导出逻辑。
- `manifest.json`：插件清单，入口为 `dist/code.js` 与 `dist/src/index.html`。

## 开发与构建

### 环境要求

- Node.js 18+
- Figma 桌面客户端

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

构建后产物：

- 主线程：`dist/code.js`
- UI：`dist/src/index.html`

### 开发监听

```bash
npm run watch
```

## 在 Figma 中加载

1. 打开 Figma。
2. 进入 插件 > 开发 > 从清单导入插件。
3. 选择仓库根目录下 `manifest.json`。
4. 在开发插件列表中运行“PSD 转 Figma 转换器”。

## 使用说明

1. 启动插件面板。
2. 拖拽或选择 `.psd` 文件。
3. 等待解析与导入完成提示。
4. 在新建页面中查看导入结果。
5. 如需排查，点击“下载处理日志”获取完整日志文件。

## 测试

```bash
npm test
```

包含转换逻辑与 JSON 导出的单元测试，并输出覆盖率报告。

## 技术栈

- React + TypeScript
- ag-psd
- Vite + esbuild
- Vitest

## 许可证

MIT
