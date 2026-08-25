# -*- coding: utf-8 -*-
"""ゲーム一式を1枚のHTMLへまとめる（オフライン配布用）。
   使い方: python3 tools/bundle.py"""
import re, base64, os, mimetypes

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

html = open('index.html', encoding='utf-8').read()
body = re.search(r'<body[^>]*>(.*?)</body>', html, re.S).group(1)
order = re.findall(r'<script src="([^"]+)"></script>', body)
body = re.sub(r'<script src="[^"]+"></script>\s*', '', body)
css = open('css/style.css', encoding='utf-8').read()

def data_uri(path):
    mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
    with open(path, 'rb') as f:
        return 'data:%s;base64,%s' % (mime, base64.b64encode(f.read()).decode())

js_parts, embedded = [], {}
for src in order:
    code = open(src, encoding='utf-8').read()

    # motions.js は dir とファイル名を実行時につなげるので、先に展開しておく
    def expand_dir(match):
        d = match.group(1)
        block = match.group(0)
        def sub_file(m2):
            path = d + m2.group(2)
            if not os.path.exists(path):
                return m2.group(0)
            embedded.setdefault(path, data_uri(path))
            return "%s'%s'" % (m2.group(1), embedded[path])
        block = re.sub(r"(:\s*)'([\w.\-]+\.(?:png|jpg|jpeg|svg|webp))'", sub_file, block)
        return block.replace("dir: '" + d + "'", "dir: ''", 1)

    code = re.sub(r"dir: '(assets/[^']*/)'.*?effects: \{.*?\}", expand_dir, code, flags=re.S)

    for m in set(re.findall(r"'(assets/[^']+\.(?:png|jpg|jpeg|svg|webp))'", code)):
        if os.path.exists(m):
            embedded.setdefault(m, data_uri(m))
            code = code.replace("'" + m + "'", "'" + embedded[m] + "'")
    js_parts.append('/* ===== %s ===== */\n%s' % (src, code))

out = ['<meta charset="utf-8">',
       '<title>雷神トントン相撲</title>',
       '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">',
       '<style>\n%s\n</style>' % css,
       body.strip(),
       '<script>\n%s\n</script>' % '\n'.join(js_parts)]

os.makedirs('dist', exist_ok=True)
open('dist/index.html', 'w', encoding='utf-8').write('\n'.join(out))
print('dist/index.html  %.2f MB  画像%d枚 / JS%d本'
      % (os.path.getsize('dist/index.html')/1024/1024, len(embedded), len(order)))
