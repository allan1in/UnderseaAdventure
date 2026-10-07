# 海底冒险 · Undersea Adventure

基于 **Cocos Creator 3.8.8** 的 2D 海底冒险游戏，支持浏览器与触屏操作。

拖动摇杆移动，自动攻击敌人；收集贝壳、招募海洋伙伴并进化英雄，最终挑战章鱼 Boss。

## 本地运行

1. 使用 Cocos Creator 3.8.8 打开项目。
2. 打开 `assets/scenes/Main.scene`，点击预览。
3. 在画面中按住并拖动，开始游戏。

## HTML 打包

在 PowerShell 中运行：

```powershell
./tools/build-and-pack.ps1
```

输出：`build/undersea-adventure-single.html`，素材与音频内嵌，可直接用浏览器打开。构建需要本机安装 Cocos Creator 3.8.8 与 Node.js。

## Vercel 部署

完成 HTML 打包后，安装 Python/Pillow 与 Vercel CLI，在项目目录运行：

```powershell
python tools/prepare-vercel.py
vercel link --cwd build/vercel --project undersea-adventure
vercel deploy --cwd build/vercel --prod --archive=tgz
```

部署版对内嵌图片做无损压缩，原始素材与完整 HTML 保留。

代码与素材位于 `assets/`，网页加载模板位于 `build-templates/`。详细工程说明与历史记录见 [AGENTS.md](AGENTS.md)。
