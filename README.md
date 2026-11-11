# new-dailylift

主打「精心声音环境」的产品 monorepo（冥想方向）：用户在圆盘中心，把雨声、篝火等声源拖到四周不同位置，获得不同的声道与音量，组合成可保存、可分享的声音方案。

当前阶段：**iOS demo，验证功能可行性**。研究与技术选型记录见 [STUDY.md](./STUDY.md)，进行中的任务见 [WIP.md](./WIP.md)。

## 结构

```
apps/mobile        Expo (SDK 58) iOS app
scripts/           音源素材生成等开发脚本
packages/          未来跨端共享包（暂空）
```

## 快速开始

要求：Node >= 24、pnpm、Xcode + CocoaPods。

```bash
pnpm install

# 生成音源素材（首次必须，产物不入库）
node scripts/generate-sounds.ts

# 构建并运行 iOS（首次会 prebuild + pod install，较慢）
cd apps/mobile
npx expo run:ios
```

- 依赖 `spatial-audio` 本地原生模块与 Skia/Reanimated，**必须用 development build，不支持 Expo Go**。
- 修改原生模块（`apps/mobile/modules/spatial-audio`）后需重新编译；仅改 JS 热更新即可。
- `ios/`、`android/` 目录为 prebuild 产物，不入库，删除后重新 `npx expo prebuild -p ios` 即可再生。

## 听感验收（需真机 + 耳机）

模拟器可验证全部交互，但 **HRTF 前后定位只有在真机戴耳机才能听出来**：

1. 点按底部音源栏把声音加到圆盘 → 立即循环播放
2. 拖到正前方/正后方相同距离对比（这是 HRTF 的核心验证点）
3. 拖近/拖远对比音量衰减
4. 左右对比声道偏向
5. 保存方案 → 分享（剪贴板/文件）→ 另一台设备导入

## 常用命令

```bash
pnpm run test        # vitest（领域层单测）
pnpm run format      # biome 格式化
pnpm run typecheck   # TypeScript
node scripts/generate-sounds.ts   # 重新生成音源素材
```
