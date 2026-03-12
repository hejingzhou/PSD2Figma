import React, { useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Psd, readPsd, Layer } from 'ag-psd';

const App = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    console.log(msg);
    setLogs(prev => [...prev, `[${new Date().toISOString()}] ${msg}`]);
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const payload = event.data?.pluginMessage;
      if (!payload || payload.type !== 'import-status') return;
      addLog(payload.message);
      if (payload.level === 'error') setError(payload.message);
    };
    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
    };
  }, [addLog]);

  const isCanvasLike = (value: unknown) => {
    if (!value || typeof value !== 'object') return false;
    if (typeof HTMLCanvasElement !== 'undefined' && value instanceof HTMLCanvasElement) return true;
    const ctorName = (value as { constructor?: { name?: string } }).constructor?.name;
    return ctorName === 'HTMLCanvasElement' || ctorName === 'OffscreenCanvas';
  };

  const stripCanvasNodes = (value: unknown, visited = new WeakSet<object>()): number => {
    if (!value || typeof value !== 'object') return 0;
    const objectValue = value as Record<string, unknown>;
    if (visited.has(objectValue)) return 0;
    visited.add(objectValue);
    let removed = 0;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (isCanvasLike(item)) {
          value[i] = null;
          removed++;
          continue;
        }
        removed += stripCanvasNodes(item, visited);
      }
      return removed;
    }
    for (const key of Object.keys(objectValue)) {
      const child = objectValue[key];
      if (isCanvasLike(child)) {
        delete objectValue[key];
        removed++;
        continue;
      }
      removed += stripCanvasNodes(child, visited);
    }
    return removed;
  };

  const processLayer = async (layer: any) => {
    const canvas = layer?.canvas as HTMLCanvasElement | undefined;
    if (canvas) {
      try {
        // 保存原始图像尺寸信息
        layer.originalWidth = canvas.width;
        layer.originalHeight = canvas.height;
        addLog(`正在处理图像图层 ${layer.name || '未命名'}：${canvas.width}x${canvas.height}px`);
        
        if (typeof canvas.toBlob === 'function') {
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
            layer.imageBytes = new Uint8Array(await blob.arrayBuffer());
          } else {
            addLog(`图层 ${layer.name || '未命名'} 跳过图像字节：canvas.toBlob 返回空值`);
          }
        } else if (typeof canvas.toDataURL === 'function') {
          const dataUrl = canvas.toDataURL('image/png');
          const base64 = dataUrl.split(',')[1];
          if (base64) {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            layer.imageBytes = bytes;
          } else {
            addLog(`图层 ${layer.name || '未命名'} 跳过图像字节：无效的 data URL`);
          }
        } else {
          addLog(`图层 ${layer.name || '未命名'} 跳过图像字节：canvas API 不可用`);
        }
      } catch (e) {
        addLog(`处理图层 ${layer.name || '未命名'} 图像失败：${e instanceof Error ? e.message : String(e)}`);
      } finally {
        delete layer.canvas;
      }
    }
    if (layer.children) {
      for (const child of layer.children) {
        await processLayer(child);
      }
    }
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setProgress(10);
    addLog(`开始解析 ${file.name}（${(file.size / 1024 / 1024).toFixed(2)} 兆字节）`);

    try {
      const arrayBuffer = await file.arrayBuffer();
      setProgress(30);
      
      // Parse PSD
      const psd = readPsd(arrayBuffer, {
        skipLayerImageData: false,
        skipThumbnail: true,
      });
      setProgress(50);
      addLog('PSD 解析成功，正在处理图像...');

      // Process images (Canvas -> Uint8Array)
      await processLayer(psd);
      const removedCanvasCount = stripCanvasNodes(psd);
      if (removedCanvasCount > 0) {
        addLog(`在发送前已移除 ${removedCanvasCount} 个残留 canvas 对象`);
      }
      setProgress(80);
      addLog('图像处理完成，正在发送到 Figma...');

      // Send to main thread
      parent.postMessage({ pluginMessage: { type: 'parse-psd', psd: psd } }, '*');
      addLog('数据已发送到 Figma 主线程。');

    } catch (err) {
      const msg = 'PSD 文件解析失败：' + (err instanceof Error ? err.message : String(err));
      console.error(err);
      setError(msg);
      addLog(`错误：${msg}`);
    } finally {
      setLoading(false);
      setProgress(100);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.psd')) {
       handleFile(file);
    }
  };

  const downloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'psd-导入日志.log';
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateCodePrompt = () => {
    parent.postMessage({ pluginMessage: { type: 'generate-code-prompt' } }, '*');
  };

  return (
    <div style={{ padding: 16, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', color: '#333', maxWidth: 400, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px 0', color: '#111' }}>PSD 转 Figma</h1>
        <p style={{ margin: 0, color: '#666', fontSize: 12 }}>By “看大医技术团队”</p>
      </header>
      
      {!loading ? (
        <div 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            border: '1px dashed #E0E0E0',
            borderRadius: 12,
            padding: '48px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: '#F9FAFB',
            marginBottom: 24,
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#18A0FB';
            e.currentTarget.style.backgroundColor = '#F0F9FF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E0E0E0';
            e.currentTarget.style.backgroundColor = '#F9FAFB';
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 16V8M12 8L9 11M12 8L15 11" stroke="#18A0FB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 15V16C3 18.2091 4.79086 20 7 20H17C19.2091 20 21 18.2091 21 16V15" stroke="#BDBDBD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p style={{ marginBottom: 12, color: '#333', fontWeight: 500 }}>将 PSD 文件拖放到这里</p>
          <p style={{ marginBottom: 16, color: '#999', fontSize: 12 }}>或</p>
          <input 
            type="file" 
            accept=".psd" 
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="file-upload"
          />
          <label 
            htmlFor="file-upload"
            style={{
              background: '#18A0FB',
              color: 'white',
              padding: '8px 20px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-block',
              fontWeight: 500,
              fontSize: 13,
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}
          >
            选择文件
          </label>
        </div>
      ) : (
        <div style={{ marginBottom: 24, padding: 16, background: '#F9FAFB', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>正在处理...</span>
                <span style={{ fontSize: 13, color: '#666' }}>{progress}%</span>
            </div>
            <div style={{ width: '100%', height: 6, background: '#E0E0E0', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#18A0FB', transition: 'width 0.3s ease-out' }} />
            </div>
            <p style={{ fontSize: 12, color: '#888', marginTop: 12 }}>解析大文件可能需要一点时间，请耐心等待。</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {/* 
        <button 
            onClick={generateCodePrompt}
            style={{
                flex: 1,
                padding: '8px 12px',
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13
            }}
        >
            生成代码提示词
        </button> 
        */}
        <button 
            onClick={downloadLogs}
            style={{
                width: '100%',
                padding: '10px 12px',
                background: 'white',
                border: '1px solid #E0E0E0',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                color: '#555',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F5F5F5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            下载处理日志
        </button>
      </div>

      {error && (
        <div style={{ 
            color: '#D32F2F', 
            background: '#FFEBEE', 
            border: '1px solid #FFCDD2',
            padding: 12, 
            borderRadius: 6, 
            fontSize: 13,
            marginBottom: 20,
            lineHeight: 1.4
        }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#333' }}>运行日志</h3>
        <div style={{ 
            height: 160, 
            overflowY: 'auto', 
            background: '#F5F5F5', 
            padding: 12, 
            borderRadius: 8, 
            fontSize: 11, 
            fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
            color: '#555',
            lineHeight: 1.5,
            border: '1px solid #EEEEEE'
        }}>
            {logs.length === 0 ? <span style={{color: '#999'}}>暂无日志...</span> : logs.map((log, i) => (
                <div key={i} style={{ marginBottom: 4, wordBreak: 'break-all' }}>{log}</div>
            ))}
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
