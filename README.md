# 中药学 · 背诵卡片与练习

一个**完全离线**的中药学学习工具：把《中药学》教材的每味药做成卡片，支持笔记、收藏、编辑、批量隐藏，并提供**默写**与**选择题**两种练习。

内容是**据中国中医药出版社《中药学》第六版（钟赣生、杨柏灿主编）整理的药物提要**，共 21 章 / 47 节 / 443 味主药 + 125 味附药 + 77 条鉴别用药。

- 🌐 在线使用（iPhone / Android 浏览器）：**https://kkjj405.github.io/zhongyaoxue/**
- 📱 安卓安装页（扫码）：**https://kkjj405.github.io/zhongyaoxue/install.html**
- 版本 **1.0.0**

---

## 安装

### Android（APK，离线可用）
1. 手机打开 https://kkjj405.github.io/zhongyaoxue/install.html
2. 点「下载安装包」→ 允许「未知来源」→ 桌面出现「中药学」
3. 之后在 App 内「我的 → 检查更新」可热更新网页资源，**不用重装**

包名 `com.kkjj405.zyx`，最低 Android 5.0，仅申请 `INTERNET`（只用于检查更新）。
SHA-256 `fffd4e7d8699d18ee308d3ebf257ef0b330f16773f9abfbf949f3209ab012951`

### iPhone（PWA）
Safari 打开 https://kkjj405.github.io/zhongyaoxue/ → 分享 → **添加到主屏幕** → 全屏 App，离线可用。

---

## 功能

| 模块 | 说明 |
|---|---|
| 背诵卡片 | 目录（章→节→药）浏览；卡片含药性/功效/应用/用法用量/使用注意；上一个·下一个切换，隐藏的药自动跳过；长卡片自动分页阅读 |
| 笔记 | 卡片内就地展开编辑（非弹窗），只存本机 |
| 收藏 | 多分组，可新建/重命名/删除分组，条目可移组/移除 |
| 编辑 | 就地修改各字段，随时「恢复原文」 |
| 隐藏 | 单味或目录「管理」批量勾选隐藏；目录里显示**删除线**，可批量取消 |
| 默写练习 | 选范围（可整章/整节/逐味，可含附药）+ 选内容（药性/功效/应用），看药名默写后对照答案；中途退出自动保存 |
| 选择题练习 | 选项数量按该药内容条数**按比例**生成，干扰项随机（同章优先），每次组合不同；中途退出自动保存 |
| 搜索 | 按药名搜索，直达卡片 |
| 药物鉴别 | 77 条鉴别按章分组，支持搜索、跳转卡片 |
| 打赏 | 文案 + 微信收款码 |
| 检查更新 | APK 热更新（原子替换资源目录）；PWA 用 Service Worker |
| 公告栏 | 主页内嵌（非弹窗） |

## 数据结构

```
data/drugs.js        # window.ZYX_DATA：chapters / drugs / differentials
js/{version,core,ui,cards,practice,misc,boot}.js
index.html  app.css  manifest.webmanifest  sw.js  version.json  files.json
```

- 数据由 md 解析生成，**附药保持整段原文**（原文各分项无稳定分隔，不做拆分），因此选择题只出 443 味主药，默写可选附药
- 练习不记成绩，只保存进度；所有用户数据存本机 localStorage，可导出/导入备份

## 技术

纯前端（无框架、无构建）+ Android WebView 壳。安卓包不用 Gradle（本机 maven.google.com 不可达），直接用 Android build-tools 的 aapt2 → javac → d8 → zipalign → apksigner 手工组装。

## 免责声明

本程序内容完全基于中国中医药出版社十五五教材《中药学》。本程序仅供学习使用，不提供临床用药指导。
