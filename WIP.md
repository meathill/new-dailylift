# WIP - 空间音源圆盘 Demo

> 目标：验证「用户在圆盘中心，拖动声源到不同位置获得不同声道/音量，方案可保存分享」的功能可行性。
> 技术路线见 STUDY.md 讨论结论：iOS 自建 Expo 本地模块（AVAudioEngine + HRTF），Skia 圆盘，方案存 JSON。

## 任务分解

- [ ] 1. monorepo 初始化 + create-expo-app + pnpm 配置
- [ ] 2. 素材生成脚本 + 产出 6 个循环 WAV（雨/溪流/篝火/风铃/风/鸟鸣）
- [ ] 3. spatial-audio 本地模块（Swift + JS 封装），`expo run:ios` 可出声
- [ ] 4. Skia 圆盘 + 拖动 + 音源列表 UI
- [ ] 5. 音频联动：添加/拖动/音量/播放控制
- [ ] 6. 方案保存 + 分享/导入（含校验）
- [ ] 7. vitest 测试 + format + typecheck + 构建验证
- [ ] 8. 文档收尾：README / DEV_NOTE

## 验收清单

- 点按列表添加声源即播放；拖动时声音实时变化（左右声道差、距离音量差）
- 真机 + 耳机可听出 HRTF 前后定位（用户实测）
- 方案保存 → 分享（剪贴板/文件）→ 导入闭环
- vitest 单测全绿，typecheck/format/构建通过

## 待办备忘

- 后台/锁屏播放、来电中断处理（本期不做，冥想产品上线前必须验证）
- Android 端（需自带 HRTF 引擎，见 STUDY.md 讨论）
- 真实素材替换程序生成音效
