# DEV_NOTE

开发过程中积累的、需要长期关注的知识与决策。经常 review。

## 技术选型：空间音频引擎（2026-11）

- **结论**：iOS 用 Expo 本地模块封装系统 `AVAudioEngine` + `AVAudioEnvironmentNode`（HRTFHQ 渲染），不做三方引擎引入。
- **依据**（详见 STUDY.md）：`react-native-audio-api` 目前只有 equalpower 声像、无 HRTF；ViroReact 带整套 AR/VR 框架太重；iOS 系统 API 原生支持逐声源三维定位 + HRTF，封装成本最低。
- **Android 是个坑**：系统 `Spatializer` 没有逐声源定位接口，将来跨端必须自带 HRTF 引擎（如 Steam Audio）。公共接口设计时保持平台无关。

## spatial-audio 本地模块要点

- **本地 Expo Module 必须有 `package.json` + `ios/*.podspec`**，只有 `expo-module.config.json` 不会被 autolinking 发现（node_modules 的库自带 podspec，本地目录不会自动生成）。`create-expo-module --local` 的标准结构就是这三件套。
- 无缝循环用 `scheduleBuffer(_, options: [.loops, .interruptsAtLoop])`，硬件级无接缝；`scheduleFile` + completion 重挂会有缝。
- `player.stop()` 会清掉已调度的 buffer，再次 `play()` 前必须重新 `scheduleBuffer`（模块内 `playSource` 已处理）。
- **空音频图调用 `engine.prepare()` 会抛异常**（`inputNode != nullptr || outputNode != nullptr`）：attach 了 environment 但没 connect 时就会崩。prepare 时先把 environment 接到 `mainMixerNode` 构成有效输出链。
- iOS 26/27 SDK 实测：`AVAudioEnvironmentNode.listener`、`player.distanceParams` 不可用（成员不存在）；`Description(...)` DSL 也不存在。距离衰减用系统默认参数（参考 1m / rolloff 1）已能听出远近。`AVAudio3DPoint` 字段与 `player.volume` 是 **Float**，从 JS 收来的 Double 要手动转。
- Apple 听者坐标系：原点为听者，**前方是 -z**。圆盘 UI 约定「屏幕上方 = 前方」即 dy 为负映射 z 为负，两侧一致。
- 单声道素材 + `sourceMode = .spatializeIfMono` 才会走 HRTF；立体声素材会被 passthrough。
- 所有引擎操作收敛到一个串行 DispatchQueue，避免与渲染线程竞争。
- 素材用 `Asset.fromModule(require('./x.wav')).localUri` 传给原生（bundled asset 直接有本地路径）。
- 音频引擎初始化**不要放在 app 启动时**（页面 useEffect），推迟到首次点按音源时再 prepare，避免启动阶段崩溃且 UI 始终可用。

## Expo + pnpm monorepo

- `.npmrc` 必须设 `node-linker=hoisted`，否则 Metro/CocoaPods 解析 pnpm 符号链接布局会出问题。
- Expo CLI 默认扫描 `<app>/modules/` 目录收录本地 Expo Module，无需改 config。
- `npx expo install` 会把 pnpm-workspace.yaml 里加 `minimumReleaseAgeExclude` 条目，属于正常行为。

## 工具链

- Biome 2.6：`files.ignores` 已改名 `files.includes`（否定用 `!` 前缀）；STUDY.md 已排除避免重排表格。
- vitest 只测 `src/domain` 纯逻辑；RN 组件与原生行为靠真机人工验收。
- 音源素材不入库（体积大、可再生），clone 后先跑 `node scripts/generate-sounds.ts`。

## 待验证/风险

- HRTF 前后定位听感待真机验收（模拟器无法验证）。
- 拖动时声音实时变化、点按添加即播放的完整链路待人工上手验证（模拟器窗口无法自动化点击，需用户操作）。
- 后台/锁屏播放、来电中断、耳机拔插尚未处理（冥想产品上线前必须做）。
- Reanimated 4 + Skia 2.14 的 shared value 直绑在 SDK 58 下表现待拖动验证。
