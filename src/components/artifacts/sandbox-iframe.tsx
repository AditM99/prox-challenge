"use client";

import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";

interface SandboxIframeProps {
  code: string;
  type: "react" | "html" | "svg";
  title: string;
}

const SANDBOX_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://unpkg.com/lucide-react@0.400.0/dist/umd/lucide-react.min.js"></script>
  <style>
    body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #root { min-height: 20px; }
    #error { color: #ef4444; padding: 12px; background: #fef2f2; border-radius: 8px; font-family: monospace; font-size: 13px; white-space: pre-wrap; display: none; }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="error"></div>
  <script>
    window.LucideIcons = typeof lucideReact !== 'undefined' ? lucideReact : {};

    function reportHeight() {
      var height = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      window.parent.postMessage({ type: 'resize', height: height + 32 }, '*');
    }

    window.addEventListener('message', function(event) {
      var data = event.data;
      if (data.type === 'render-react') {
        try {
          var rawCode = data.code;

          // Strip imports and exports line by line
          var cleanLines = [];
          var codeLines = rawCode.split(String.fromCharCode(10));
          for (var li = 0; li < codeLines.length; li++) {
            var ln = codeLines[li];
            var tr = ln.trim();
            // Skip import lines
            if (tr.match(/^import\\s/)) continue;
            // Strip export default
            ln = ln.replace(/export\\s+default\\s+/, '');
            // Strip export before declarations
            ln = ln.replace(/export\\s+(?=function|const|class|let|var)/, '');
            cleanLines.push(ln);
          }
          var cleanCode = cleanLines.join(String.fromCharCode(10));
          // Remove trailing bare return
          cleanCode = cleanCode.replace(/^return\\s+<.+$/m, '');

          // Find the last PascalCase component name
          var nameMatch = cleanCode.match(/(?:function|const|class)\\s+([A-Z][A-Za-z0-9]*)/g);
          var lastComponentName = null;
          if (nameMatch) {
            var last = nameMatch[nameMatch.length - 1];
            lastComponentName = last.replace(/^(?:function|const|class)\\s+/, '');
          }

          var transformed = Babel.transform(cleanCode, {
            presets: ['react'],
            filename: 'artifact.tsx'
          }).code;

          // Try module.exports first
          var mod = { exports: {} };
          var fn = new Function('React', 'ReactDOM', 'module', 'exports', 'LucideIcons', transformed);
          fn(React, ReactDOM, mod, mod.exports, window.LucideIcons);

          var Component = mod.exports.default || (typeof mod.exports === 'function' ? mod.exports : null);

          // If no export, find component by name
          if (!Component || typeof Component !== 'function') {
            var tryNames = [lastComponentName, 'App', 'Default', 'Main'].filter(Boolean);
            for (var ni = 0; ni < tryNames.length; ni++) {
              try {
                var findFn = new Function('React', 'ReactDOM', 'LucideIcons',
                  transformed + '; return typeof ' + tryNames[ni] + ' !== "undefined" ? ' + tryNames[ni] + ' : null;'
                );
                var found = findFn(React, ReactDOM, window.LucideIcons);
                if (found && typeof found === 'function') { Component = found; break; }
              } catch(e) {}
            }
          }

          if (Component) {
            var root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(React.createElement(Component));
            setTimeout(reportHeight, 100);
            setTimeout(reportHeight, 500);
            new ResizeObserver(reportHeight).observe(document.body);
          } else {
            throw new Error('No component found in code. Detected names: ' + (nameMatch || []).join(', '));
          }
        } catch (err) {
          document.getElementById('error').style.display = 'block';
          document.getElementById('error').textContent = err.message + '\\n' + (err.stack || '');
          reportHeight();
        }
      } else if (data.type === 'render-html') {
        document.getElementById('root').innerHTML = data.code;
        setTimeout(reportHeight, 100);
      } else if (data.type === 'render-svg') {
        document.getElementById('root').innerHTML = data.code;
        setTimeout(reportHeight, 100);
      }
    });

    window.parent.postMessage({ type: 'ready' }, '*');
  </script>
</body>
</html>`;

export default function SandboxIframe({ code, type, title }: SandboxIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(300);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "resize") {
        setHeight(Math.min(event.data.height, 800));
      }
      if (event.data?.type === "ready") {
        setReady(true);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (ready && iframeRef.current?.contentWindow) {
      const messageType =
        type === "react"
          ? "render-react"
          : type === "html"
            ? "render-html"
            : "render-svg";
      iframeRef.current.contentWindow.postMessage(
        { type: messageType, code },
        "*"
      );
    }
  }, [ready, code, type]);

  return (
    <div className="my-3 rounded-xl border border-white/[0.06] overflow-hidden glass animate-fade-in">
      <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
          <Zap className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium text-white/70">{title}</span>
      </div>
      <div className="bg-white rounded-b-xl">
        <iframe
          ref={iframeRef}
          srcDoc={SANDBOX_HTML}
          sandbox="allow-scripts"
          style={{ width: "100%", height: `${height}px`, border: "none" }}
          title={title}
        />
      </div>
    </div>
  );
}
