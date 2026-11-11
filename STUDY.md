# 探索 Expo 多音轨空间混音

> expo 有办法操作多音轨合成么？调整立体声的相对位置。
> 我想开发一个 app，核心是用户的位置，可以把不同的发生器拖到各个位置，形成一套自己的声音方案，用来作为冥想之类的环境。

<details><summary>4 previous messages</summary>

> 我先查一下 Expo 当前的音频能力，重点看多音轨同时播放、立体声定位，以及需要原生模块的部分。
>
> <details><summary>Explored 2 searches, searched the web</summary>
>
> <details><summary>Explored a search</summary>
>
> - Searched for `expo|spatial audio|冥想|多音轨|音频` in `MEMORY.md`
>
> </details>
>
> Searched the web for `site.docs.expo.dev audio pan multiple players stereo audio`
>
> <details><summary>Explored a search</summary>
>
> - Searched for `expo|spatial audio|冥想|多音轨|音频` in `MEMORY.md`
>
> </details>
>
> Searched the web for `site.docs.swmansion.com/react-native-audio-api StereoPannerNode PannerNode Expo installation background`
>
> Searched the web for `https://docs.swmansion.com/react-native-audio-api/docs/effects/panner-node/`
>
> </details>
>
> 查到可行的路线了：Expo 官方也推荐用 `react-native-audio-api` 做实时音频处理，它支持左右声像控制。你这个交互可以把左右位置映射到声像、距离映射到音量；如果希望听出声源在身前还是身后，就需要进一步做双耳空间化，单靠左右声道不够。
>
> <details><summary>Searched the web</summary>
>
> Searched the web for `https://docs.swmansion.com/react-native-audio-api/docs/next/effects/panner-node/`
>
> </details>
</details>

**可以，Expo 能做你这个 App。建议采用 `Expo + react-native-audio-api`，让每个声源独立播放，再实时混音。** Expo 官方也推荐这个库处理声音合成、实时效果和音频调度。[Expo 文档](https://docs.expo.dev/versions/latest/sdk/audio/)

我先按你说的“位置”是**画布中的虚拟位置**来理解：用户在中心，把雨声、溪流、篝火、风铃拖到周围，组成自己的声音环境，不需要 GPS。

可以这样把位置转换成听觉效果：

| 用户操作 | 声音变化 | 实现方式 |
|---|---|---|
| 拖到左边、右边 | 声音偏向对应耳朵 | 声像 `pan` |
| 拉近、推远 | 声音变大、变小 | 距离控制音量 |
| 推到很远 | 声音更柔和、模糊 | 低通滤波，可叠加混响 |
| 放入多个声源 | 同时听到整套环境 | 多条声音处理链汇入总输出 |

其中，`StereoPannerNode` 已支持从 `-1`（左）到 `1`（右）的连续调整，正好对应拖动交互。[声像 API](https://docs.swmansion.com/react-native-audio-api/docs/effects/stereo-panner-node/)

每个声源可以走这样一条处理链：

```text
循环素材 / 声音发生器 → 距离音量 → 滤波 → 左右声像 → 总混音
```

这意味着**不需要每拖动一次就重新合成音频文件**。声音持续播放，只更新参数；保存方案时，保存素材、坐标、音量等配置即可。

有两个技术边界需要提前确定：

- **需要 Expo development build。** 这个库包含原生代码，不能直接在 Expo Go 里运行，但可以继续使用 Expo 开发流程。[接入说明](https://docs.swmansion.com/react-native-audio-api/docs/fundamentals/getting-started/)
- **左右定位和完整的空间定位有区别。** 左右声像加距离衰减，足以先做出可玩的版本；如果希望戴耳机能明显听出“左前方、右后方、头顶”，就要进一步评估 HRTF 双耳空间音频。该库当前 Next 文档中的 `PannerNode` 也仅支持 `equalpower`，不能直接视为完整 HRTF 支持。[空间定位说明](https://docs.swmansion.com/react-native-audio-api/docs/next/effects/panner-node/)

**第一版我建议先验证“左右＋远近”的体验**：中心固定用户、周围放 4～6 个可拖动声源，支持独立音量、保存方案、定时渐弱和锁屏播放。重点验证无缝循环、拖动时声音平滑、多声源叠加的音量控制，以及长时间后台播放；这些会直接决定它是否适合冥想。

> 除了左右，有前后么？还是说前后只能按比例缩放？

<details><summary>2 previous messages</summary>

> 我再核对一下前后定位的实现，重点确认耳机里的真实方向感，以及这个 React Native 音频库目前支持到哪一步。
>
> <details><summary>Searched the web</summary>
>
> Searched the web for `https://docs.swmansion.com/react-native-audio-api/docs/next/effects/panner-node/`
>
> Searched the web for `site.valvesoftware.github.io steam audio HRTF binaural front back head tracking ...`
>
> </details>
</details>

**有前后，而且普通双声道耳机也能实现。音量缩放主要表达远近，前后需要额外的空间音频处理。**

可以分成三个独立维度：

| 维度 | 主要处理方式 |
|---|---|
| 左右 | 两耳的音量差、到达时间差 |
| 远近 | 音量衰减、高频衰减、直达声与混响比例 |
| 前后、上下 | HRTF：模拟头部和耳廓对不同方向声音的过滤 |

例如，**正前方两米和正后方两米**，距离相同、左右也都居中。仅调整左右声道比例和总音量，无法有效区分它们。HRTF 会为两种方向使用不同的双耳滤波，让人获得方向感。[Steam Audio 原理说明](https://github.com/ValveSoftware/steam-audio/blob/master/core/doc/guide.rst#hrtf)

回到 Expo：**Expo 可以继续用，但我上一条推荐的库，内置能力还不足以直接完成这部分。** `react-native-audio-api` 的 Next 文档目前只支持 `equalpower` 定位，没有内置 HRTF；有三维坐标接口，也不代表能听出完整的前后方向。[当前支持范围](https://docs.swmansion.com/react-native-audio-api/docs/next/effects/panner-node/)

如果“把声音摆在自己四周”就是产品核心，我建议从一开始就验证 **HRTF 音频引擎＋Expo 界面**。画布保存声源的方向和距离，由引擎生成双耳声音。前后辨识效果要戴耳机实际试听验证，不能只看 API 是否接受三维坐标。

> HRTF 是系统 API？可以通过 expo 调用？

<details><summary>2 previous messages</summary>

> 我查一下 iOS、Android 的系统接口，以及 Expo 接入原生音频引擎的方式，确认哪些能直接调用、哪些需要封装。
>
> <details><summary>Searched the web</summary>
>
> Searched the web for `site.developer.apple.com AVAudioEnvironmentNode HRTF AVAudio3DMixingRenderingAlgorithm ...`
>
> Searched the web for `Spatializer Android developer spatial audio API objects ...`
>
> </details>
</details>

**可以通过 Expo 调用，但需要原生模块封装。HRTF 本身是一套描述声音如何经过头部、耳廓到达双耳的数据和处理方法，系统或第三方引擎可以实现它。**

两个平台的情况不同：

| 平台 | 系统能力 | 对你的 App 意味着什么 |
|---|---|---|
| **iOS** | `AVAudioEngine` 的 `AVAudioEnvironmentNode` 支持三维声源，提供 `.HRTF`、`.HRTFHQ` 渲染算法 | 可以用 Swift 封装系统能力，再交给 Expo 调用 |
| **Android** | `Spatializer` 主要用于系统对兼容音频内容进行空间化，受设备、输出和设置影响 | 你的需求是逐个拖动声源，通常更适合接入能自行控制声源位置的 HRTF 引擎 |

来源：[Apple 渲染算法](https://developer.apple.com/documentation/avfaudio/avaudio3dmixingrenderingalgorithm)、[Android 空间音频](https://developer.android.com/media/grow/spatial-audio)。

Expo 接入后，调用关系可以很简单：

```text
Expo 界面：拖动声源
        ↓ 更新坐标
自定义 Expo 原生模块
        ↓
原生音频引擎：HRTF 处理、多声源混音、播放
```

你在 TypeScript 里可以设计这样的接口，下面是**需要我们封装的接口示意**：

```ts
SpatialAudio.setSourcePosition('溪流', {
  x: -2, // 左侧
  y: 0,  // 高度
  z: -3, // 前方，具体方向约定由模块定义
});
```

JS 负责传位置、音量、播放指令，持续的音频处理留在原生层。Expo 官方支持用 **Local Expo Module** 编写 Swift/Kotlin 模块；开发时使用 **development build**，自定义模块无法在 Expo Go 中运行。[Expo 原生模块说明](https://docs.expo.dev/workflow/customizing/)

**如果先做 iOS，可以直接验证 Apple 系统引擎；如果首版就要同时支持 iOS、Android，我更倾向评估统一的跨平台引擎。** 例如 Steam Audio 提供两端支持和 C API，接入工作包括 Expo 封装、音频解码、播放和后台管理。[Steam Audio](https://valvesoftware.github.io/steam-audio/)

> 有没有现行封装好的库？

<details><summary>6 previous messages</summary>

> 我查一下现成的 React Native／Expo 封装，重点区分真正支持 HRTF 前后定位的库，以及只提供左右声像的库。
>
> <details><summary>Called 4 tools, searched the web</summary>
>
> Searched the web for `React Native HRTF spatial audio library Expo AVAudioEnvironmentNode ...`
>
> Searched the web for `"react-native" "HRTF" -site:reddit.com -site:arxiv.org -site:docs.swmansion.com ...`
>
> Searched the web for `"react-native" "spatial-audio" library github ...`
>
> MCP tool call
>
> codex_apps.github.fetch_file
>
> ```json
> {
>   "repository_full_name": "rit3zh/expo-ios-sonic-player",
>   "path": "package.json"
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "content": "{\n  \"name\": \"expo-ios-sonic-player\",\n  \"version\": \"0.1.1\",\n  \"description\": \"🎧 | A complete, high-performance audio library for iOS\",\n  \"main\": \"build/index.js\",\n  \"types\": \"build/index.d.ts\",\n  \"scripts\": {\n    \"build\": \"expo-module build\",\n    \"clean\": \"expo-module clean\",\n    \"lint\": \"expo-module lint\",\n    \"test\": \"expo-module test\",\n    \"prepare\": \"expo-module prepare\",\n    \"prepublishOnly\": \"expo-module prepublishOnly\",\n    \"expo-module\": \"expo-module\",\n    \"open:ios\": \"xed example/ios\",\n    \"open:android\": \"open -a \\\"Android Studio\\\" example/android\"\n  },\n  \"keywords\": [\n    \"react-native\",\n    \"expo\",\n    \"expo-sonic-ios-player\",\n    \"ExpoNativeiOSSonicPlayer\"\n  ],\n  \"repository\": \"https://github.com/rit3zh/expo-ios-sonic-player\",\n  \"bugs\": {\n    \"url\": \"https://github.com/rit3zh/expo-ios-sonic-player/issues\"\n  },\n  \"author\": \"Ritesh. <119659853+rit3zh@users.noreply.github.com> (https://github.com/rit3zh)\",\n  \"license\": \"MIT\",\n  \"homepage\": \"https://sonic-player.xyz/\",\n  \"dependencies\": {},\n  \"devDependencies\": {\n    \"@types/react\": \"~19.0.0\",\n    \"expo-module-scripts\": \"^4.1.9\",\n    \"expo\": \"~53.0.0\",\n    \"react-native\": \"0.79.1\"\n  },\n  \"peerDependencies\": {\n    \"expo\": \"*\",\n    \"react\": \"*\",\n    \"react-native\": \"*\"\n  }\n}\n",
>   "encoding": "utf-8",
>   "sha": "7eea3d6476da57eca95aa755253b451be01976ef",
>   "display_url": "https://github.com/rit3zh/expo-ios-sonic-player/blob/main/package.json",
>   "display_title": "package.json"
> }
> ```
>
> MCP tool call
>
> codex_apps.github.search_repositories
>
> ```json
> {
>   "query": "react-native HRTF",
>   "per_page": 10
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "archive_filter_applied": null,
>   "repositories": []
> }
> ```
>
> MCP tool call
>
> codex_apps.github.fetch
>
> ```json
> {
>   "url": "https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/main?recursive=1"
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "content": "{\"sha\":\"b3877a4505907fe138ee1e5eb7bbe69999877ec2\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/b3877a4505907fe138ee1e5eb7bbe69999877ec2\",\"tree\":[{\"path\":\".eslintrc.js\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"83c8ae08e8a8fdef59d55678f937166df25e0bfa\",\"size\":128,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/83c8ae08e8a8fdef59d55678f937166df25e0bfa\"},{\"path\":\".gitignore\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"e64b91c971a1de566da4f90a23f405dd877a2bcd\",\"size\":573,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/e64b91c971a1de566da4f90a23f405dd877a2bcd\"},{\"path\":\".npmignore\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"c80a15fb20176b862978e14e03aeada59d73cd99\",\"size\":229,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/c80a15fb20176b862978e14e03aeada59d73cd99\"},{\"path\":\"CONTRIBUTING.MD\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"4e4868ad5f98f8c46aa8ddbe9a53d7b8fd905f15\",\"size\":1920,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/4e4868ad5f98f8c46aa8ddbe9a53d7b8fd905f15\"},{\"path\":\"README.md\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"4c73bf017b3da6eebe8972212e21a4ee3b27b1ce\",\"size\":3504,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/4c73bf017b3da6eebe8972212e21a4ee3b27b1ce\"},{\"path\":\"docs\",\"mode\":\"160000\",\"type\":\"commit\",\"sha\":\"c728e32f7cd766e2e14c20ffc0da406d8746feb3\"},{\"path\":\"example\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"5c8427b3e7255470c0ccddff0b75b0efcf83a6ca\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/5c8427b3e7255470c0ccddff0b75b0efcf83a6ca\"},{\"path\":\"example/.gitignore\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"954fc6625f3659cda586d99d146802f86875b450\",\"size\":398,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/954fc6625f3659cda586d99d146802f86875b450\"},{\"path\":\"example/App.tsx\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"d3c5b8582c29a3464022722d3a02a5f78b754266\",\"size\":45370,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/d3c5b8582c29a3464022722d3a02a5f78b754266\"},{\"path\":\"example/app.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"7080991ae8eed386049e9967b855a8ee56c574e6\",\"size\":804,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/7080991ae8eed386049e9967b855a8ee56c574e6\"},{\"path\":\"example/assets\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"666ab2ae9bd742da6f95efffaa581f29969ca651\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/666ab2ae9bd742da6f95efffaa581f29969ca651\"},{\"path\":\"example/assets/adaptive-icon.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"03d6f6b6c6727954aec1d8206222769afd178d8d\",\"size\":17547,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/03d6f6b6c6727954aec1d8206222769afd178d8d\"},{\"path\":\"example/assets/favicon.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"e75f697b1801871ad8cd9309b05e8ffe8c6b6d01\",\"size\":1466,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/e75f697b1801871ad8cd9309b05e8ffe8c6b6d01\"},{\"path\":\"example/assets/icon.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"a0b1526fc7b78680fd8d733dbc6113e1af695487\",\"size\":22380,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/a0b1526fc7b78680fd8d733dbc6113e1af695487\"},{\"path\":\"example/assets/splash-icon.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"03d6f6b6c6727954aec1d8206222769afd178d8d\",\"size\":17547,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/03d6f6b6c6727954aec1d8206222769afd178d8d\"},{\"path\":\"example/audio\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"2971ae186ea1bbb51a658598ab4f954645d6ad40\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/2971ae186ea1bbb51a658598ab4f954645d6ad40\"},{\"path\":\"example/audio/liam-payne.mp3\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"31bfbe71d85df01abb5d13b42c4ac311e662923f\",\"size\":5325982,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/31bfbe71d85df01abb5d13b42c4ac311e662923f\"},{\"path\":\"example/audio/love.mp3\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"2bd56507bf1417c759b5a134807dda592aacb334\",\"size\":3401165,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/2bd56507bf1417c759b5a134807dda592aacb334\"},{\"path\":\"example/audio/seasonoflove.flac\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"159f01c4e792cec2f55f6566a84ea8855c8822aa\",\"size\":40023021,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/159f01c4e792cec2f55f6566a84ea8855c8822aa\"},{\"path\":\"example/babel.config.js\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"9d89e131194f49640e1ea7511e8693d2e98e6343\",\"size\":108,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/9d89e131194f49640e1ea7511e8693d2e98e6343\"},{\"path\":\"example/glow-components\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"38c2053ee8211c7674512dfae3d3b59b37f9f4f4\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/38c2053ee8211c7674512dfae3d3b59b37f9f4f4\"},{\"path\":\"example/glow-components/SeekBar\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"5107d071785089cda441c68ca917dc0fd7eda1f4\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/5107d071785089cda441c68ca917dc0fd7eda1f4\"},{\"path\":\"example/glow-components/SeekBar/SeekBar.tsx\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"b282cac96c8bef52176b20d11df3fe489d1a0e88\",\"size\":4681,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/b282cac96c8bef52176b20d11df3fe489d1a0e88\"},{\"path\":\"example/glow-components/SeekBar/SeekBar.types.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"c16fa939a374a0949de3d6127da422316a570010\",\"size\":250,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/c16fa939a374a0949de3d6127da422316a570010\"},{\"path\":\"example/index.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"d598f5fb042dec7e4b7fc088105fa70b0b9d4185\",\"size\":447,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/d598f5fb042dec7e4b7fc088105fa70b0b9d4185\"},{\"path\":\"example/ios\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"e541b3e8115381d8be2de0ff0dca2968557eca3a\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/e541b3e8115381d8be2de0ff0dca2968557eca3a\"},{\"path\":\"example/ios/.gitignore\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"8beb344303ffdb5a918513f1962d5061bd764589\",\"size\":321,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/8beb344303ffdb5a918513f1962d5061bd764589\"},{\"path\":\"example/ios/.spm.pods\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"de5ac76e3b5fffadb9480511199d012f77b3cb18\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/de5ac76e3b5fffadb9480511199d012f77b3cb18\"},{\"path\":\"example/ios/.spm.pods/packages\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"e0068f32ccaae53fada85aabdb8dfd2919127886\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/e0068f32ccaae53fada85aabdb8dfd2919127886\"},{\"path\":\"example/ios/.spm.pods/packages/.umbrella\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"733a778577d0878b6cbf7562f17a0196f777a818\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/733a778577d0878b6cbf7562f17a0196f777a818\"},{\"path\":\"example/ios/.spm.pods/packages/.umbrella/.build\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"97e6218d268668851110328d6ec1eec80d343e86\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/97e6218d268668851110328d6ec1eec80d343e86\"},{\"path\":\"example/ios/.spm.pods/packages/.umbrella/.build/workspace-state.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"7c0cb06983a96afc60d69f6a48955b7669c8cba3\",\"size\":125,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/7c0cb06983a96afc60d69f6a48955b7669c8cba3\"},{\"path\":\"example/ios/.spm.pods/packages/.umbrella/Package.swift\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"da23206f916a2338831efda9ac3d809a4f41206e\",\"size\":128,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/da23206f916a2338831efda9ac3d809a4f41206e\"},{\"path\":\"example/ios/.xcode.env\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"3d5782c71568d32eec2fe71b034efcde053305f9\",\"size\":482,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/3d5782c71568d32eec2fe71b034efcde053305f9\"},{\"path\":\"example/ios/Podfile\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"9399cfd56d1b7274dab762fe18c320c684782151\",\"size\":2483,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/9399cfd56d1b7274dab762fe18c320c684782151\"},{\"path\":\"example/ios/Podfile.lock\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"b3c023418a9e0e3b46a707c305814aef64a17dd1\",\"size\":67952,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/b3c023418a9e0e3b46a707c305814aef64a17dd1\"},{\"path\":\"example/ios/Podfile.properties.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"417e2e5ab465d7e8a4fb70944338c4b62b4cfaee\",\"size\":105,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/417e2e5ab465d7e8a4fb70944338c4b62b4cfaee\"},{\"path\":\"example/ios/exposoniciosplayerexample.xcodeproj\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"ff6f0a7a985828fc2da777e079280f0543fe5bae\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/ff6f0a7a985828fc2da777e079280f0543fe5bae\"},{\"path\":\"example/ios/exposoniciosplayerexample.xcodeproj/project.pbxproj\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"668bae9d41e40aa64fcbfbab0a571b3cd6ea3e1b\",\"size\":24600,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/668bae9d41e40aa64fcbfbab0a571b3cd6ea3e1b\"},{\"path\":\"example/ios/exposoniciosplayerexample.xcodeproj/xcshareddata\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"cfba7038cadd8279823ad04e888a15c11e61e51a\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/cfba7038cadd8279823ad04e888a15c11e61e51a\"},{\"path\":\"example/ios/exposoniciosplayerexample.xcodeproj/xcshareddata/xcschemes\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"62ee525e94620c933c01835f3a363b4080d51e7b\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/62ee525e94620c933c01835f3a363b4080d51e7b\"},{\"path\":\"example/ios/exposoniciosplayerexample.xcodeproj/xcshareddata/xcschemes/exposoniciosplayerexample.xcscheme\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"6dbeb35ab8d163fa2e4fe1300094f843d0cea393\",\"size\":3486,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/6dbeb35ab8d163fa2e4fe1300094f843d0cea393\"},{\"path\":\"example/ios/exposoniciosplayerexample.xcworkspace\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"a7f87667d08e7b936321be133503ac0cb41a7545\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/a7f87667d08e7b936321be133503ac0cb41a7545\"},{\"path\":\"example/ios/exposoniciosplayerexample.xcworkspace/contents.xcworkspacedata\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"94efca18507246fd8cbe8e502e41c5242bf48c5b\",\"size\":243,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/94efca18507246fd8cbe8e502e41c5242bf48c5b\"},{\"path\":\"example/ios/exposoniciosplayerexample\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"7af445683baf04696fa04c8fa2fb29bb08e5867f\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/7af445683baf04696fa04c8fa2fb29bb08e5867f\"},{\"path\":\"example/ios/exposoniciosplayerexample/AppDelegate.swift\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"a7887e1e5b1269ad3b228d46c7531297dca8e9c8\",\"size\":2275,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/a7887e1e5b1269ad3b228d46c7531297dca8e9c8\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"8f04a0409bee6e88cd3edbc3a15d2d07038bde69\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/8f04a0409bee6e88cd3edbc3a15d2d07038bde69\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/AppIcon.appiconset\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"36e5c5de5fc0e61a1e69873cd71335af71ef06a9\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/36e5c5de5fc0e61a1e69873cd71335af71ef06a9\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"2732229faf0f150332a6f03c098d0bae8dc69ffd\",\"size\":59468,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/2732229faf0f150332a6f03c098d0bae8dc69ffd\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/AppIcon.appiconset/Contents.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"90d8d4c2a90c7b5833351423014112b0bc6ea9b2\",\"size\":215,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/90d8d4c2a90c7b5833351423014112b0bc6ea9b2\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/Contents.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"ed285c2e5f162b08ef745fdb14857f495bf6e685\",\"size\":62,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/ed285c2e5f162b08ef745fdb14857f495bf6e685\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/SplashScreenBackground.colorset\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"c7be0d75f7d6c6334c6c5e2f4f5fd64dec586b0b\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/c7be0d75f7d6c6334c6c5e2f4f5fd64dec586b0b\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/SplashScreenBackground.colorset/Contents.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"15f02abee44ab32bd4ad40ef17e9b592d1ac0b56\",\"size\":348,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/15f02abee44ab32bd4ad40ef17e9b592d1ac0b56\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/SplashScreenLogo.imageset\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"c5630f60ea955f389887b854a674e7346fdfffe4\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/c5630f60ea955f389887b854a674e7346fdfffe4\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/SplashScreenLogo.imageset/Contents.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"f65c008be7069979e75143ab35e864720b9c7b2c\",\"size\":358,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/f65c008be7069979e75143ab35e864720b9c7b2c\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/SplashScreenLogo.imageset/image.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"b9ff0fcbfed1963ef9ae249b69bdb199937b85b8\",\"size\":60870,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/b9ff0fcbfed1963ef9ae249b69bdb199937b85b8\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/SplashScreenLogo.imageset/image@2x.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"b9ff0fcbfed1963ef9ae249b69bdb199937b85b8\",\"size\":60870,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/b9ff0fcbfed1963ef9ae249b69bdb199937b85b8\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/SplashScreenLogo.imageset/image@3x.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"b9ff0fcbfed1963ef9ae249b69bdb199937b85b8\",\"size\":60870,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/b9ff0fcbfed1963ef9ae249b69bdb199937b85b8\"},{\"path\":\"example/ios/exposoniciosplayerexample/Info.plist\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"d04da66ba4c83ef5e081935f3bd5f7646308a33b\",\"size\":2292,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/d04da66ba4c83ef5e081935f3bd5f7646308a33b\"},{\"path\":\"example/ios/exposoniciosplayerexample/PrivacyInfo.xcprivacy\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"5bb83c5d4327f8f8a4f12033703a4d0957cc822f\",\"size\":1283,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/5bb83c5d4327f8f8a4f12033703a4d0957cc822f\"},{\"path\":\"example/ios/exposoniciosplayerexample/SplashScreen.storyboard\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"8a6fcd47bcafdf501e14ce2fa7bf7144f3eed005\",\"size\":3562,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/8a6fcd47bcafdf501e14ce2fa7bf7144f3eed005\"},{\"path\":\"example/ios/exposoniciosplayerexample/Supporting\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"f90507911babd075c2ab434d521d8cf9b631dcf4\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/f90507911babd075c2ab434d521d8cf9b631dcf4\"},{\"path\":\"example/ios/exposoniciosplayerexample/Supporting/Expo.plist\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"750be020cfc2d242e01b44e9d7054495b8357937\",\"size\":364,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/750be020cfc2d242e01b44e9d7054495b8357937\"},{\"path\":\"example/ios/exposoniciosplayerexample/exposoniciosplayerexample-Bridging-Header.h\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"8361941afc2fb739367ffa08707b9b5932f17bfe\",\"size\":102,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/8361941afc2fb739367ffa08707b9b5932f17bfe\"},{\"path\":\"example/ios/exposoniciosplayerexample/exposoniciosplayerexample.entitlements\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"f683276c573e8f6c0631b22043ce44e3073b81f0\",\"size\":182,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/f683276c573e8f6c0631b22043ce44e3073b81f0\"},{\"path\":\"example/metro.config.js\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"668d5dd63d9a4ca9532223ea50a13c6c7d0f062f\",\"size\":1116,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/668d5dd63d9a4ca9532223ea50a13c6c7d0f062f\"},{\"path\":\"example/package-lock.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"551a496d56fb81b24f50bea8e01e283bb80d6bf9\",\"size\":316251,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/551a496d56fb81b24f50bea8e01e283bb80d6bf9\"},{\"path\":\"example/package.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"8ec6dc1051807597d822235b7fd47b162a749c56\",\"size\":827,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/8ec6dc1051807597d822235b7fd47b162a749c56\"},{\"path\":\"example/store\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"ec362f7fa0a8523212e2a410b5bf03dcba328eb3\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/ec362f7fa0a8523212e2a410b5bf03dcba328eb3\"},{\"path\":\"example/store/index.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"66d418dfe1269a271c1d27f40d80a4ac52129fec\",\"size\":13768,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/66d418dfe1269a271c1d27f40d80a4ac52129fec\"},{\"path\":\"example/store/types.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"6054a58dade9abc111f0ad02beed8a03dae83545\",\"size\":3823,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/6054a58dade9abc111f0ad02beed8a03dae83545\"},{\"path\":\"example/tsconfig.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"9bc58f3885eca78a47d5498aa558a44a952728d0\",\"size\":202,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/9bc58f3885eca78a47d5498aa558a44a952728d0\"},{\"path\":\"example/webpack.config.js\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"b7d730ea4eb32d4187107b932a3de5c72910f16c\",\"size\":460,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/b7d730ea4eb32d4187107b932a3de5c72910f16c\"},{\"path\":\"expo-module.config.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"e6f3e82159c7becc2fe5d8c95338b8bf3c6bdc52\",\"size\":102,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/e6f3e82159c7becc2fe5d8c95338b8bf3c6bdc52\"},{\"path\":\"img\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"03087ae295b87bf752a742c37765c62eb6de6eda\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/03087ae295b87bf752a742c37765c62eb6de6eda\"},{\"path\":\"img/banner-soft.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"4013d95ded7c4a30ee1113aefe4807fc15950fbf\",\"size\":10994,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/4013d95ded7c4a30ee1113aefe4807fc15950fbf\"},{\"path\":\"ios\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"63fa5f0ed944802fcbae12e0964333b836c8307e\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/63fa5f0ed944802fcbae12e0964333b836c8307e\"},{\"path\":\"ios/AudioPlayer.swift\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"d84f1a2a639d5d9440fffc21f11d6a2e94fd2160\",\"size\":49529,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/d84f1a2a639d5d9440fffc21f11d6a2e94fd2160\"},{\"path\":\"ios/ExpoNativeiOSSonicPlayer.podspec\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"d39b9f23685db7fecb073796e6b26715c9c20d31\",\"size\":798,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/d39b9f23685db7fecb073796e6b26715c9c20d31\"},{\"path\":\"ios/ExpoNativeiOSSonicPlayerModule.swift\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"938a29e36adfc1be3ec4628bae242d15e266796d\",\"size\":12987,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/938a29e36adfc1be3ec4628bae242d15e266796d\"},{\"path\":\"package-lock.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"ab6ca609a3cca927d9bd67b87763e18f04aa284f\",\"size\":598380,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/ab6ca609a3cca927d9bd67b87763e18f04aa284f\"},{\"path\":\"package.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"7eea3d6476da57eca95aa755253b451be01976ef\",\"size\":1254,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/7eea3d6476da57eca95aa755253b451be01976ef\"},{\"path\":\"pnpm-lock.yaml\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"f73155fa920bf6f49e5a16636292e27299d350da\",\"size\":344380,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/f73155fa920bf6f49e5a16636292e27299d350da\"},{\"path\":\"src\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"492a3e184afb745c3f698466e93e517480c6b970\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/492a3e184afb745c3f698466e93e517480c6b970\"},{\"path\":\"src/RNExpoSonicPlayer.types.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"628bb72069df05f5736556e897506b0a783b3745\",\"size\":5322,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/628bb72069df05f5736556e897506b0a783b3745\"},{\"path\":\"src/RNSonicModule.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"d33f8ddce13f5ed7be521493dd2f040d120128b3\",\"size\":5579,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/d33f8ddce13f5ed7be521493dd2f040d120128b3\"},{\"path\":\"src/hooks\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"5a2c2b8fe2c96a17ffa91432630e3f6b7de48bf7\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/5a2c2b8fe2c96a17ffa91432630e3f6b7de48bf7\"},{\"path\":\"src/hooks/useBufferedProgress.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"2b8db710f91ced92182fdd3c65412522ac3ccf23\",\"size\":804,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/2b8db710f91ced92182fdd3c65412522ac3ccf23\"},{\"path\":\"src/hooks/usePlayer.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"ccd0886070b91826acac3f89617765a290771923\",\"size\":1173,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/ccd0886070b91826acac3f89617765a290771923\"},{\"path\":\"src/index.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"b36f9c2ea8c478fce84a194b7713eeb6516d4e0b\",\"size\":391,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/b36f9c2ea8c478fce84a194b7713eeb6516d4e0b\"},{\"path\":\"src/typings\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"14f643ea8b995bdd16581a551444b9985b2d637b\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/14f643ea8b995bdd16581a551444b9985b2d637b\"},{\"path\":\"src/typings/AudioPresets.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"1b40163847c804b96498d6456f4222d17c470e62\",\"size\":1379,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/1b40163847c804b96498d6456f4222d17c470e62\"},{\"path\":\"src/typings/Events.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"dedea5a1f671f80e9547241f0839a36f3d79f2eb\",\"size\":615,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/dedea5a1f671f80e9547241f0839a36f3d79f2eb\"},{\"path\":\"src/typings/Player.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"0d27f9b65eccf53c0ceaf3b253d845c72c7fb0df\",\"size\":2514,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/0d27f9b65eccf53c0ceaf3b253d845c72c7fb0df\"},{\"path\":\"src/typings/PlayerStore.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"d3f4329ad917874c27abf9870a8c20f00eedb5f0\",\"size\":3818,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/d3f4329ad917874c27abf9870a8c20f00eedb5f0\"},{\"path\":\"tsconfig.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"cbe9e1971c70b84cad0dab6ba1e5b93b599f6fb5\",\"size\":239,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/cbe9e1971c70b84cad0dab6ba1e5b93b599f6fb5\"}],\"truncated\":false}",
>   "title": "main",
>   "modified_date": null,
>   "url": "https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/main?recursive=1",
>   "display_url": "https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/main?recursive=1",
>   "display_title": "main",
>   "structuredContent": {
>     "title": "main",
>     "content": "{\"sha\":\"b3877a4505907fe138ee1e5eb7bbe69999877ec2\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/b3877a4505907fe138ee1e5eb7bbe69999877ec2\",\"tree\":[{\"path\":\".eslintrc.js\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"83c8ae08e8a8fdef59d55678f937166df25e0bfa\",\"size\":128,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/83c8ae08e8a8fdef59d55678f937166df25e0bfa\"},{\"path\":\".gitignore\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"e64b91c971a1de566da4f90a23f405dd877a2bcd\",\"size\":573,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/e64b91c971a1de566da4f90a23f405dd877a2bcd\"},{\"path\":\".npmignore\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"c80a15fb20176b862978e14e03aeada59d73cd99\",\"size\":229,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/c80a15fb20176b862978e14e03aeada59d73cd99\"},{\"path\":\"CONTRIBUTING.MD\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"4e4868ad5f98f8c46aa8ddbe9a53d7b8fd905f15\",\"size\":1920,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/4e4868ad5f98f8c46aa8ddbe9a53d7b8fd905f15\"},{\"path\":\"README.md\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"4c73bf017b3da6eebe8972212e21a4ee3b27b1ce\",\"size\":3504,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/4c73bf017b3da6eebe8972212e21a4ee3b27b1ce\"},{\"path\":\"docs\",\"mode\":\"160000\",\"type\":\"commit\",\"sha\":\"c728e32f7cd766e2e14c20ffc0da406d8746feb3\"},{\"path\":\"example\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"5c8427b3e7255470c0ccddff0b75b0efcf83a6ca\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/5c8427b3e7255470c0ccddff0b75b0efcf83a6ca\"},{\"path\":\"example/.gitignore\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"954fc6625f3659cda586d99d146802f86875b450\",\"size\":398,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/954fc6625f3659cda586d99d146802f86875b450\"},{\"path\":\"example/App.tsx\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"d3c5b8582c29a3464022722d3a02a5f78b754266\",\"size\":45370,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/d3c5b8582c29a3464022722d3a02a5f78b754266\"},{\"path\":\"example/app.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"7080991ae8eed386049e9967b855a8ee56c574e6\",\"size\":804,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/7080991ae8eed386049e9967b855a8ee56c574e6\"},{\"path\":\"example/assets\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"666ab2ae9bd742da6f95efffaa581f29969ca651\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/666ab2ae9bd742da6f95efffaa581f29969ca651\"},{\"path\":\"example/assets/adaptive-icon.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"03d6f6b6c6727954aec1d8206222769afd178d8d\",\"size\":17547,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/03d6f6b6c6727954aec1d8206222769afd178d8d\"},{\"path\":\"example/assets/favicon.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"e75f697b1801871ad8cd9309b05e8ffe8c6b6d01\",\"size\":1466,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/e75f697b1801871ad8cd9309b05e8ffe8c6b6d01\"},{\"path\":\"example/assets/icon.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"a0b1526fc7b78680fd8d733dbc6113e1af695487\",\"size\":22380,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/a0b1526fc7b78680fd8d733dbc6113e1af695487\"},{\"path\":\"example/assets/splash-icon.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"03d6f6b6c6727954aec1d8206222769afd178d8d\",\"size\":17547,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/03d6f6b6c6727954aec1d8206222769afd178d8d\"},{\"path\":\"example/audio\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"2971ae186ea1bbb51a658598ab4f954645d6ad40\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/2971ae186ea1bbb51a658598ab4f954645d6ad40\"},{\"path\":\"example/audio/liam-payne.mp3\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"31bfbe71d85df01abb5d13b42c4ac311e662923f\",\"size\":5325982,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/31bfbe71d85df01abb5d13b42c4ac311e662923f\"},{\"path\":\"example/audio/love.mp3\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"2bd56507bf1417c759b5a134807dda592aacb334\",\"size\":3401165,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/2bd56507bf1417c759b5a134807dda592aacb334\"},{\"path\":\"example/audio/seasonoflove.flac\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"159f01c4e792cec2f55f6566a84ea8855c8822aa\",\"size\":40023021,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/159f01c4e792cec2f55f6566a84ea8855c8822aa\"},{\"path\":\"example/babel.config.js\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"9d89e131194f49640e1ea7511e8693d2e98e6343\",\"size\":108,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/9d89e131194f49640e1ea7511e8693d2e98e6343\"},{\"path\":\"example/glow-components\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"38c2053ee8211c7674512dfae3d3b59b37f9f4f4\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/38c2053ee8211c7674512dfae3d3b59b37f9f4f4\"},{\"path\":\"example/glow-components/SeekBar\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"5107d071785089cda441c68ca917dc0fd7eda1f4\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/5107d071785089cda441c68ca917dc0fd7eda1f4\"},{\"path\":\"example/glow-components/SeekBar/SeekBar.tsx\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"b282cac96c8bef52176b20d11df3fe489d1a0e88\",\"size\":4681,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/b282cac96c8bef52176b20d11df3fe489d1a0e88\"},{\"path\":\"example/glow-components/SeekBar/SeekBar.types.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"c16fa939a374a0949de3d6127da422316a570010\",\"size\":250,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/c16fa939a374a0949de3d6127da422316a570010\"},{\"path\":\"example/index.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"d598f5fb042dec7e4b7fc088105fa70b0b9d4185\",\"size\":447,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/d598f5fb042dec7e4b7fc088105fa70b0b9d4185\"},{\"path\":\"example/ios\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"e541b3e8115381d8be2de0ff0dca2968557eca3a\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/e541b3e8115381d8be2de0ff0dca2968557eca3a\"},{\"path\":\"example/ios/.gitignore\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"8beb344303ffdb5a918513f1962d5061bd764589\",\"size\":321,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/8beb344303ffdb5a918513f1962d5061bd764589\"},{\"path\":\"example/ios/.spm.pods\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"de5ac76e3b5fffadb9480511199d012f77b3cb18\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/de5ac76e3b5fffadb9480511199d012f77b3cb18\"},{\"path\":\"example/ios/.spm.pods/packages\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"e0068f32ccaae53fada85aabdb8dfd2919127886\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/e0068f32ccaae53fada85aabdb8dfd2919127886\"},{\"path\":\"example/ios/.spm.pods/packages/.umbrella\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"733a778577d0878b6cbf7562f17a0196f777a818\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/733a778577d0878b6cbf7562f17a0196f777a818\"},{\"path\":\"example/ios/.spm.pods/packages/.umbrella/.build\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"97e6218d268668851110328d6ec1eec80d343e86\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/97e6218d268668851110328d6ec1eec80d343e86\"},{\"path\":\"example/ios/.spm.pods/packages/.umbrella/.build/workspace-state.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"7c0cb06983a96afc60d69f6a48955b7669c8cba3\",\"size\":125,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/7c0cb06983a96afc60d69f6a48955b7669c8cba3\"},{\"path\":\"example/ios/.spm.pods/packages/.umbrella/Package.swift\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"da23206f916a2338831efda9ac3d809a4f41206e\",\"size\":128,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/da23206f916a2338831efda9ac3d809a4f41206e\"},{\"path\":\"example/ios/.xcode.env\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"3d5782c71568d32eec2fe71b034efcde053305f9\",\"size\":482,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/3d5782c71568d32eec2fe71b034efcde053305f9\"},{\"path\":\"example/ios/Podfile\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"9399cfd56d1b7274dab762fe18c320c684782151\",\"size\":2483,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/9399cfd56d1b7274dab762fe18c320c684782151\"},{\"path\":\"example/ios/Podfile.lock\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"b3c023418a9e0e3b46a707c305814aef64a17dd1\",\"size\":67952,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/b3c023418a9e0e3b46a707c305814aef64a17dd1\"},{\"path\":\"example/ios/Podfile.properties.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"417e2e5ab465d7e8a4fb70944338c4b62b4cfaee\",\"size\":105,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/417e2e5ab465d7e8a4fb70944338c4b62b4cfaee\"},{\"path\":\"example/ios/exposoniciosplayerexample.xcodeproj\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"ff6f0a7a985828fc2da777e079280f0543fe5bae\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/ff6f0a7a985828fc2da777e079280f0543fe5bae\"},{\"path\":\"example/ios/exposoniciosplayerexample.xcodeproj/project.pbxproj\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"668bae9d41e40aa64fcbfbab0a571b3cd6ea3e1b\",\"size\":24600,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/668bae9d41e40aa64fcbfbab0a571b3cd6ea3e1b\"},{\"path\":\"example/ios/exposoniciosplayerexample.xcodeproj/xcshareddata\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"cfba7038cadd8279823ad04e888a15c11e61e51a\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/cfba7038cadd8279823ad04e888a15c11e61e51a\"},{\"path\":\"example/ios/exposoniciosplayerexample.xcodeproj/xcshareddata/xcschemes\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"62ee525e94620c933c01835f3a363b4080d51e7b\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/62ee525e94620c933c01835f3a363b4080d51e7b\"},{\"path\":\"example/ios/exposoniciosplayerexample.xcodeproj/xcshareddata/xcschemes/exposoniciosplayerexample.xcscheme\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"6dbeb35ab8d163fa2e4fe1300094f843d0cea393\",\"size\":3486,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/6dbeb35ab8d163fa2e4fe1300094f843d0cea393\"},{\"path\":\"example/ios/exposoniciosplayerexample.xcworkspace\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"a7f87667d08e7b936321be133503ac0cb41a7545\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/a7f87667d08e7b936321be133503ac0cb41a7545\"},{\"path\":\"example/ios/exposoniciosplayerexample.xcworkspace/contents.xcworkspacedata\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"94efca18507246fd8cbe8e502e41c5242bf48c5b\",\"size\":243,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/94efca18507246fd8cbe8e502e41c5242bf48c5b\"},{\"path\":\"example/ios/exposoniciosplayerexample\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"7af445683baf04696fa04c8fa2fb29bb08e5867f\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/7af445683baf04696fa04c8fa2fb29bb08e5867f\"},{\"path\":\"example/ios/exposoniciosplayerexample/AppDelegate.swift\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"a7887e1e5b1269ad3b228d46c7531297dca8e9c8\",\"size\":2275,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/a7887e1e5b1269ad3b228d46c7531297dca8e9c8\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"8f04a0409bee6e88cd3edbc3a15d2d07038bde69\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/8f04a0409bee6e88cd3edbc3a15d2d07038bde69\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/AppIcon.appiconset\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"36e5c5de5fc0e61a1e69873cd71335af71ef06a9\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/36e5c5de5fc0e61a1e69873cd71335af71ef06a9\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"2732229faf0f150332a6f03c098d0bae8dc69ffd\",\"size\":59468,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/2732229faf0f150332a6f03c098d0bae8dc69ffd\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/AppIcon.appiconset/Contents.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"90d8d4c2a90c7b5833351423014112b0bc6ea9b2\",\"size\":215,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/90d8d4c2a90c7b5833351423014112b0bc6ea9b2\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/Contents.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"ed285c2e5f162b08ef745fdb14857f495bf6e685\",\"size\":62,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/ed285c2e5f162b08ef745fdb14857f495bf6e685\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/SplashScreenBackground.colorset\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"c7be0d75f7d6c6334c6c5e2f4f5fd64dec586b0b\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/c7be0d75f7d6c6334c6c5e2f4f5fd64dec586b0b\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/SplashScreenBackground.colorset/Contents.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"15f02abee44ab32bd4ad40ef17e9b592d1ac0b56\",\"size\":348,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/15f02abee44ab32bd4ad40ef17e9b592d1ac0b56\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/SplashScreenLogo.imageset\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"c5630f60ea955f389887b854a674e7346fdfffe4\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/c5630f60ea955f389887b854a674e7346fdfffe4\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/SplashScreenLogo.imageset/Contents.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"f65c008be7069979e75143ab35e864720b9c7b2c\",\"size\":358,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/f65c008be7069979e75143ab35e864720b9c7b2c\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/SplashScreenLogo.imageset/image.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"b9ff0fcbfed1963ef9ae249b69bdb199937b85b8\",\"size\":60870,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/b9ff0fcbfed1963ef9ae249b69bdb199937b85b8\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/SplashScreenLogo.imageset/image@2x.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"b9ff0fcbfed1963ef9ae249b69bdb199937b85b8\",\"size\":60870,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/b9ff0fcbfed1963ef9ae249b69bdb199937b85b8\"},{\"path\":\"example/ios/exposoniciosplayerexample/Images.xcassets/SplashScreenLogo.imageset/image@3x.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"b9ff0fcbfed1963ef9ae249b69bdb199937b85b8\",\"size\":60870,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/b9ff0fcbfed1963ef9ae249b69bdb199937b85b8\"},{\"path\":\"example/ios/exposoniciosplayerexample/Info.plist\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"d04da66ba4c83ef5e081935f3bd5f7646308a33b\",\"size\":2292,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/d04da66ba4c83ef5e081935f3bd5f7646308a33b\"},{\"path\":\"example/ios/exposoniciosplayerexample/PrivacyInfo.xcprivacy\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"5bb83c5d4327f8f8a4f12033703a4d0957cc822f\",\"size\":1283,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/5bb83c5d4327f8f8a4f12033703a4d0957cc822f\"},{\"path\":\"example/ios/exposoniciosplayerexample/SplashScreen.storyboard\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"8a6fcd47bcafdf501e14ce2fa7bf7144f3eed005\",\"size\":3562,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/8a6fcd47bcafdf501e14ce2fa7bf7144f3eed005\"},{\"path\":\"example/ios/exposoniciosplayerexample/Supporting\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"f90507911babd075c2ab434d521d8cf9b631dcf4\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/f90507911babd075c2ab434d521d8cf9b631dcf4\"},{\"path\":\"example/ios/exposoniciosplayerexample/Supporting/Expo.plist\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"750be020cfc2d242e01b44e9d7054495b8357937\",\"size\":364,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/750be020cfc2d242e01b44e9d7054495b8357937\"},{\"path\":\"example/ios/exposoniciosplayerexample/exposoniciosplayerexample-Bridging-Header.h\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"8361941afc2fb739367ffa08707b9b5932f17bfe\",\"size\":102,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/8361941afc2fb739367ffa08707b9b5932f17bfe\"},{\"path\":\"example/ios/exposoniciosplayerexample/exposoniciosplayerexample.entitlements\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"f683276c573e8f6c0631b22043ce44e3073b81f0\",\"size\":182,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/f683276c573e8f6c0631b22043ce44e3073b81f0\"},{\"path\":\"example/metro.config.js\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"668d5dd63d9a4ca9532223ea50a13c6c7d0f062f\",\"size\":1116,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/668d5dd63d9a4ca9532223ea50a13c6c7d0f062f\"},{\"path\":\"example/package-lock.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"551a496d56fb81b24f50bea8e01e283bb80d6bf9\",\"size\":316251,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/551a496d56fb81b24f50bea8e01e283bb80d6bf9\"},{\"path\":\"example/package.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"8ec6dc1051807597d822235b7fd47b162a749c56\",\"size\":827,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/8ec6dc1051807597d822235b7fd47b162a749c56\"},{\"path\":\"example/store\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"ec362f7fa0a8523212e2a410b5bf03dcba328eb3\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/ec362f7fa0a8523212e2a410b5bf03dcba328eb3\"},{\"path\":\"example/store/index.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"66d418dfe1269a271c1d27f40d80a4ac52129fec\",\"size\":13768,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/66d418dfe1269a271c1d27f40d80a4ac52129fec\"},{\"path\":\"example/store/types.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"6054a58dade9abc111f0ad02beed8a03dae83545\",\"size\":3823,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/6054a58dade9abc111f0ad02beed8a03dae83545\"},{\"path\":\"example/tsconfig.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"9bc58f3885eca78a47d5498aa558a44a952728d0\",\"size\":202,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/9bc58f3885eca78a47d5498aa558a44a952728d0\"},{\"path\":\"example/webpack.config.js\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"b7d730ea4eb32d4187107b932a3de5c72910f16c\",\"size\":460,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/b7d730ea4eb32d4187107b932a3de5c72910f16c\"},{\"path\":\"expo-module.config.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"e6f3e82159c7becc2fe5d8c95338b8bf3c6bdc52\",\"size\":102,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/e6f3e82159c7becc2fe5d8c95338b8bf3c6bdc52\"},{\"path\":\"img\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"03087ae295b87bf752a742c37765c62eb6de6eda\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/03087ae295b87bf752a742c37765c62eb6de6eda\"},{\"path\":\"img/banner-soft.png\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"4013d95ded7c4a30ee1113aefe4807fc15950fbf\",\"size\":10994,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/4013d95ded7c4a30ee1113aefe4807fc15950fbf\"},{\"path\":\"ios\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"63fa5f0ed944802fcbae12e0964333b836c8307e\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/63fa5f0ed944802fcbae12e0964333b836c8307e\"},{\"path\":\"ios/AudioPlayer.swift\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"d84f1a2a639d5d9440fffc21f11d6a2e94fd2160\",\"size\":49529,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/d84f1a2a639d5d9440fffc21f11d6a2e94fd2160\"},{\"path\":\"ios/ExpoNativeiOSSonicPlayer.podspec\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"d39b9f23685db7fecb073796e6b26715c9c20d31\",\"size\":798,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/d39b9f23685db7fecb073796e6b26715c9c20d31\"},{\"path\":\"ios/ExpoNativeiOSSonicPlayerModule.swift\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"938a29e36adfc1be3ec4628bae242d15e266796d\",\"size\":12987,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/938a29e36adfc1be3ec4628bae242d15e266796d\"},{\"path\":\"package-lock.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"ab6ca609a3cca927d9bd67b87763e18f04aa284f\",\"size\":598380,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/ab6ca609a3cca927d9bd67b87763e18f04aa284f\"},{\"path\":\"package.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"7eea3d6476da57eca95aa755253b451be01976ef\",\"size\":1254,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/7eea3d6476da57eca95aa755253b451be01976ef\"},{\"path\":\"pnpm-lock.yaml\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"f73155fa920bf6f49e5a16636292e27299d350da\",\"size\":344380,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/f73155fa920bf6f49e5a16636292e27299d350da\"},{\"path\":\"src\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"492a3e184afb745c3f698466e93e517480c6b970\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/492a3e184afb745c3f698466e93e517480c6b970\"},{\"path\":\"src/RNExpoSonicPlayer.types.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"628bb72069df05f5736556e897506b0a783b3745\",\"size\":5322,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/628bb72069df05f5736556e897506b0a783b3745\"},{\"path\":\"src/RNSonicModule.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"d33f8ddce13f5ed7be521493dd2f040d120128b3\",\"size\":5579,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/d33f8ddce13f5ed7be521493dd2f040d120128b3\"},{\"path\":\"src/hooks\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"5a2c2b8fe2c96a17ffa91432630e3f6b7de48bf7\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/5a2c2b8fe2c96a17ffa91432630e3f6b7de48bf7\"},{\"path\":\"src/hooks/useBufferedProgress.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"2b8db710f91ced92182fdd3c65412522ac3ccf23\",\"size\":804,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/2b8db710f91ced92182fdd3c65412522ac3ccf23\"},{\"path\":\"src/hooks/usePlayer.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"ccd0886070b91826acac3f89617765a290771923\",\"size\":1173,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/ccd0886070b91826acac3f89617765a290771923\"},{\"path\":\"src/index.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"b36f9c2ea8c478fce84a194b7713eeb6516d4e0b\",\"size\":391,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/b36f9c2ea8c478fce84a194b7713eeb6516d4e0b\"},{\"path\":\"src/typings\",\"mode\":\"040000\",\"type\":\"tree\",\"sha\":\"14f643ea8b995bdd16581a551444b9985b2d637b\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/14f643ea8b995bdd16581a551444b9985b2d637b\"},{\"path\":\"src/typings/AudioPresets.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"1b40163847c804b96498d6456f4222d17c470e62\",\"size\":1379,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/1b40163847c804b96498d6456f4222d17c470e62\"},{\"path\":\"src/typings/Events.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"dedea5a1f671f80e9547241f0839a36f3d79f2eb\",\"size\":615,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/dedea5a1f671f80e9547241f0839a36f3d79f2eb\"},{\"path\":\"src/typings/Player.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"0d27f9b65eccf53c0ceaf3b253d845c72c7fb0df\",\"size\":2514,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/0d27f9b65eccf53c0ceaf3b253d845c72c7fb0df\"},{\"path\":\"src/typings/PlayerStore.ts\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"d3f4329ad917874c27abf9870a8c20f00eedb5f0\",\"size\":3818,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/d3f4329ad917874c27abf9870a8c20f00eedb5f0\"},{\"path\":\"tsconfig.json\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"cbe9e1971c70b84cad0dab6ba1e5b93b599f6fb5\",\"size\":239,\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/blobs/cbe9e1971c70b84cad0dab6ba1e5b93b599f6fb5\"}],\"truncated\":false}",
>     "display_url": "https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/main?recursive=1"
>   }
> }
> ```
>
> MCP tool call
>
> codex_apps.github.search_repositories
>
> ```json
> {
>   "query": "react-native spatial audio",
>   "per_page": 10
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "archive_filter_applied": null,
>   "repositories": [
>     {
>       "id": "1080060336",
>       "name": "Spatial3D-Equalizer",
>       "owner": {
>         "login": "djlxks22-source",
>         "id": 237466234,
>         "type": "User",
>         "avatar_url": "https://avatars.githubusercontent.com/u/237466234?v=4",
>         "url": "https://api.github.com/users/djlxks22-source"
>       },
>       "repository_full_name": "djlxks22-source/Spatial3D-Equalizer",
>       "permissions": {
>         "admin": false,
>         "maintain": false,
>         "pull": true,
>         "push": false,
>         "triage": false
>       },
>       "allow_auto_merge": null,
>       "allow_merge_commit": null,
>       "allow_rebase_merge": null,
>       "allow_squash_merge": null,
>       "allow_update_branch": null,
>       "clone_url": "https://github.com/djlxks22-source/Spatial3D-Equalizer.git",
>       "size": 45,
>       "default_branch": "main",
>       "git_commits_url": "https://api.github.com/repos/djlxks22-source/Spatial3D-Equalizer/git/commits{/sha}",
>       "git_refs_url": "https://api.github.com/repos/djlxks22-source/Spatial3D-Equalizer/git/refs{/sha}",
>       "git_url": "git://github.com/djlxks22-source/Spatial3D-Equalizer.git",
>       "master_branch": null,
>       "visibility": "public",
>       "archived": false,
>       "is_code_search_indexed": null,
>       "display_title": "djlxks22-source/Spatial3D-Equalizer",
>       "display_url": "https://github.com/djlxks22-source/Spatial3D-Equalizer"
>     },
>     {
>       "id": "996689388",
>       "name": "SpatialSound",
>       "owner": {
>         "login": "alperenavici",
>         "id": 147971625,
>         "type": "User",
>         "avatar_url": "https://avatars.githubusercontent.com/u/147971625?v=4",
>         "url": "https://api.github.com/users/alperenavici"
>       },
>       "repository_full_name": "alperenavici/SpatialSound",
>       "permissions": {
>         "admin": false,
>         "maintain": false,
>         "pull": true,
>         "push": false,
>         "triage": false
>       },
>       "allow_auto_merge": null,
>       "allow_merge_commit": null,
>       "allow_rebase_merge": null,
>       "allow_squash_merge": null,
>       "allow_update_branch": null,
>       "clone_url": "https://github.com/alperenavici/SpatialSound.git",
>       "size": 118,
>       "default_branch": "main",
>       "git_commits_url": "https://api.github.com/repos/alperenavici/SpatialSound/git/commits{/sha}",
>       "git_refs_url": "https://api.github.com/repos/alperenavici/SpatialSound/git/refs{/sha}",
>       "git_url": "git://github.com/alperenavici/SpatialSound.git",
>       "master_branch": null,
>       "visibility": "public",
>       "archived": false,
>       "is_code_search_indexed": null,
>       "display_title": "alperenavici/SpatialSound",
>       "display_url": "https://github.com/alperenavici/SpatialSound"
>     },
>     {
>       "id": "1280553158",
>       "name": "tether",
>       "owner": {
>         "login": "nikhilsnayak",
>         "id": 77049852,
>         "type": "User",
>         "avatar_url": "https://avatars.githubusercontent.com/u/77049852?v=4",
>         "url": "https://api.github.com/users/nikhilsnayak"
>       },
>       "repository_full_name": "nikhilsnayak/tether",
>       "permissions": {
>         "admin": false,
>         "maintain": false,
>         "pull": true,
>         "push": false,
>         "triage": false
>       },
>       "allow_auto_merge": null,
>       "allow_merge_commit": null,
>       "allow_rebase_merge": null,
>       "allow_squash_merge": null,
>       "allow_update_branch": null,
>       "clone_url": "https://github.com/nikhilsnayak/tether.git",
>       "size": 10028,
>       "default_branch": "main",
>       "git_commits_url": "https://api.github.com/repos/nikhilsnayak/tether/git/commits{/sha}",
>       "git_refs_url": "https://api.github.com/repos/nikhilsnayak/tether/git/refs{/sha}",
>       "git_url": "git://github.com/nikhilsnayak/tether.git",
>       "master_branch": null,
>       "visibility": "public",
>       "archived": false,
>       "is_code_search_indexed": null,
>       "display_title": "nikhilsnayak/tether",
>       "display_url": "https://github.com/nikhilsnayak/tether"
>     },
>     {
>       "id": "1276500955",
>       "name": "LankaLens",
>       "owner": {
>         "login": "ravinduanjana99",
>         "id": 187283327,
>         "type": "User",
>         "avatar_url": "https://avatars.githubusercontent.com/u/187283327?v=4",
>         "url": "https://api.github.com/users/ravinduanjana99"
>       },
>       "repository_full_name": "ravinduanjana99/LankaLens",
>       "permissions": {
>         "admin": false,
>         "maintain": false,
>         "pull": true,
>         "push": false,
>         "triage": false
>       },
>       "allow_auto_merge": null,
>       "allow_merge_commit": null,
>       "allow_rebase_merge": null,
>       "allow_squash_merge": null,
>       "allow_update_branch": null,
>       "clone_url": "https://github.com/ravinduanjana99/LankaLens.git",
>       "size": 44113,
>       "default_branch": "main",
>       "git_commits_url": "https://api.github.com/repos/ravinduanjana99/LankaLens/git/commits{/sha}",
>       "git_refs_url": "https://api.github.com/repos/ravinduanjana99/LankaLens/git/refs{/sha}",
>       "git_url": "git://github.com/ravinduanjana99/LankaLens.git",
>       "master_branch": null,
>       "visibility": "public",
>       "archived": false,
>       "is_code_search_indexed": null,
>       "display_title": "ravinduanjana99/LankaLens",
>       "display_url": "https://github.com/ravinduanjana99/LankaLens"
>     },
>     {
>       "id": "1320441152",
>       "name": "cairn",
>       "owner": {
>         "login": "SeyonAayil",
>         "id": 252655588,
>         "type": "Organization",
>         "avatar_url": "https://avatars.githubusercontent.com/u/252655588?v=4",
>         "url": "https://api.github.com/users/SeyonAayil"
>       },
>       "repository_full_name": "SeyonAayil/cairn",
>       "permissions": {
>         "admin": false,
>         "maintain": false,
>         "pull": true,
>         "push": false,
>         "triage": false
>       },
>       "allow_auto_merge": null,
>       "allow_merge_commit": null,
>       "allow_rebase_merge": null,
>       "allow_squash_merge": null,
>       "allow_update_branch": null,
>       "clone_url": "https://github.com/SeyonAayil/cairn.git",
>       "size": 5138,
>       "default_branch": "main",
>       "git_commits_url": "https://api.github.com/repos/SeyonAayil/cairn/git/commits{/sha}",
>       "git_refs_url": "https://api.github.com/repos/SeyonAayil/cairn/git/refs{/sha}",
>       "git_url": "git://github.com/SeyonAayil/cairn.git",
>       "master_branch": null,
>       "visibility": "public",
>       "archived": false,
>       "is_code_search_indexed": null,
>       "display_title": "SeyonAayil/cairn",
>       "display_url": "https://github.com/SeyonAayil/cairn"
>     },
>     {
>       "id": "1110606794",
>       "name": "divyadrishti2",
>       "owner": {
>         "login": "gaurangpatil97",
>         "id": 242182329,
>         "type": "User",
>         "avatar_url": "https://avatars.githubusercontent.com/u/242182329?v=4",
>         "url": "https://api.github.com/users/gaurangpatil97"
>       },
>       "repository_full_name": "gaurangpatil97/divyadrishti2",
>       "permissions": {
>         "admin": false,
>         "maintain": false,
>         "pull": true,
>         "push": false,
>         "triage": false
>       },
>       "allow_auto_merge": null,
>       "allow_merge_commit": null,
>       "allow_rebase_merge": null,
>       "allow_squash_merge": null,
>       "allow_update_branch": null,
>       "clone_url": "https://github.com/gaurangpatil97/divyadrishti2.git",
>       "size": 19332,
>       "default_branch": "main",
>       "git_commits_url": "https://api.github.com/repos/gaurangpatil97/divyadrishti2/git/commits{/sha}",
>       "git_refs_url": "https://api.github.com/repos/gaurangpatil97/divyadrishti2/git/refs{/sha}",
>       "git_url": "git://github.com/gaurangpatil97/divyadrishti2.git",
>       "master_branch": null,
>       "visibility": "public",
>       "archived": false,
>       "is_code_search_indexed": null,
>       "display_title": "gaurangpatil97/divyadrishti2",
>       "display_url": "https://github.com/gaurangpatil97/divyadrishti2"
>     }
>   ]
> }
> ```
>
> </details>
>
> 找到了一些候选，但“支持 Spatial Audio”不一定包含每个声源的三维位置控制。我正在核对源码和接口，确认它们能否支持你要的拖动多个声源。
>
> <details><summary>Called 13 tools, searched the web</summary>
>
> MCP tool call
>
> codex_apps.github.fetch_file
>
> ```json
> {
>   "repository_full_name": "rit3zh/expo-ios-sonic-player",
>   "path": "src/RNSonicModule.ts"
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "content": "import { requireNativeModule } from \"expo-modules-core\";\nimport { NativeModule } from \"expo-modules-core/types\";\n\nexport interface AudioPlaybackOptions {\n  url: string;\n  title: string;\n  artist: string;\n  artwork?: string;\n  duration?: number;\n  album?: string;\n  description?: string;\n  isLive?: boolean;\n  /**\n   * @description This function is not preferred for using right now.\n   * It is still work in progress and may not work as expected.\n   */\n  useSpatialAudio?: boolean;\n}\n\nexport type SlowedReverbPreset = \"classic\" | \"dreamy\" | \"subtle\" | \"heavy\";\nexport type TrackMetadata = {\n  title?: string;\n  artist?: string;\n  artworkUri?: string; // remote or local (e.g., from `Image.resolveAssetSource`)\n  duration?: number;\n};\n\nexport type SlowedReverbPresetInfo = {\n  name: SlowedReverbPreset;\n  speed: number;\n  pitch: number;\n  reverbAmount: number;\n  delayAmount: number;\n  delayTime: number;\n  delayFeedback: number;\n  description: string;\n};\n\n/**\n *\n * Native event payloads\n */\nexport type ProgressEvent = {\n  progress: number;\n};\n\nexport type StatusEvent = {\n  status: \"loading\" | \"ready\" | \"error\" | \"seeked\" | \"unknown\";\n};\n\nexport interface AudioPlayerInitializationConfig {\n  enableRemoteControls?: boolean;\n  skipForwardSeconds?: number;\n  skipBackwardSeconds?: number;\n  enableNextTrack?: boolean;\n  enablePreviousTrack?: boolean;\n}\n\nexport type PlaybackInfoEvent = {\n  currentTime: number;\n  duration: number;\n  isPlaying: boolean;\n};\n\n/**\n * Equalizer preset names\n */\nexport type EqualizerPreset =\n  | \"flat\"\n  | \"rock\"\n  | \"pop\"\n  | \"jazz\"\n  | \"classical\"\n  | \"bass\"\n  | \"treble\"\n  | \"vocal\";\n\n/**\n * Reverb preset names\n */\nexport type ReverbPreset =\n  | \"smallroom\"\n  | \"mediumroom\"\n  | \"largeroom\"\n  | \"mediumhall\"\n  | \"largehall\"\n  | \"plate\"\n  | \"cathedral\";\n\n/**\n * Audio preset names (combinations of effects)\n */\nexport type AudioPreset = \"normal\" | \"concert\" | \"studio\";\n\nexport interface IPlayOption {\n  /**\n   *\n   *\n   * @type {number}\n   * @description The fade-in duration in milliseconds.\n   * @memberof IPlayOption\n   */\n  fadeIn?: number;\n}\n\n/**\n * Distortion preset names\n */\nexport type DistortionPreset =\n  | \"drumsbitterbuzz\"\n  | \"drumsbufferlayer\"\n  | \"drumslofi\"\n  | \"multibrokenspeaker\"\n  | \"multicellularcpa\"\n  | \"multidecimated1\"\n  | \"multidecimated2\"\n  | \"multidecimated3\"\n  | \"multidecimated4\"\n  | \"multidistortioncubed\"\n  | \"multiecho1\"\n  | \"multiecho2\"\n  | \"multiechotight1\"\n  | \"multiechotight2\"\n  | \"multieverything\"\n  | \"multiextrasmallroom\"\n  | \"speechalienchange\"\n  | \"speechcosmicinterference\"\n  | \"speechgoldentone\"\n  | \"speechradiodifference\"\n  | \"speechwavelform\";\n\n/**\n * Native module declaration\n */\nexport interface RNExpoSonicPlayerType\n  extends NativeModule<{\n    onProgress: (event: ProgressEvent) => void;\n    onStatusChange: (event: StatusEvent) => void;\n    onPlaybackInfo: (event: PlaybackInfoEvent) => void;\n    onMediaControlEvent: (\n      event: string,\n      payload?: Record<string, string>\n    ) => void;\n  }> {\n  initialize(options: AudioPlayerInitializationConfig): Promise<void>;\n\n  // MARK: - Basic Playback Controls\n  play(options: AudioPlaybackOptions): Promise<void>;\n  pause(): Promise<void>;\n  resume(): Promise<void>;\n  stop(): Promise<void>;\n  seek(seconds: number): Promise<void>;\n\n  // ✅ ADD THIS - Missing from your TS file\n  setMetaDataForCurrentTrack(metadata: TrackMetadata): Promise<void>;\n\n  toggleAmbientMode: <T extends boolean>(enabled: T) => Promise<void>;\n\n  // MARK: - Equalizer Controls\n  setBandGain(band: number, gain: number): Promise<void>;\n  getBandGain(band: number): Promise<number | null>;\n  getAllBandGains(): Promise<number[]>;\n  resetEqualizer(): Promise<void>;\n  applyEqualizerPreset(presetName: EqualizerPreset): Promise<void>;\n\n  // MARK: - Reverb Controls\n  setReverbWetDryMix(wetDryMix: number): Promise<void>;\n  setReverbPreset(presetName: ReverbPreset): Promise<void>;\n\n  // MARK: - Delay Controls\n  setDelayTime(delayTime: number): Promise<void>;\n  setDelayFeedback(feedback: number): Promise<void>;\n  setDelayWetDryMix(wetDryMix: number): Promise<void>;\n\n  // MARK: - Distortion Controls\n  setDistortionWetDryMix(wetDryMix: number): Promise<void>;\n  setDistortionPreset(presetName: DistortionPreset): Promise<void>;\n\n  // ✅ REMOVE THESE - Not in your Swift file\n  // setVolume(volume: number): Promise<void>;\n  // setLoop(loop: boolean): void;\n\n  enableSlowedReverb(): Promise<void>;\n  disableSlowedReverb(): Promise<void>;\n  toggleSlowedReverb(): Promise<void>;\n  setSlowedReverb(\n    speed: number,\n    pitch: number,\n    reverbAmount: number\n  ): Promise<void>;\n  applySlowedReverbPreset(presetName: SlowedReverbPreset): Promise<void>;\n\n  // MARK: - Slowed Reverb Helpers\n  getAvailableSlowedReverbPresets(): Promise<SlowedReverbPreset[]>;\n  getSlowedReverbPresetInfo(\n    presetName: SlowedReverbPreset\n  ): Promise<SlowedReverbPresetInfo>;\n\n  // MARK: - Audio Preset Controls (combinations)\n  applyAudioPreset(presetName: AudioPreset): Promise<void>;\n\n  // MARK: - Helper Functions\n  getAvailableEqualizerPresets(): Promise<string[]>;\n  getAvailableReverbPresets(): Promise<string[]>;\n  getAvailableAudioPresets(): Promise<string[]>;\n  getBandFrequencies(): Promise<number[]>;\n\n  // ✅ REMOVE THIS - Not in your Swift file\n  // setValueAsync(value: string): Promise<void>;\n\n  // MARK: - Constants\n  PI: number;\n  MAX_GAIN: number;\n  MIN_GAIN: number;\n  BAND_COUNT: number;\n}\n/**\n * Module instance\n */\nconst RNExpoSonicPlayerModule =\n  requireNativeModule<RNExpoSonicPlayerType>(\"RNExpoSonicPlayer\");\n\nexport default RNExpoSonicPlayerModule;\n",
>   "encoding": "utf-8",
>   "sha": "d33f8ddce13f5ed7be521493dd2f040d120128b3",
>   "display_url": "https://github.com/rit3zh/expo-ios-sonic-player/blob/main/src/RNSonicModule.ts",
>   "display_title": "RNSonicModule.ts"
> }
> ```
>
> MCP tool call
>
> codex_apps.github.fetch_file
>
> ```json
> {
>   "repository_full_name": "rit3zh/expo-ios-sonic-player",
>   "path": "ios/ExpoNativeiOSSonicPlayerModule.swift"
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "content": "import ExpoModulesCore\nimport AVFoundation\n\npublic class RNExpoSonicPlayer: Module {\n    private lazy var audioPlayer: AudioPlayer = {\n        let player = AudioPlayer()\n        player.onProgress = { [weak self] progress in\n            self?.sendEvent(\"onProgress\", [\"progress\": progress])\n        }\n        player.onStatusChange = { [weak self] status in\n            self?.sendEvent(\"onStatusChange\", [\"status\": status])\n        }\n        player.onPlaybackInfo = { [weak self] currentTime, duration, isPlaying in\n            self?.sendEvent(\"onPlaybackInfo\", [\n                \"currentTime\": currentTime,\n                \"duration\": duration,\n                \"isPlaying\": isPlaying,\n            ])\n        }\n        \n        player.onMediaControlEvent = { [weak self] event, payload in\n            self?.sendEvent(\"onMediaControlEvent\", [\"event\": event, \"payload\": payload])\n        }\n        return player\n    }()\n\n    public func definition() -> ModuleDefinition {\n        Name(\"RNExpoSonicPlayer\")\n\n        Events(\"onProgress\", \"onStatusChange\", \"onPlaybackInfo\", \"onMediaControlEvent\")\n\n        \n        // MARK: - Core initialize function\n        \n        Function(\"initialize\") { (config: [String: Any]) in\n            let enableRemoteControls = config[\"enableRemoteControls\"] as? Bool ?? true\n            let enableNextTrack = config[\"enableNextTrack\"] as? Bool ?? false\n            let enablePreviousTrack = config[\"enablePreviousTrack\"] as? Bool ?? false\n            let skipForwardSeconds = config[\"skipForwardSeconds\"] as? Double\n            let skipBackwardSeconds = config[\"skipBackwardSeconds\"] as? Double\n\n            self.audioPlayer.initialize(options: PlayerInitializationOptions(\n                enableRemoteControls: enableRemoteControls,\n                skipForwardSeconds: skipForwardSeconds,\n                skipBackwardSeconds: skipBackwardSeconds,\n                enableNextTrack: enableNextTrack,\n                enablePreviousTrack: enablePreviousTrack,\n                nextTrackCallback: {\n                    self.sendEvent(\"onMediaControlEvent\", [\"event\": \"onSkipToNext\"])\n                },\n                previousTrackCallback: {\n                    self.sendEvent(\"onMediaControlEvent\", [\"event\": \"onSkipToPrevious\"])\n                }\n            ))\n        }\n        \n        \n        // MARK: - Basic Playback Controls\n        Function(\"play\") { (options: PlayAudioPlaybackOptions) in\n            let internalOptions = AudioPlaybackOptions(\n                url: options.url,\n                title: options.title,\n                artist: options.artist,\n                artwork: options.artwork,\n                duration: options.duration,\n                album: options.album,\n                description: options.description,\n                isLive: options.isLive,\n                useSpatialAudio: options.useSpatialAudio,\n\n            )\n            \n            self.audioPlayer.play(options: internalOptions, useAVPlayerSpatial: options.useSpatialAudio)\n        }\n\n        Function(\"pause\") {\n            self.audioPlayer.pause()\n        }\n\n        Function(\"resume\") {\n            self.audioPlayer.resume()\n        }\n\n        Function(\"stop\") {\n            self.audioPlayer.stop()\n        }\n        \n        \n        \n        Function(\"setMetaDataForCurrentTrack\") { (metadata: [String: Any]) in\n            let title = metadata[\"title\"] as? String ?? \"Unknown Title\"\n            let artist = metadata[\"artist\"] as? String ?? \"Unknown Artist\"\n            let artworkUri = metadata[\"artworkUri\"] as? String\n            let duration = metadata[\"duration\"] as? Double ?? 0.0\n\n            self.audioPlayer.updateNowPlayingInfo(title: title, artist: artist, artworkURL: artworkUri, duration: duration)\n        }\n    \n\n        Function(\"seek\") { (seconds: Double) in\n            self.audioPlayer.seek(to: seconds)\n        }\n\n        // MARK: - Equalizer Functions\n        Function(\"setBandGain\") { (band: Int, gain: Double) in\n            self.audioPlayer.setBandGain(band: band, gain: Float(gain))\n        }\n\n        Function(\"getBandGain\") { (band: Int) -> Double? in\n            return self.audioPlayer.getBandGain(band: band).map { Double($0) }\n        }\n\n        Function(\"getAllBandGains\") { () -> [Double] in\n            return self.audioPlayer.getAllBandGains().map { Double($0) }\n        }\n\n        Function(\"resetEqualizer\") {\n            self.audioPlayer.resetEqualizer()\n        }\n\n        Function(\"applyEqualizerPreset\") { (presetName: String) in\n            let preset: EqualizerPreset\n            switch presetName.lowercased() {\n            case \"flat\":\n                preset = .flat\n            case \"rock\":\n                preset = .rock\n            case \"pop\":\n                preset = .pop\n            case \"jazz\":\n                preset = .jazz\n            case \"classical\":\n                preset = .classical\n            case \"bass\":\n                preset = .bass\n            case \"treble\":\n                preset = .treble\n            case \"vocal\":\n                preset = .vocal\n            default:\n                preset = .flat\n            }\n            self.audioPlayer.applyEqualizerPreset(preset)\n        }\n\n        // MARK: - Reverb Controls\n        Function(\"setReverbWetDryMix\") { (wetDryMix: Double) in\n            self.audioPlayer.setReverbWetDryMix(Float(wetDryMix))\n        }\n\n        Function(\"setReverbPreset\") { (presetName: String) in\n            let preset: AVAudioUnitReverbPreset\n            switch presetName.lowercased() {\n            case \"smallroom\":\n                preset = .smallRoom\n            case \"mediumroom\":\n                preset = .mediumRoom\n            case \"largeroom\":\n                preset = .largeRoom\n            case \"mediumhall\":\n                preset = .mediumHall\n            case \"largehall\":\n                preset = .largeHall\n            case \"plate\":\n                preset = .plate\n            case \"cathedral\":\n                preset = .cathedral\n            default:\n                preset = .smallRoom\n            }\n            self.audioPlayer.setReverbPreset(preset)\n        }\n\n        // MARK: - Slowed Reverb Controls\n        Function(\"enableSlowedReverb\") {\n            self.audioPlayer.enableSlowedReverb()\n        }\n\n        Function(\"disableSlowedReverb\") {\n            self.audioPlayer.disableSlowedReverb()\n        }\n\n        Function(\"toggleSlowedReverb\") {\n            self.audioPlayer.toggleSlowedReverb()\n        }\n\n        Function(\"setSlowedReverb\") { (speed: Double, pitch: Double, reverbAmount: Double) in\n            self.audioPlayer.setSlowedReverb(speed: Float(speed), pitch: Float(pitch), reverbAmount: Float(reverbAmount))\n        }\n\n        Function(\"applySlowedReverbPreset\") { (presetName: String) in\n            let preset: SlowedReverbPreset\n            switch presetName.lowercased() {\n            case \"classic\":\n                preset = .classic\n            case \"dreamy\":\n                preset = .dreamy\n            case \"subtle\":\n                preset = .subtle\n            case \"heavy\":\n                preset = .heavy\n            default:\n                preset = .classic\n            }\n            self.audioPlayer.applySlowedReverbPreset(preset)\n        }\n\n        Function(\"getAvailableSlowedReverbPresets\") { () -> [String] in\n            let presets = self.audioPlayer.getAvailableSlowedReverbPresets()\n            return presets.map { $0.rawValue }\n        }\n\n        Function(\"getSlowedReverbPresetInfo\") { (presetName: String) -> [String: Any] in\n            let preset: SlowedReverbPreset\n            switch presetName.lowercased() {\n            case \"classic\":\n                preset = .classic\n            case \"dreamy\":\n                preset = .dreamy\n            case \"subtle\":\n                preset = .subtle\n            case \"heavy\":\n                preset = .heavy\n            default:\n                preset = .classic\n            }\n            \n            let info = self.audioPlayer.getSlowedReverbPresetInfo(preset)\n            return [\n                \"name\": info.name.rawValue,\n                \"speed\": info.speed,\n                \"pitch\": info.pitch,\n                \"reverbAmount\": info.reverbAmount,\n                \"delayAmount\": info.delayAmount,\n                \"delayTime\": info.delayTime,\n                \"delayFeedback\": info.delayFeedback,\n                \"description\": info.description\n            ]\n        }\n\n        // MARK: - Delay Controls\n        Function(\"setDelayTime\") { (delayTime: Double) in\n            self.audioPlayer.setDelayTime(delayTime)\n        }\n\n        Function(\"setDelayFeedback\") { (feedback: Double) in\n            self.audioPlayer.setDelayFeedback(Float(feedback))\n        }\n\n        Function(\"setDelayWetDryMix\") { (wetDryMix: Double) in\n            self.audioPlayer.setDelayWetDryMix(Float(wetDryMix))\n        }\n\n        // MARK: - Distortion Controls\n        Function(\"setDistortionWetDryMix\") { (wetDryMix: Double) in\n            self.audioPlayer.setDistortionWetDryMix(Float(wetDryMix))\n        }\n\n        Function(\"setDistortionPreset\") { (presetName: String) in\n            let preset: AVAudioUnitDistortionPreset\n            switch presetName.lowercased() {\n            case \"drumsbitterbuzz\":\n                preset = .drumsBitBrush\n            case \"drumsbufferlayer\":\n                preset = .drumsBufferBeats\n            case \"drumslofi\":\n                preset = .drumsLoFi\n            case \"multibrokenspeaker\":\n                preset = .multiBrokenSpeaker\n            case \"multidecimated1\":\n                preset = .multiDecimated1\n            case \"multidecimated2\":\n                preset = .multiDecimated2\n            case \"multidecimated3\":\n                preset = .multiDecimated3\n            case \"multidecimated4\":\n                preset = .multiDecimated4\n            case \"multidistortioncubed\":\n                preset = .multiDistortedCubed\n            case \"multiecho1\":\n                preset = .multiEcho1\n            case \"multiecho2\":\n                preset = .multiEcho2\n            case \"multiechotight1\":\n                preset = .multiEchoTight1\n            case \"multiechotight2\":\n                preset = .multiEchoTight2\n            case \"speechalienchange\":\n                preset = .speechAlienChatter\n            case \"speechcosmicinterference\":\n                preset = .speechCosmicInterference\n            case \"speechradiodifference\":\n                preset = .speechRadioTower\n            case \"speechwavelform\":\n                preset = .speechWaves\n            default:\n                preset = .drumsBitBrush\n            }\n            self.audioPlayer.setDistortionPreset(preset)\n        }\n\n        // MARK: - Audio Preset Controls\n        Function(\"applyAudioPreset\") { (presetName: String) in\n            let preset: AudioPreset\n            switch presetName.lowercased() {\n            case \"normal\":\n                preset = .normal\n            case \"concert\":\n                preset = .concert\n            case \"studio\":\n                preset = .studio\n            default:\n                preset = .normal\n            }\n            self.audioPlayer.applyAudioPreset(preset)\n        }\n\n        // MARK: - Helper Functions\n        Function(\"getAvailableEqualizerPresets\") { () -> [String] in\n            return [\"flat\", \"rock\", \"pop\", \"jazz\", \"classical\", \"bass\", \"treble\", \"vocal\"]\n        }\n\n        Function(\"getAvailableReverbPresets\") { () -> [String] in\n            return [\"smallroom\", \"mediumroom\", \"largeroom\", \"mediumhall\", \"largehall\", \"plate\", \"cathedral\"]\n        }\n\n        Function(\"getAvailableSlowedReverbPresets\") { () -> [String] in\n            return [\"classic\", \"dreamy\", \"subtle\", \"heavy\"]\n        }\n\n        Function(\"getAvailableAudioPresets\") { () -> [String] in\n            return [\"normal\", \"concert\", \"studio\"]\n        }\n\n        // MARK: - Band Frequency Info\n        Function(\"getBandFrequencies\") { () -> [Double] in\n            return [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]\n        }\n        \n        \n        Function(\"toggleAmbientMode\") { (enabled: Bool) in\n            self.audioPlayer.toggleAmbientMode(enabled)\n        }\n\n\n        // MARK: - Constants\n        Constants([\n            \"PI\": Double.pi,\n            \"MAX_GAIN\": 12.0,\n            \"MIN_GAIN\": -12.0,\n            \"BAND_COUNT\": 10,\n            \"SLOWED_REVERB_MIN_SPEED\": 0.25,\n            \"SLOWED_REVERB_MAX_SPEED\": 4.0,\n            \"SLOWED_REVERB_MIN_PITCH\": -2400.0,\n            \"SLOWED_REVERB_MAX_PITCH\": 2400.0,\n            \"SLOWED_REVERB_MIN_REVERB\": 0.0,\n            \"SLOWED_REVERB_MAX_REVERB\": 100.0\n        ])\n    }\n}\n\n\nstruct PlayAudioPlaybackOptions: Record {\n    @Field var url: String\n    @Field var title: String\n    @Field var artist: String\n    @Field var artwork: String?\n    @Field var duration: Double?\n    @Field var album: String?\n    @Field var description: String?\n    @Field var isLive: Bool\n    @Field var useSpatialAudio: Bool\n    @Field var shouldDownload: Bool\n}\n\n",
>   "encoding": "utf-8",
>   "sha": "938a29e36adfc1be3ec4628bae242d15e266796d",
>   "display_url": "https://github.com/rit3zh/expo-ios-sonic-player/blob/main/ios/ExpoNativeiOSSonicPlayerModule.swift",
>   "display_title": "ExpoNativeiOSSonicPlayerModule.swift"
> }
> ```
>
> MCP tool call
>
> codex_apps.github.fetch_file
>
> ```json
> {
>   "repository_full_name": "rit3zh/expo-ios-sonic-player",
>   "path": "ios/AudioPlayer.swift"
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "content": "import Foundation\nimport AVFoundation\nimport MediaPlayer\nimport UIKit\n\nclass AudioPlayer: NSObject {\n\n    // MARK: - Audio Engine Components\n    private let audioEngine = AVAudioEngine()\n    private let playerNode = AVAudioPlayerNode()\n    private let eq = AVAudioUnitEQ(numberOfBands: 10)\n    private let environmentNode = AVAudioEnvironmentNode()\n    private let reverb = AVAudioUnitReverb()\n    private let delay = AVAudioUnitDelay()\n    private let distortion = AVAudioUnitDistortion()\n    private let timePitch = AVAudioUnitTimePitch()\n    private let compressor = AVAudioUnitEffect(audioComponentDescription:\n        AudioComponentDescription(\n            componentType: kAudioUnitType_Effect,\n            componentSubType: kAudioUnitSubType_DynamicsProcessor,\n            componentManufacturer: kAudioUnitManufacturer_Apple,\n            componentFlags: 0,\n            componentFlagsMask: 0\n        )\n    )\n\n    // MARK: - Playback Properties\n    private var audioFile: AVAudioFile?\n    private var isPlaying = false\n    private var isPaused = false\n    private var isUsingAVPlayer: Bool = false\n    private var nativeSpatialPlayer: AVPlayer?\n    \n    \n    \n    private var currentFrame: AVAudioFramePosition = 0\n    private var totalFrames: AVAudioFramePosition = 0\n    \n    // MARK: - Interruption Properties (FIXED)\n    private var wasPlayingBeforeInterruption = false\n    private var shouldResumeAfterInterruption = false\n    private var interruptionStartTime: CFTimeInterval = 0\n    private var isHandlingInterruption = false\n    private var engineNeedsRestart = false\n\n    // MARK: - Filter Properties\n    private let bandFrequencies: [Float] = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]\n    private let maxGain: Float = 12.0\n    private let minGain: Float = -12.0\n    private var isSpatialAudioEnabled = false\n    \n    // MARK: - Slowed Reverb Properties\n    private var isSlowedReverbEnabled = false\n    private var currentSlowedReverbPreset: SlowedReverbPreset = .classic\n\n    // MARK: - Callbacks\n    var onProgress: ((Double) -> Void)?\n    var onStatusChange: ((String) -> Void)?\n    var onPlaybackInfo: ((Double, Double, Bool) -> Void)?\n    var onMediaControlEvent: ((String, [String: Any]) -> Void)?\n\n    // MARK: - Timer for progress updates\n    private var progressTimer: Timer?\n\n    override init() {\n        super.init()\n        setupAudioEngine()\n        setupEqualizer()\n        setupAudioSession()\n        setupSpatialAudio()\n//        setupAudioInterruptionObserver()\n    }\n\n    deinit {\n        // Clean up observers\n        NotificationCenter.default.removeObserver(self)\n        stop()\n        audioEngine.stop()\n        progressTimer?.invalidate()\n    }\n\n    // MARK: - Audio Engine Setup\n    \n    \n    private func setupAudioEngine() {\n        // Attach all nodes\n        audioEngine.attach(playerNode)\n        audioEngine.attach(eq)\n        audioEngine.attach(timePitch)\n        audioEngine.attach(reverb)\n        audioEngine.attach(delay)\n        audioEngine.attach(distortion)\n        audioEngine.attach(compressor)\n        audioEngine.attach(environmentNode)\n        \n        // Use mono format for spatial audio\n        let outputFormat = audioEngine.outputNode.inputFormat(forBus: 0)\n        let monoFormat = AVAudioFormat(standardFormatWithSampleRate: outputFormat.sampleRate, channels: 1)!\n\n        // Connect nodes with spatial audio in mind\n        audioEngine.connect(playerNode, to: eq, format: monoFormat)\n        audioEngine.connect(eq, to: timePitch, format: monoFormat)\n        audioEngine.connect(timePitch, to: reverb, format: monoFormat)\n        audioEngine.connect(reverb, to: delay, format: monoFormat)\n        audioEngine.connect(delay, to: distortion, format: monoFormat)\n        audioEngine.connect(distortion, to: compressor, format: monoFormat)\n        audioEngine.connect(compressor, to: environmentNode, format: monoFormat)\n        audioEngine.connect(environmentNode, to: audioEngine.mainMixerNode, format: nil)\n\n        // Set rendering algorithm\n        if #available(iOS 15.0, *) {\n            playerNode.renderingAlgorithm = .HRTFHQ\n        } else {\n            playerNode.renderingAlgorithm = .HRTF\n        }\n\n        // Set position for spatial sound\n        playerNode.position = AVAudio3DPoint(x: 0, y: 0, z: -2)\n        environmentNode.listenerPosition = AVAudio3DPoint(x: 0, y: 0, z: 0)\n        environmentNode.listenerAngularOrientation = AVAudioMake3DAngularOrientation(0, 0, 0)\n\n        setupInitialEffectStates()\n        startAudioEngine()\n    }\n\n    \n//    private func setupAudioEngine() {\n//        // Attach all nodes first\n//        audioEngine.attach(playerNode)\n//        audioEngine.attach(eq)\n//        audioEngine.attach(timePitch)\n//        audioEngine.attach(reverb)\n//        audioEngine.attach(delay)\n//        audioEngine.attach(distortion)\n//        audioEngine.attach(compressor)\n//        audioEngine.attach(environmentNode)\n//\n//        // Get the output format\n//        let outputFormat = audioEngine.outputNode.inputFormat(forBus: 0)\n//\n//        // Create the initial connection chain (without spatial audio)\n//        audioEngine.connect(playerNode, to: eq, format: outputFormat)\n//        audioEngine.connect(eq, to: timePitch, format: outputFormat)\n//        audioEngine.connect(timePitch, to: reverb, format: outputFormat)\n//        audioEngine.connect(reverb, to: delay, format: outputFormat)\n//        audioEngine.connect(delay, to: distortion, format: outputFormat)\n//        audioEngine.connect(distortion, to: compressor, format: outputFormat)\n//        audioEngine.connect(compressor, to: audioEngine.mainMixerNode, format: outputFormat)\n//\n//        // Initialize effects\n//        setupInitialEffectStates()\n//\n//        startAudioEngine()\n//    }\n    \n    // MARK: - Audio Engine Management (FIXED)\n    private func startAudioEngine() {\n        // Only start engine if not using AVPlayer\n        guard !isUsingAVPlayer else { return }\n        guard !audioEngine.isRunning else { return }\n        \n        do {\n            try audioEngine.start()\n            print(\"✅ Audio engine started successfully\")\n            engineNeedsRestart = false\n        } catch {\n            print(\"❌ Failed to start audio engine: \\(error)\")\n            engineNeedsRestart = true\n            onStatusChange?(\"error\")\n        }\n    }\n    \n    private func stopAudioEngine() {\n        if audioEngine.isRunning {\n            audioEngine.stop()\n            print(\"🛑 Audio engine stopped\")\n        }\n    }\n    \n    private func restartAudioEngineIfNeeded() {\n        // Skip if using AVPlayer\n        guard !isUsingAVPlayer else { return }\n        \n        if engineNeedsRestart || !audioEngine.isRunning {\n            print(\"🔄 Restarting audio engine...\")\n            \n            // Stop and reset\n            stopAudioEngine()\n            \n            // Small delay to let the system clean up\n            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {\n                self.startAudioEngine()\n            }\n        }\n    }\n    \n    private func setupSpatialAudio() {\n        // Configure listener\n        environmentNode.listenerPosition = AVAudio3DPoint(x: 0, y: 0, z: 0)\n        environmentNode.listenerAngularOrientation = AVAudioMake3DAngularOrientation(0, 0, 0)\n\n        // Player position in 3D space\n        playerNode.position = AVAudio3DPoint(x: 0, y: 0, z: -2)\n\n        // Rendering algorithm\n        if #available(iOS 15.0, *) {\n            environmentNode.renderingAlgorithm = .HRTFHQ\n        } else {\n            environmentNode.renderingAlgorithm = .sphericalHead\n        }\n\n        // Configure distance model\n        environmentNode.distanceAttenuationParameters.maximumDistance = 10000\n        environmentNode.distanceAttenuationParameters.referenceDistance = 1\n        environmentNode.distanceAttenuationParameters.rolloffFactor = 1\n\n        print(\"✅ Spatial audio setup complete\")\n    }\n\n    private func setupInitialEffectStates() {\n        // Disable all effects initially\n        reverb.wetDryMix = 0\n        delay.wetDryMix = 0\n        distortion.wetDryMix = 0\n        compressor.bypass = true\n\n        // Initialize time pitch\n        timePitch.rate = 1.0\n        timePitch.pitch = 0.0\n        timePitch.overlap = 8.0\n\n        // Initialize all EQ bands to 0dB\n        for i in 0..<eq.bands.count {\n            eq.bands[i].gain = 0\n            eq.bands[i].bypass = false\n        }\n    }\n\n    private func setupEqualizer() {\n        for (index, band) in eq.bands.enumerated() {\n            band.filterType = .parametric\n            band.frequency = bandFrequencies[safe: index] ?? 1000\n            band.bandwidth = 1.0\n            band.gain = 0.0\n            band.bypass = false\n        }\n        eq.globalGain = 0\n    }\n\n    private func setupAudioSession() {\n        do {\n            let session = AVAudioSession.sharedInstance()\n            \n            // Configure for spatial audio support with proper options\n            try session.setCategory(.playback,\n                                    mode: .default,\n                                    options: [.allowAirPlay, .allowBluetoothA2DP, .defaultToSpeaker, .duckOthers, .interruptSpokenAudioAndMixWithOthers])\n        \n            // Enable spatial audio if available (iOS 14+)\n            if #available(iOS 14.0, *) {\n                try session.setSupportsMultichannelContent(true)\n            }\n            \n            try session.setActive(true)\n            \n            print(\"✅ Audio session configured for spatial audio\")\n        } catch {\n            print(\"❌ Failed to setup audio session: \\(error)\")\n        }\n    }\n\n    // MARK: - Audio Interruption Handling (COMPLETELY FIXED)\n    private func setupAudioInterruptionObserver() {\n        let center = NotificationCenter.default\n        let session = AVAudioSession.sharedInstance()\n        \n        // Remove any existing observers first\n        center.removeObserver(self, name: AVAudioSession.interruptionNotification, object: session)\n        center.removeObserver(self, name: AVAudioSession.routeChangeNotification, object: session)\n        \n        // Add new observers\n        center.addObserver(self,\n                           selector: #selector(handleAudioInterruption),\n                           name: AVAudioSession.interruptionNotification,\n                           object: session)\n\n        center.addObserver(self,\n                           selector: #selector(handleRouteChange),\n                           name: AVAudioSession.routeChangeNotification,\n                           object: session)\n\n        print(\"✅ Audio interruption + route observers set up\")\n    }\n    \n   \n    \n    private func handleInterruptionBegan() {\n        guard !isHandlingInterruption else { return }\n        \n        isHandlingInterruption = true\n        interruptionStartTime = CACurrentMediaTime()\n        \n        print(\"🔇 Audio interruption began\")\n        \n        // Save current state\n        wasPlayingBeforeInterruption = isPlaying\n        shouldResumeAfterInterruption = isPlaying\n        \n        // Stop playback gracefully based on player type\n        if isPlaying {\n            if isUsingAVPlayer {\n                nativeSpatialPlayer?.pause()\n            } else {\n                // Stop player node but keep track of position\n                playerNode.stop()\n            }\n            \n            stopProgressUpdates()\n            isPlaying = false\n            isPaused = true\n            \n            print(\"⏸️ Paused due to audio interruption\")\n        }\n        \n        // Mark engine as needing restart (only for AVAudioEngine)\n        if !isUsingAVPlayer {\n            engineNeedsRestart = true\n        }\n        \n        onStatusChange?(\"interrupted\")\n    }\n    \n    private func handleInterruptionEnded(_ userInfo: [AnyHashable: Any]) {\n        guard isHandlingInterruption else { return }\n        \n        print(\"🔊 Audio interruption ended\")\n        \n        var shouldResume = false\n        \n        // Check if system suggests we should resume\n        if let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt {\n            let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)\n            shouldResume = options.contains(.shouldResume)\n        }\n        \n        // Calculate interruption duration\n        let interruptionDuration = CACurrentMediaTime() - interruptionStartTime\n        print(\"⏱️ Interruption lasted: \\(interruptionDuration) seconds\")\n        \n        // Re-activate audio session\n        do {\n            let session = AVAudioSession.sharedInstance()\n            try session.setActive(false, options: .notifyOthersOnDeactivation)\n            try session.setActive(true)\n            print(\"✅ Audio session reactivated after interruption\")\n        } catch {\n            print(\"❌ Failed to reactivate audio session: \\(error)\")\n            onStatusChange?(\"session_error\")\n            isHandlingInterruption = false\n            return\n        }\n        \n        // Restart audio engine if needed (only for AVAudioEngine)\n        if !isUsingAVPlayer {\n            restartAudioEngineIfNeeded()\n        }\n        \n        // Resume playback if appropriate\n        if shouldResumeAfterInterruption && (shouldResume || wasPlayingBeforeInterruption) {\n            // Add a small delay to ensure system is ready\n            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {\n                if self.isUsingAVPlayer {\n                    self.nativeSpatialPlayer?.play()\n                    self.isPlaying = true\n                    self.isPaused = false\n                    self.startProgressUpdates()\n                } else {\n                    self.resumeAfterInterruption()\n                }\n                \n                self.onStatusChange?(\"resumed_after_interruption\")\n                print(\"🎵 Resumed after interruption\")\n            }\n        }\n        \n        // Clean up interruption state\n        wasPlayingBeforeInterruption = false\n        shouldResumeAfterInterruption = false\n        isHandlingInterruption = false\n    }\n    \n    private func resumeAfterInterruption() {\n        if isUsingAVPlayer {\n            guard let player = nativeSpatialPlayer else { return }\n            player.play()\n            isPlaying = true\n            isPaused = false\n            startProgressUpdates()\n            updateNowPlayingProgress()\n            return\n        }\n        \n        // AVAudioEngine resume logic\n        guard let audioFile = audioFile, !isPlaying else { return }\n        \n        do {\n            // Ensure audio engine is running\n            if !audioEngine.isRunning {\n                try audioEngine.start()\n            }\n            \n            // Reset player node\n            playerNode.stop()\n            playerNode.reset()\n            \n            // Re-schedule from current position\n            if currentFrame < totalFrames {\n                scheduleAudioFileFromPosition(currentFrame)\n            }\n            \n            // Resume playback\n            playerNode.play()\n            isPlaying = true\n            isPaused = false\n            \n            startProgressUpdates()\n            updateNowPlayingProgress()\n            \n            print(\"▶️ Successfully resumed after interruption\")\n            \n        } catch {\n            print(\"❌ Failed to resume after interruption: \\(error)\")\n            onStatusChange?(\"resume_error\")\n        }\n    }\n    \n    @objc private func handleRouteChange(_ notification: Notification) {\n        guard let userInfo = notification.userInfo,\n              let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,\n              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {\n            return\n        }\n\n        switch reason {\n        case .oldDeviceUnavailable:\n            print(\"🎧 Output device disconnected (e.g. headphones unplugged)\")\n            if isPlaying {\n                pause()\n                onStatusChange?(\"route_changed_paused\")\n            }\n\n        case .newDeviceAvailable:\n            print(\"🎧 New audio device available\")\n            // Engine might need restart for new device (only for AVAudioEngine)\n            if !isUsingAVPlayer {\n                engineNeedsRestart = true\n            }\n\n        case .categoryChange:\n            print(\"🔄 Audio category changed\")\n            if !isUsingAVPlayer {\n                engineNeedsRestart = true\n            }\n\n        default:\n            break\n        }\n    }\n    \n    \n    // Helper method to get current playback time\n    private func getCurrentPlaybackTime() -> Double {\n        if isUsingAVPlayer {\n            let time = nativeSpatialPlayer?.currentTime().seconds ?? 0\n            return max(0, time.isFinite ? time : 0)\n        }\n\n        guard let audioFile = audioFile else { return 0 }\n        let sampleRate = audioFile.processingFormat.sampleRate\n        let time = Double(currentFrame) / sampleRate\n        return max(0, min(time, Double(totalFrames) / sampleRate))\n    }\n    \n    func setSpatialAudioPosition(x: Float, y: Float, z: Float) {\n        if isUsingAVPlayer {\n            print(\"⚠️ Spatial audio positioning not available for AVPlayer\")\n            return\n        }\n        \n        guard isSpatialAudioEnabled else {\n            print(\"⚠️ Spatial audio is not enabled\")\n            return\n        }\n        \n        let position = AVAudio3DPoint(x: x, y: y, z: z)\n        playerNode.position = position\n        \n        print(\"🎯 Spatial audio position set to: (\\(x), \\(y), \\(z))\")\n    }\n\n    // MARK: - Playback Control (IMPROVED)\n    func play(options: AudioPlaybackOptions, useAVPlayerSpatial: Bool = false) {\n        // Reset interruption state\n        isHandlingInterruption = false\n        \n        // Request audio focus to stop other apps\n        requestAudioFocus()\n        \n        isUsingAVPlayer = useAVPlayerSpatial\n        \n        guard let audioURL = URL(string: options.url) else {\n            onStatusChange?(\"error\")\n            return\n        }\n        \n        \n        \n        if options.isLive {\n              print(\"🔴 Live stream detected - using AVPlayer\")\n              isUsingAVPlayer = true\n              playWithAVPlayer(url: audioURL)\n              return updateNowPlayingInfo(\n                title: options.title,\n                artist: options.artist,\n                artworkURL: options.artwork,\n                duration: options.duration ?? 0,\n                album: options.album,\n                description: options.description,\n                isLive: options.isLive\n            )\n          }\n        \n\n        if useAVPlayerSpatial {\n            playWithAVPlayer(url: audioURL)\n            return updateNowPlayingInfo(\n                title: options.title,\n                artist: options.artist,\n                artworkURL: options.artwork,\n                duration: options.duration ?? 0,\n                album: options.album,\n                description: options.description,\n                isLive: options.isLive\n            )\n        }\n        \n        updateNowPlayingInfo(\n            title: options.title,\n            artist: options.artist,\n            artworkURL: options.artwork,\n            duration: options.duration ?? 0,\n            album: options.album,\n            description: options.description,\n            isLive: options.isLive\n        )\n\n        if audioURL.scheme == \"http\" || audioURL.scheme == \"https\" {\n            onStatusChange?(\"loading\")\n            downloadAudioFile(from: options.url) { [weak self] localURL in\n                guard let self = self, let localURL = localURL else {\n                    self?.onStatusChange?(\"error\")\n                    return\n                }\n                DispatchQueue.main.async {\n                    self.playLocalFile(url: localURL)\n                    if options.duration == nil {\n                        let actual = self.getActualTrackDuration()\n                        self.updateNowPlayingInfo(\n                            title: options.title,\n                            artist: options.artist,\n                            artworkURL: options.artwork,\n                            duration: actual,\n                            album: options.album,\n                            description: options.description,\n                            isLive: options.isLive\n                        )\n                    }\n                }\n            }\n        } else {\n            playLocalFile(url: audioURL)\n        }\n    }\n    \n    private func playWithAVPlayer(url: URL) {\n        stop()\n\n        let asset = AVURLAsset(url: url)\n        let item = AVPlayerItem(asset: asset)\n\n        // ✅ Just check if it's a live stream from the options\n        if isUsingAVPlayer {\n            // Configure for streaming (live or spatial)\n            item.preferredForwardBufferDuration = 2.0\n            item.canUseNetworkResourcesForLiveStreamingWhilePaused = true\n            \n            if #available(iOS 15.0, *) {\n                item.allowedAudioSpatializationFormats = [.monoAndStereo, .multichannel]\n            }\n        }\n\n        let player = AVPlayer(playerItem: item)\n        nativeSpatialPlayer = player\n\n        // Add observers\n        NotificationCenter.default.addObserver(\n            self,\n            selector: #selector(handleAVPlayerDidFinishPlaying),\n            name: .AVPlayerItemDidPlayToEndTime,\n            object: item\n        )\n        \n        NotificationCenter.default.addObserver(\n            self,\n            selector: #selector(handleAVPlayerItemFailed),\n            name: .AVPlayerItemFailedToPlayToEndTime,\n            object: item\n        )\n\n        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)\n        try? AVAudioSession.sharedInstance().setActive(true)\n\n        player.play()\n\n        isPlaying = true\n        isPaused = false\n        startProgressUpdates()\n        onStatusChange?(\"ready\")\n    }\n\n    \n    @objc private func handleAVPlayerItemFailed(notification: Notification) {\n        print(\"❌ Live stream failed\")\n        isPlaying = false\n        isPaused = false\n        stopProgressUpdates()\n        onStatusChange?(\"error\")\n    }\n    \n    private func handleAudioFinished() {\n        print(\"✅ Playback finished\")\n\n        isPlaying = false\n        isPaused = false\n        currentFrame = totalFrames  // Lock it at the end\n        stopProgressUpdates()\n        updateProgress()\n        onStatusChange?(\"ended\")\n\n    }\n\n    \n    @objc private func handleAVPlayerDidFinishPlaying(notification: Notification) {\n        print(\"✅ AVPlayer finished playing\")\n\n        isPlaying = false\n        isPaused = false\n        stopProgressUpdates()\n        updateProgress()\n        onStatusChange?(\"ended in av player\")\n    }\n\n    \n    private func playLocalFile(url: URL) {\n        stop()\n\n        do {\n            audioFile = try AVAudioFile(forReading: url)\n            totalFrames = audioFile?.length ?? 0\n            currentFrame = 0\n\n            guard let audioFile = audioFile else {\n                onStatusChange?(\"error\")\n                return\n            }\n\n            restartAudioEngineIfNeeded()\n\n            // ✅ Schedule the file from disk instead of full-buffer loading\n            scheduleAudioFileFromPosition(currentFrame)\n\n            if !audioEngine.isRunning {\n                try audioEngine.start()\n            }\n\n            playerNode.play()\n            isPlaying = true\n            isPaused = false\n\n            onStatusChange?(\"ready\")\n            startProgressUpdates()\n\n        } catch {\n            print(\"❌ Failed to play audio file: \\(error)\")\n            onStatusChange?(\"error\")\n        }\n    }\n\n    func downloadAudioFile(from urlString: String, completion: @escaping (URL?) -> Void) {\n        guard let url = URL(string: urlString) else {\n            completion(nil)\n            return\n        }\n\n        let task = URLSession.shared.downloadTask(with: url) { (tempURL, response, error) in\n            guard let tempURL = tempURL, error == nil else {\n                print(\"Download error: \\(error?.localizedDescription ?? \"Unknown error\")\")\n                completion(nil)\n                return\n            }\n            completion(tempURL)\n        }\n        task.resume()\n    }\n\n    func pause() {\n        guard isPlaying && !isHandlingInterruption else { return }\n        \n        if isUsingAVPlayer {\n            nativeSpatialPlayer?.pause()\n        } else {\n            // Don't call playerNode.stop() here, just pause\n            playerNode.pause()\n        }\n        \n        isPaused = true\n        isPlaying = false\n        stopProgressUpdates()\n        updateProgress()\n        updateNowPlayingProgress()\n    }\n\n    func resume() {\n        guard isPaused && !isHandlingInterruption else { return }\n        \n        do {\n            try AVAudioSession.sharedInstance().setActive(true)\n\n            if isUsingAVPlayer {\n                // ✅ For live streams, check if player item is still valid\n                guard let player = nativeSpatialPlayer else {\n                    print(\"❌ No AVPlayer instance for resume\")\n                    onStatusChange?(\"resume_error_no_player\")\n                    return\n                }\n                \n                // ✅ Check if current item is still playable\n                if let currentItem = player.currentItem {\n                    if currentItem.status == .failed || currentItem.error != nil {\n                        print(\"🔄 Live stream item failed, recreating...\")\n                        // ✅ For live streams, recreate the player item\n                        if let url = (currentItem.asset as? AVURLAsset)?.url {\n                            playWithAVPlayer(url: url)\n                            return\n                        }\n                    } else {\n                        // ✅ Item is good, just resume\n                        player.play()\n                    }\n                } else {\n                    print(\"❌ No current item in AVPlayer\")\n                    onStatusChange?(\"resume_error_no_item\")\n                    return\n                }\n                \n                isPlaying = true\n                isPaused = false\n                startProgressUpdates()\n                updateNowPlayingProgress()\n                return\n            }\n\n            guard let audioFile = audioFile else {\n                print(\"❌ No audio file loaded for resume\")\n                onStatusChange?(\"resume_error_no_file\")\n                return\n            }\n\n            restartAudioEngineIfNeeded()\n\n            if !playerNode.isPlaying {\n                playerNode.stop()\n                playerNode.reset()\n\n                if currentFrame >= totalFrames {\n                    currentFrame = 0\n                }\n\n                scheduleAudioFileFromPosition(currentFrame)\n            }\n\n            playerNode.play()\n            isPaused = false\n            isPlaying = true\n            startProgressUpdates()\n            updateNowPlayingProgress()\n            print(\"▶️ Player resumed successfully\")\n\n        } catch {\n            print(\"❌ Failed to resume playback: \\(error)\")\n            onStatusChange?(\"resume_error\")\n        }\n    }\n\n    func stop() {\n        if isUsingAVPlayer {\n            if let player = nativeSpatialPlayer {\n                player.pause()\n                if let item = player.currentItem {\n                    NotificationCenter.default.removeObserver(self, name: .AVPlayerItemDidPlayToEndTime, object: item)\n                }\n                // Completely reset AVPlayer\n                player.replaceCurrentItem(with: nil)\n            }\n            nativeSpatialPlayer = nil\n        } else {\n            playerNode.stop()\n        }\n        \n        isPlaying = false\n        isPaused = false\n        currentFrame = 0\n        stopProgressUpdates()\n        updateProgress()\n        \n        // Clear Now Playing Info\n        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil\n        \n        do {\n            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)\n            print(\"🛑 Audio session deactivated\")\n        } catch {\n            print(\"❌ Failed to deactivate audio session: \\(error)\")\n        }\n    }\n\n\n    // MARK: - Seeking (IMPROVED)\n   \n    func seek(to seconds: Double) {\n        guard !isHandlingInterruption else { return }\n        \n        if isUsingAVPlayer {\n            let time = CMTime(seconds: seconds, preferredTimescale: CMTimeScale(NSEC_PER_SEC))\n            nativeSpatialPlayer?.seek(to: time) { [weak self] _ in\n                self?.updateProgress()\n                self?.updateNowPlayingProgress()\n                self?.onStatusChange?(\"seeked\")\n            }\n            return\n        }\n\n        guard let audioFile = audioFile else { return }\n\n        let sampleRate = audioFile.processingFormat.sampleRate\n        let targetFrame = AVAudioFramePosition(seconds * sampleRate)\n\n        guard targetFrame >= 0 && targetFrame < totalFrames else { return }\n\n        let wasPlaying = isPlaying\n\n        // Stop and reset player node\n        playerNode.stop()\n        playerNode.reset()\n        \n        // Update current frame\n        currentFrame = targetFrame\n        \n        // Only reschedule if we're not at the very end\n        if targetFrame < totalFrames - 1000 {\n            scheduleAudioFileFromPosition(targetFrame)\n            \n            if wasPlaying && !isHandlingInterruption {\n                playerNode.play()\n                isPlaying = true\n                isPaused = false\n            } else {\n                isPaused = true\n                isPlaying = false\n            }\n        } else {\n            // We're at the end, handle accordingly\n            handleAudioFinished()\n            return\n        }\n\n        updateProgress()\n        updateNowPlayingProgress()\n        onStatusChange?(\"seeked\")\n    }\n\n\n    private func scheduleAudioFileFromPosition(_ startFrame: AVAudioFramePosition) {\n        guard let audioFile = audioFile else { return }\n        \n        let framesToPlay = totalFrames - startFrame\n        guard framesToPlay > 0 else { return }\n        \n        // Clear any existing scheduled buffers first\n        playerNode.stop()\n        \n        playerNode.scheduleSegment(\n            audioFile,\n            startingFrame: startFrame,\n            frameCount: AVAudioFrameCount(framesToPlay),\n            at: nil,\n            completionHandler: { [weak self] in\n                // Only trigger finished if we actually played to the end\n                guard let self = self else { return }\n                \n                DispatchQueue.main.async {\n                    // Check if we're actually at the end and not just seeking\n                    if self.currentFrame >= self.totalFrames - 1000 { // Small buffer for rounding\n                        self.handleAudioFinished()\n                    }\n                }\n            }\n        )\n    }\n\n    // MARK: - Progress Updates\n    private func startProgressUpdates() {\n        progressTimer?.invalidate()\n        progressTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in\n            self?.updateProgress()\n        }\n    }\n\n    private func stopProgressUpdates() {\n        progressTimer?.invalidate()\n        progressTimer = nil\n        \n    }\n\n    private func updateProgress() {\n        if isUsingAVPlayer {\n            guard let player = nativeSpatialPlayer,\n                  let currentItem = player.currentItem else { return }\n\n            let currentTimeSeconds = player.currentTime().seconds\n            let totalTimeSeconds = currentItem.duration.seconds.isFinite ? currentItem.duration.seconds : 0\n\n            onPlaybackInfo?(currentTimeSeconds, totalTimeSeconds, isPlaying)\n            return\n        }\n\n        // AVAudioEngine - Update currentFrame based on actual playback\n        guard let audioFile = audioFile else { return }\n        \n        let sampleRate = audioFile.processingFormat.sampleRate\n        let totalTimeSeconds = Double(totalFrames) / sampleRate\n        \n        // Update currentFrame if playing\n        if isPlaying && !isPaused {\n            let frameAdvance = AVAudioFramePosition(sampleRate * 0.1 * Double(timePitch.rate))\n            currentFrame += frameAdvance\n            \n            // Prevent going beyond total frames\n            if currentFrame >= totalFrames {\n                currentFrame = totalFrames\n                handleAudioFinished()\n                return\n            }\n        }\n        \n        let currentTimeSeconds = Double(currentFrame) / sampleRate\n        onPlaybackInfo?(currentTimeSeconds, totalTimeSeconds, isPlaying)\n    }\n\n    private func requestAudioFocus() {\n        do {\n            let session = AVAudioSession.sharedInstance()\n            try session.setActive(false, options: .notifyOthersOnDeactivation)\n            try session.setActive(true)\n            print(\"🎯 Audio focus requested\")\n        } catch {\n            print(\"❌ Failed to request audio focus: \\(error)\")\n        }\n    }\n\n    // MARK: - Slowed Reverb Implementation\n    func enableSlowedReverb() {\n        isSlowedReverbEnabled = true\n        applySlowedReverbPreset(currentSlowedReverbPreset)\n    }\n\n    func disableSlowedReverb() {\n        isSlowedReverbEnabled = false\n        timePitch.rate = 1.0\n        timePitch.pitch = 0.0\n        reverb.wetDryMix = 0\n        delay.wetDryMix = 0\n    }\n\n    func toggleSlowedReverb() {\n        if isSlowedReverbEnabled {\n            disableSlowedReverb()\n        } else {\n            enableSlowedReverb()\n        }\n    }\n\n    func setSlowedReverb(speed: Float, pitch: Float, reverbAmount: Float) {\n        timePitch.rate = speed\n        timePitch.pitch = pitch\n        reverb.wetDryMix = reverbAmount\n    }\n\n    func applySlowedReverbPreset(_ preset: SlowedReverbPreset) {\n        currentSlowedReverbPreset = preset\n        guard isSlowedReverbEnabled else { return }\n        \n        let presetInfo = getSlowedReverbPresetInfo(preset)\n        \n        timePitch.rate = presetInfo.speed\n        timePitch.pitch = presetInfo.pitch\n        reverb.wetDryMix = presetInfo.reverbAmount\n        reverb.loadFactoryPreset(.largeHall)\n        delay.wetDryMix = presetInfo.delayAmount\n        delay.delayTime = presetInfo.delayTime\n        delay.feedback = presetInfo.delayFeedback\n    }\n\n    func getAvailableSlowedReverbPresets() -> [SlowedReverbPreset] {\n        return [.classic, .dreamy, .subtle, .heavy]\n    }\n\n    func getSlowedReverbPresetInfo(_ preset: SlowedReverbPreset) -> SlowedReverbPresetInfo {\n        switch preset {\n        case .classic:\n            return SlowedReverbPresetInfo(\n                name: .classic, speed: 0.8, pitch: -200, reverbAmount: 40,\n                delayAmount: 15, delayTime: 0.3, delayFeedback: 25,\n                description: \"Classic slowed + reverb with moderate slow down and rich reverb\"\n            )\n        case .dreamy:\n            return SlowedReverbPresetInfo(\n                name: .dreamy, speed: 0.7, pitch: -400, reverbAmount: 60,\n                delayAmount: 25, delayTime: 0.5, delayFeedback: 35,\n                description: \"Dreamy atmosphere with heavy reverb and significant slowdown\"\n            )\n        case .subtle:\n            return SlowedReverbPresetInfo(\n                name: .subtle, speed: 0.9, pitch: -100, reverbAmount: 25,\n                delayAmount: 10, delayTime: 0.2, delayFeedback: 15,\n                description: \"Subtle slowed effect with light reverb\"\n            )\n        case .heavy:\n            return SlowedReverbPresetInfo(\n                name: .heavy, speed: 0.6, pitch: -600, reverbAmount: 80,\n                delayAmount: 40, delayTime: 0.7, delayFeedback: 45,\n                description: \"Heavy slowed + reverb with maximum atmospheric effect\"\n            )\n        }\n    }\n\n    \n   \n    \n    \n    @objc private func handleAudioInterruption(_ notification: Notification) {\n        guard let userInfo = notification.userInfo,\n              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,\n              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {\n            return\n        }\n        \n        switch type {\n        case .began:\n            print(\"🔇 Audio interruption began\")\n            handleInterruptionBegan()\n            \n        case .ended:\n            print(\"🔊 Audio interruption ended\")\n            handleInterruptionEnded(userInfo)\n            \n        @unknown default:\n            break\n        }\n    }\n    // MARK: - Initialize function\n    \n    func initialize(options: PlayerInitializationOptions) {\n        \n      \n        \n        guard options.enableRemoteControls else { return }\n        \n        \n        \n\n        let commandCenter = MPRemoteCommandCenter.shared()\n        \n        commandCenter.changePlaybackPositionCommand.isEnabled = true\n        commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in\n            guard let event = event as? MPChangePlaybackPositionCommandEvent else {\n                return .commandFailed\n            }\n\n            let position = event.positionTime\n            self?.seek(to: position)\n            self?.onMediaControlEvent?(\"onSeekFromLockScreen\", [\"position\": position])\n            return .success\n        }\n\n        commandCenter.playCommand.isEnabled = true\n        commandCenter.playCommand.addTarget { [weak self] _ in\n            self?.resume()\n            self?.onMediaControlEvent?(\"onPlayPressed\", [:])\n            return .success\n        }\n\n        commandCenter.pauseCommand.isEnabled = true\n        commandCenter.pauseCommand.addTarget { [weak self] _ in\n            self?.pause()\n            self?.onMediaControlEvent?(\"onPausePressed\", [:])\n            return .success\n        }\n\n        if let forward = options.skipForwardSeconds {\n            commandCenter.skipForwardCommand.isEnabled = true\n            commandCenter.skipForwardCommand.preferredIntervals = [NSNumber(value: forward)]\n            commandCenter.skipForwardCommand.addTarget { [weak self] event in\n                if let skipEvent = event as? MPSkipIntervalCommandEvent {\n                    let current = self?.getCurrentPlaybackTime() ?? 0\n                    self?.seek(to: current + skipEvent.interval)\n                    self?.onMediaControlEvent?(\"onSkipForward\", [\"seconds\": skipEvent.interval])\n                    return .success\n                }\n                return .commandFailed\n            }\n        }\n\n        if let back = options.skipBackwardSeconds {\n            commandCenter.skipBackwardCommand.isEnabled = true\n            commandCenter.skipBackwardCommand.preferredIntervals = [NSNumber(value: back)]\n            commandCenter.skipBackwardCommand.addTarget { [weak self] event in\n                if let skipEvent = event as? MPSkipIntervalCommandEvent {\n                    let current = self?.getCurrentPlaybackTime() ?? 0\n                    self?.seek(to: max(0, current - skipEvent.interval))\n                    self?.onMediaControlEvent?(\"onSkipBackward\", [\"seconds\": skipEvent.interval])\n                    return .success\n                }\n                return .commandFailed\n            }\n        }\n\n        if options.enableNextTrack {\n            commandCenter.nextTrackCommand.isEnabled = true\n            commandCenter.nextTrackCommand.addTarget { [weak self] _ in\n                options.nextTrackCallback?()\n                self?.onMediaControlEvent?(\"onSkipToNext\", [:])\n                return .success\n            }\n        }\n\n        if options.enablePreviousTrack {\n            commandCenter.previousTrackCommand.isEnabled = true\n            commandCenter.previousTrackCommand.addTarget { [weak self] _ in\n                options.previousTrackCallback?()\n                self?.onMediaControlEvent?(\"onSkipToPrevious\", [:])\n                return .success\n            }\n        }\n\n        print(\"✅ Player initialized with remote controls\")\n    }\n    \n    // MARK: - Remote Transport Controls ⚠️\n\n    \n    func updateNowPlayingInfo(\n        title: String,\n        artist: String,\n        artworkURL: String?,\n        duration: Double,\n        album: String? = nil,\n        description: String? = nil,\n        isLive: Bool = false\n    ) {\n        // Fallback if duration is 0\n        var finalDuration = duration\n        if duration <= 0 {\n            finalDuration = getActualTrackDuration()\n        }\n\n        var nowPlayingInfo: [String: Any] = [\n            MPMediaItemPropertyTitle: title,\n            MPMediaItemPropertyArtist: artist,\n            MPMediaItemPropertyPlaybackDuration: finalDuration,\n            MPNowPlayingInfoPropertyElapsedPlaybackTime: 0,\n            MPNowPlayingInfoPropertyPlaybackRate: 1.0,\n            MPNowPlayingInfoPropertyIsLiveStream: isLive,\n            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue // ✅ Add this\n        ]\n\n        if let album = album {\n            nowPlayingInfo[MPMediaItemPropertyAlbumTitle] = album\n        }\n\n        if let desc = description {\n            nowPlayingInfo[\"description\"] = desc\n        }\n\n        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo\n\n        if let urlString = artworkURL, let url = URL(string: urlString) {\n            Task {\n                await loadArtwork(from: url)\n            }\n        }\n    }\n\n    private func loadArtwork(from url: URL) async {\n        do {\n            let (data, _) = try await URLSession.shared.data(from: url)\n            guard let image = UIImage(data: data) else { return }\n            \n            await MainActor.run {\n                let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }\n                var updatedInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]\n                updatedInfo[MPMediaItemPropertyArtwork] = artwork\n                MPNowPlayingInfoCenter.default().nowPlayingInfo = updatedInfo\n            }\n        } catch {\n            print(\"Failed to load artwork: \\(error)\")\n        }\n    }\n    \n    private func getActualTrackDuration() -> Double {\n        if isUsingAVPlayer {\n            guard let duration = nativeSpatialPlayer?.currentItem?.asset.duration else { return 0 }\n            return CMTimeGetSeconds(duration)\n        } else if let audioFile = audioFile {\n            let sampleRate = audioFile.processingFormat.sampleRate\n            return Double(audioFile.length) / sampleRate\n        }\n        return 0\n    }\n\n    \n    func updateNowPlayingProgress() {\n        guard var nowPlayingInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo else { return }\n\n        let currentTime = getCurrentPlaybackTime()\n        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime\n        nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0\n\n        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo\n    }\n\n    \n\n    // MARK: - Equalizer Controls\n    func setBandGain(band: Int, gain: Float) {\n        guard eq.bands.indices.contains(band) else { return }\n        eq.bands[band].gain = min(max(gain, minGain), maxGain)\n    }\n\n    func getBandGain(band: Int) -> Float? {\n        guard eq.bands.indices.contains(band) else { return nil }\n        return eq.bands[band].gain\n    }\n\n    func getAllBandGains() -> [Float] {\n        return eq.bands.map { $0.gain }\n    }\n\n    func resetEqualizer() {\n        for band in eq.bands {\n            band.gain = 0.0\n        }\n    }\n\n    // MARK: - Audio Effects\n    func setReverbWetDryMix(_ wetDryMix: Float) {\n        reverb.wetDryMix = min(max(wetDryMix, 0), 100)\n    }\n\n    func setReverbPreset(_ preset: AVAudioUnitReverbPreset) {\n        reverb.loadFactoryPreset(preset)\n    }\n\n    func setDelayTime(_ delayTime: TimeInterval) {\n        delay.delayTime = min(max(delayTime, 0), 2.0)\n    }\n\n    func setDelayFeedback(_ feedback: Float) {\n        delay.feedback = min(max(feedback, -100), 100)\n    }\n\n    func setDelayWetDryMix(_ wetDryMix: Float) {\n        delay.wetDryMix = min(max(wetDryMix, 0), 100)\n    }\n\n    func setDistortionPreset(_ preset: AVAudioUnitDistortionPreset) {\n        distortion.loadFactoryPreset(preset)\n    }\n\n    func setDistortionWetDryMix(_ wetDryMix: Float) {\n        distortion.wetDryMix = min(max(wetDryMix, 0), 100)\n    }\n\n    // MARK: - Preset Management\n    func applyEqualizerPreset(_ preset: EqualizerPreset) {\n        for (index, gain) in preset.bandGains.enumerated() {\n            setBandGain(band: index, gain: gain)\n        }\n    }\n    \n    func toggleAmbientMode(_ enabled: Bool) {\n        do {\n            let session = AVAudioSession.sharedInstance()\n\n            // Pause playback safely\n            let wasPlaying = isPlaying\n            pause()\n\n            // Set the desired category\n            if enabled {\n                try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])\n                print(\"🎧 Ambient mode enabled\")\n            } else {\n                try session.setCategory(.playback, mode: .default, options: [.allowAirPlay, .allowBluetoothA2DP, .defaultToSpeaker])\n                print(\"🎧 Playback mode enabled\")\n            }\n\n            try session.setActive(true)\n\n            // Resume playback safely\n            if wasPlaying {\n                resume()\n            }\n\n            onStatusChange?(\"ambientMode:\\(enabled)\")\n        } catch {\n            print(\"❌ Failed to toggle ambient mode: \\(error)\")\n            onStatusChange?(\"error\")\n        }\n    }\n    \n\n    func applyAudioPreset(_ preset: AudioPreset) {\n        applyEqualizerPreset(preset.equalizerPreset)\n        setReverbWetDryMix(preset.reverbWetDryMix)\n        setDelayWetDryMix(preset.delayWetDryMix)\n        setDistortionWetDryMix(preset.distortionWetDryMix)\n\n        if let reverbPreset = preset.reverbPreset {\n            setReverbPreset(reverbPreset)\n        }\n\n        if let distortionPreset = preset.distortionPreset {\n            setDistortionPreset(distortionPreset)\n        }\n\n        setDelayTime(preset.delayTime)\n        setDelayFeedback(preset.delayFeedback)\n    }\n}\n\n// MARK: - Supporting Types\nenum SlowedReverbPreset: String, CaseIterable {\n    case classic = \"classic\"\n    case dreamy = \"dreamy\"\n    case subtle = \"subtle\"\n    case heavy = \"heavy\"\n}\n\nstruct SlowedReverbPresetInfo {\n    let name: SlowedReverbPreset\n    let speed: Float\n    let pitch: Float\n    let reverbAmount: Float\n    let delayAmount: Float\n    let delayTime: TimeInterval\n    let delayFeedback: Float\n    let description: String\n}\n\nstruct AudioPreset {\n    let name: String\n    let equalizerPreset: EqualizerPreset\n    let reverbWetDryMix: Float\n    let reverbPreset: AVAudioUnitReverbPreset?\n    let delayTime: TimeInterval\n    let delayFeedback: Float\n    let delayWetDryMix: Float\n    let distortionWetDryMix: Float\n    let distortionPreset: AVAudioUnitDistortionPreset?\n\n    static let normal = AudioPreset(\n        name: \"Normal\", equalizerPreset: .flat, reverbWetDryMix: 0, reverbPreset: nil,\n        delayTime: 0, delayFeedback: 0, delayWetDryMix: 0, distortionWetDryMix: 0, distortionPreset: nil\n    )\n\n    static let concert = AudioPreset(\n        name: \"Concert\", equalizerPreset: .classical, reverbWetDryMix: 25, reverbPreset: .cathedral,\n        delayTime: 0.1, delayFeedback: 10, delayWetDryMix: 10, distortionWetDryMix: 0, distortionPreset: nil\n    )\n\n    static let studio = AudioPreset(\n        name: \"Studio\", equalizerPreset: .vocal, reverbWetDryMix: 5, reverbPreset: .smallRoom,\n        delayTime: 0.05, delayFeedback: 5, delayWetDryMix: 5, distortionWetDryMix: 0, distortionPreset: nil\n    )\n}\n\nstruct EqualizerPreset {\n    let name: String\n    let bandGains: [Float]\n\n    static let flat = EqualizerPreset(name: \"Flat\", bandGains: Array(repeating: 0.0, count: 10))\n    static let rock = EqualizerPreset(name: \"Rock\", bandGains: [3.0, 2.0, -1.0, -2.0, -1.0, 1.0, 4.0, 5.0, 5.0, 5.0])\n    static let pop = EqualizerPreset(name: \"Pop\", bandGains: [-1.0, 2.0, 4.0, 4.0, 2.0, 0.0, -1.0, -1.0, -1.0, -1.0])\n    static let jazz = EqualizerPreset(name: \"Jazz\", bandGains: [2.0, 1.0, 0.0, 1.0, -1.0, -1.0, 0.0, 1.0, 2.0, 3.0])\n    static let classical = EqualizerPreset(name: \"Classical\", bandGains: [3.0, 2.0, -1.0, -1.0, -1.0, 0.0, 1.0, 2.0, 3.0, 4.0])\n    static let bass = EqualizerPreset(name: \"Bass\", bandGains: [6.0, 5.0, 4.0, 2.0, 1.0, -1.0, -2.0, -3.0, -3.0, -3.0])\n    static let treble = EqualizerPreset(name: \"Treble\", bandGains: [-3.0, -3.0, -3.0, -2.0, -1.0, 1.0, 2.0, 4.0, 5.0, 6.0])\n    static let vocal = EqualizerPreset(name: \"Vocal\", bandGains: [-2.0, -1.0, 1.0, 3.0, 4.0, 4.0, 3.0, 1.0, 0.0, -1.0])\n}\n\n\nstruct AudioPlaybackOptions {\n    let url: String\n    let title: String\n    let artist: String\n    let artwork: String?\n    let duration: Double?\n    let album: String?\n    let description: String?\n    let isLive: Bool\n    let useSpatialAudio: Bool\n}\n\nprivate extension Array {\n    subscript(safe index: Int) -> Element? {\n        return indices.contains(index) ? self[index] : nil\n    }\n}\nstruct PlayerInitializationOptions {\n    let enableRemoteControls: Bool\n\n    // Skip Forward/Backward by seconds\n    let skipForwardSeconds: Double?\n    let skipBackwardSeconds: Double?\n\n    // Next/Previous track\n    let enableNextTrack: Bool\n    let enablePreviousTrack: Bool\n    let nextTrackCallback: (() -> Void)?\n    let previousTrackCallback: (() -> Void)?\n}\n\n",
>   "encoding": "utf-8",
>   "sha": "d84f1a2a639d5d9440fffc21f11d6a2e94fd2160",
>   "display_url": "https://github.com/rit3zh/expo-ios-sonic-player/blob/main/ios/AudioPlayer.swift",
>   "display_title": "AudioPlayer.swift"
> }
> ```
>
> Searched the web for `"react-native" "HRTF" library -site:reddit.com -site:arxiv.org -site:docs.swmansion.com -site:expo.dev ...`
>
> Searched the web for `ViroReact ViroSpatialSound HRTF Expo ...`
>
> MCP tool call
>
> codex_apps.github.search_repositories
>
> ```json
> {
>   "query": "react-native web audio api",
>   "per_page": 5
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "archive_filter_applied": null,
>   "repositories": [
>     {
>       "id": "823563404",
>       "name": "react-native-audio-api",
>       "owner": {
>         "login": "software-mansion",
>         "id": 56880679,
>         "type": "Organization",
>         "avatar_url": "https://avatars.githubusercontent.com/u/56880679?v=4",
>         "url": "https://api.github.com/users/software-mansion"
>       },
>       "repository_full_name": "software-mansion/react-native-audio-api",
>       "permissions": {
>         "admin": false,
>         "maintain": false,
>         "pull": true,
>         "push": false,
>         "triage": false
>       },
>       "allow_auto_merge": null,
>       "allow_merge_commit": null,
>       "allow_rebase_merge": null,
>       "allow_squash_merge": null,
>       "allow_update_branch": null,
>       "clone_url": "https://github.com/software-mansion/react-native-audio-api.git",
>       "size": 156366,
>       "default_branch": "main",
>       "git_commits_url": "https://api.github.com/repos/software-mansion/react-native-audio-api/git/commits{/sha}",
>       "git_refs_url": "https://api.github.com/repos/software-mansion/react-native-audio-api/git/refs{/sha}",
>       "git_url": "git://github.com/software-mansion/react-native-audio-api.git",
>       "master_branch": null,
>       "visibility": "public",
>       "archived": false,
>       "is_code_search_indexed": null,
>       "display_title": "software-mansion/react-native-audio-api",
>       "display_url": "https://github.com/software-mansion/react-native-audio-api"
>     },
>     {
>       "id": "593006919",
>       "name": "react-speech-highlight-demo",
>       "owner": {
>         "login": "albirrkarim",
>         "id": 29292018,
>         "type": "User",
>         "avatar_url": "https://avatars.githubusercontent.com/u/29292018?v=4",
>         "url": "https://api.github.com/users/albirrkarim"
>       },
>       "repository_full_name": "albirrkarim/react-speech-highlight-demo",
>       "permissions": {
>         "admin": false,
>         "maintain": false,
>         "pull": true,
>         "push": false,
>         "triage": false
>       },
>       "allow_auto_merge": null,
>       "allow_merge_commit": null,
>       "allow_rebase_merge": null,
>       "allow_squash_merge": null,
>       "allow_update_branch": null,
>       "clone_url": "https://github.com/albirrkarim/react-speech-highlight-demo.git",
>       "size": 136853,
>       "default_branch": "main",
>       "git_commits_url": "https://api.github.com/repos/albirrkarim/react-speech-highlight-demo/git/commits{/sha}",
>       "git_refs_url": "https://api.github.com/repos/albirrkarim/react-speech-highlight-demo/git/refs{/sha}",
>       "git_url": "git://github.com/albirrkarim/react-speech-highlight-demo.git",
>       "master_branch": null,
>       "visibility": "public",
>       "archived": false,
>       "is_code_search_indexed": null,
>       "display_title": "albirrkarim/react-speech-highlight-demo",
>       "display_url": "https://github.com/albirrkarim/react-speech-highlight-demo"
>     },
>     {
>       "id": "1393274268",
>       "name": "rn-web-audio-compat",
>       "owner": {
>         "login": "wwrinkle",
>         "id": 11656714,
>         "type": "User",
>         "avatar_url": "https://avatars.githubusercontent.com/u/11656714?v=4",
>         "url": "https://api.github.com/users/wwrinkle"
>       },
>       "repository_full_name": "wwrinkle/rn-web-audio-compat",
>       "permissions": {
>         "admin": false,
>         "maintain": false,
>         "pull": true,
>         "push": false,
>         "triage": false
>       },
>       "allow_auto_merge": null,
>       "allow_merge_commit": null,
>       "allow_rebase_merge": null,
>       "allow_squash_merge": null,
>       "allow_update_branch": null,
>       "clone_url": "https://github.com/wwrinkle/rn-web-audio-compat.git",
>       "size": 711,
>       "default_branch": "main",
>       "git_commits_url": "https://api.github.com/repos/wwrinkle/rn-web-audio-compat/git/commits{/sha}",
>       "git_refs_url": "https://api.github.com/repos/wwrinkle/rn-web-audio-compat/git/refs{/sha}",
>       "git_url": "git://github.com/wwrinkle/rn-web-audio-compat.git",
>       "master_branch": null,
>       "visibility": "public",
>       "archived": false,
>       "is_code_search_indexed": null,
>       "display_title": "wwrinkle/rn-web-audio-compat",
>       "display_url": "https://github.com/wwrinkle/rn-web-audio-compat"
>     },
>     {
>       "id": "1152077258",
>       "name": "react-native-soundpool-sfx",
>       "owner": {
>         "login": "psnet",
>         "id": 1023918,
>         "type": "User",
>         "avatar_url": "https://avatars.githubusercontent.com/u/1023918?v=4",
>         "url": "https://api.github.com/users/psnet"
>       },
>       "repository_full_name": "psnet/react-native-soundpool-sfx",
>       "permissions": {
>         "admin": false,
>         "maintain": false,
>         "pull": true,
>         "push": false,
>         "triage": false
>       },
>       "allow_auto_merge": null,
>       "allow_merge_commit": null,
>       "allow_rebase_merge": null,
>       "allow_squash_merge": null,
>       "allow_update_branch": null,
>       "clone_url": "https://github.com/psnet/react-native-soundpool-sfx.git",
>       "size": 157,
>       "default_branch": "main",
>       "git_commits_url": "https://api.github.com/repos/psnet/react-native-soundpool-sfx/git/commits{/sha}",
>       "git_refs_url": "https://api.github.com/repos/psnet/react-native-soundpool-sfx/git/refs{/sha}",
>       "git_url": "git://github.com/psnet/react-native-soundpool-sfx.git",
>       "master_branch": null,
>       "visibility": "public",
>       "archived": false,
>       "is_code_search_indexed": null,
>       "display_title": "psnet/react-native-soundpool-sfx",
>       "display_url": "https://github.com/psnet/react-native-soundpool-sfx"
>     },
>     {
>       "id": "812806937",
>       "name": "react-native-voice-visualizer",
>       "owner": {
>         "login": "saad189",
>         "id": 49253963,
>         "type": "User",
>         "avatar_url": "https://avatars.githubusercontent.com/u/49253963?v=4",
>         "url": "https://api.github.com/users/saad189"
>       },
>       "repository_full_name": "saad189/react-native-voice-visualizer",
>       "permissions": {
>         "admin": false,
>         "maintain": false,
>         "pull": true,
>         "push": false,
>         "triage": false
>       },
>       "allow_auto_merge": null,
>       "allow_merge_commit": null,
>       "allow_rebase_merge": null,
>       "allow_squash_merge": null,
>       "allow_update_branch": null,
>       "clone_url": "https://github.com/saad189/react-native-voice-visualizer.git",
>       "size": 363,
>       "default_branch": "main",
>       "git_commits_url": "https://api.github.com/repos/saad189/react-native-voice-visualizer/git/commits{/sha}",
>       "git_refs_url": "https://api.github.com/repos/saad189/react-native-voice-visualizer/git/refs{/sha}",
>       "git_url": "git://github.com/saad189/react-native-voice-visualizer.git",
>       "master_branch": null,
>       "visibility": "public",
>       "archived": false,
>       "is_code_search_indexed": null,
>       "display_title": "saad189/react-native-voice-visualizer",
>       "display_url": "https://github.com/saad189/react-native-voice-visualizer"
>     }
>   ]
> }
> ```
>
> Searched the web for `site.viro-community.readme.io "Expo" "install" ...`
>
> MCP tool call
>
> codex_apps.github.fetch
>
> ```json
> {
>   "url": "https://api.github.com/repos/rit3zh/expo-ios-sonic-player/commits?per_page=1"
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "content": "[{\"sha\":\"b3877a4505907fe138ee1e5eb7bbe69999877ec2\",\"node_id\":\"C_kwDOPOA0ldoAKGIzODc3YTQ1MDU5MDdmZTEzOGVlMWU1ZWI3YmJlNjk5OTk4NzdlYzI\",\"commit\":{\"author\":{\"name\":\"Ritesh.\",\"email\":\"119659853+rit3zh@users.noreply.github.com\",\"date\":\"2025-07-20T15:59:23Z\"},\"committer\":{\"name\":\"GitHub\",\"email\":\"noreply@github.com\",\"date\":\"2025-07-20T15:59:23Z\"},\"message\":\"Update AudioPlayer.swift\",\"tree\":{\"sha\":\"85a2e6996bd88e6243ad71d378e94a4ca7a9a1fa\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/85a2e6996bd88e6243ad71d378e94a4ca7a9a1fa\"},\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/commits/b3877a4505907fe138ee1e5eb7bbe69999877ec2\",\"comment_count\":0,\"verification\":{\"verified\":true,\"reason\":\"valid\",\"signature\":\"-----BEGIN PGP SIGNATURE-----\\n\\nwsFcBAABCAAQBQJofRJbCRC1aQ7uu5UhlAAAU+wQAKCdY8gZHsZ+DY2gkCkuui1j\\nBABfwI8vMpdLXOQ/JQCHHD4UnEQ2tiJkAPoE6Rrllb1k+ecQEZQoIOrg1HdeREUk\\n/iFxKaQsVSX3/f+FAG1CsukYngsAT1cd7TGllHWRGjjWuieStI07+rFoGI3Btjsd\\n2HGZHqIAqICQ5DwJrjaJmDa1WAFkfMhDydEbbtZovI3t0NoDekgfEyN+2jEUKTJJ\\n+z72lJemrvTsFO6yZooC0iMAPz491I5pd4V/ptYqqObPEDmYeNOAdkZ/f2waNKT7\\n2q7a76JAhcezXkqPfwm/dj5dKn2Hux5kKaeMdFJuZduaT50s15BtR1Q8GFTVzTz2\\n317LPEqvP1qJjSA20slx6fX239+FthrIJ7iVacceFIoMZTQGMdmddzb5R75I1Kf1\\n0y/2GuzA9SRgo0vk4tEmgUfqBQqC5Q7jTn1FEyHBWeK7LUpon/7WKSbx/8NwDKP7\\njwNhDjT4e0Q4Nr5VL526LfaWHmVohx+EiHu2J5ia8PHdCvgvviVZ33RTzEOihxkZ\\n/yih3iY7zyTY8TV+OygdupbiRti9V+E2EzNLEIrb/pfjBJSI+1oOIQdM9g9h3NGI\\nZF+YAD4YShlWU+Y8e2M9T6DtwpoxKyGNVfEpIhgQd79jo6rhhBSKDgUjTOr5Q+Ok\\nMwGn1fBAo6iUVUwLniSx\\n=5CMU\\n-----END PGP SIGNATURE-----\\n\",\"payload\":\"tree 85a2e6996bd88e6243ad71d378e94a4ca7a9a1fa\\nparent 9ef69c9dd2dcf7bbf07fd0c1f707c8f134bcd7a4\\nauthor Ritesh. <119659853+rit3zh@users.noreply.github.com> 1753027163 -0400\\ncommitter GitHub <noreply@github.com> 1753027163 -0400\\n\\nUpdate AudioPlayer.swift\",\"verified_at\":\"2025-07-20T15:59:23Z\"}},\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/commits/b3877a4505907fe138ee1e5eb7bbe69999877ec2\",\"html_url\":\"https://github.com/rit3zh/expo-ios-sonic-player/commit/b3877a4505907fe138ee1e5eb7bbe69999877ec2\",\"comments_url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/commits/b3877a4505907fe138ee1e5eb7bbe69999877ec2/comments\",\"author\":{\"login\":\"rit3zh\",\"id\":119659853,\"node_id\":\"U_kgDOByHdTQ\",\"avatar_url\":\"https://avatars.githubusercontent.com/u/119659853?v=4\",\"gravatar_id\":\"\",\"url\":\"https://api.github.com/users/rit3zh\",\"html_url\":\"https://github.com/rit3zh\",\"followers_url\":\"https://api.github.com/users/rit3zh/followers\",\"following_url\":\"https://api.github.com/users/rit3zh/following{/other_user}\",\"gists_url\":\"https://api.github.com/users/rit3zh/gists{/gist_id}\",\"starred_url\":\"https://api.github.com/users/rit3zh/starred{/owner}{/repo}\",\"subscriptions_url\":\"https://api.github.com/users/rit3zh/subscriptions\",\"organizations_url\":\"https://api.github.com/users/rit3zh/orgs\",\"repos_url\":\"https://api.github.com/users/rit3zh/repos\",\"events_url\":\"https://api.github.com/users/rit3zh/events{/privacy}\",\"received_events_url\":\"https://api.github.com/users/rit3zh/received_events\",\"type\":\"User\",\"user_view_type\":\"public\",\"site_admin\":false},\"committer\":{\"login\":\"web-flow\",\"id\":19864447,\"node_id\":\"MDQ6VXNlcjE5ODY0NDQ3\",\"avatar_url\":\"https://avatars.githubusercontent.com/u/19864447?v=4\",\"gravatar_id\":\"\",\"url\":\"https://api.github.com/users/web-flow\",\"html_url\":\"https://github.com/web-flow\",\"followers_url\":\"https://api.github.com/users/web-flow/followers\",\"following_url\":\"https://api.github.com/users/web-flow/following{/other_user}\",\"gists_url\":\"https://api.github.com/users/web-flow/gists{/gist_id}\",\"starred_url\":\"https://api.github.com/users/web-flow/starred{/owner}{/repo}\",\"subscriptions_url\":\"https://api.github.com/users/web-flow/subscriptions\",\"organizations_url\":\"https://api.github.com/users/web-flow/orgs\",\"repos_url\":\"https://api.github.com/users/web-flow/repos\",\"events_url\":\"https://api.github.com/users/web-flow/events{/privacy}\",\"received_events_url\":\"https://api.github.com/users/web-flow/received_events\",\"type\":\"User\",\"user_view_type\":\"public\",\"site_admin\":false},\"parents\":[{\"sha\":\"9ef69c9dd2dcf7bbf07fd0c1f707c8f134bcd7a4\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/commits/9ef69c9dd2dcf7bbf07fd0c1f707c8f134bcd7a4\",\"html_url\":\"https://github.com/rit3zh/expo-ios-sonic-player/commit/9ef69c9dd2dcf7bbf07fd0c1f707c8f134bcd7a4\"}]}]",
>   "title": "commits",
>   "modified_date": null,
>   "url": "https://api.github.com/repos/rit3zh/expo-ios-sonic-player/commits?per_page=1",
>   "display_url": "https://api.github.com/repos/rit3zh/expo-ios-sonic-player/commits?per_page=1",
>   "display_title": "commits",
>   "structuredContent": {
>     "title": "commits",
>     "content": "[{\"sha\":\"b3877a4505907fe138ee1e5eb7bbe69999877ec2\",\"node_id\":\"C_kwDOPOA0ldoAKGIzODc3YTQ1MDU5MDdmZTEzOGVlMWU1ZWI3YmJlNjk5OTk4NzdlYzI\",\"commit\":{\"author\":{\"name\":\"Ritesh.\",\"email\":\"119659853+rit3zh@users.noreply.github.com\",\"date\":\"2025-07-20T15:59:23Z\"},\"committer\":{\"name\":\"GitHub\",\"email\":\"noreply@github.com\",\"date\":\"2025-07-20T15:59:23Z\"},\"message\":\"Update AudioPlayer.swift\",\"tree\":{\"sha\":\"85a2e6996bd88e6243ad71d378e94a4ca7a9a1fa\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/trees/85a2e6996bd88e6243ad71d378e94a4ca7a9a1fa\"},\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/git/commits/b3877a4505907fe138ee1e5eb7bbe69999877ec2\",\"comment_count\":0,\"verification\":{\"verified\":true,\"reason\":\"valid\",\"signature\":\"-----BEGIN PGP SIGNATURE-----\\n\\nwsFcBAABCAAQBQJofRJbCRC1aQ7uu5UhlAAAU+wQAKCdY8gZHsZ+DY2gkCkuui1j\\nBABfwI8vMpdLXOQ/JQCHHD4UnEQ2tiJkAPoE6Rrllb1k+ecQEZQoIOrg1HdeREUk\\n/iFxKaQsVSX3/f+FAG1CsukYngsAT1cd7TGllHWRGjjWuieStI07+rFoGI3Btjsd\\n2HGZHqIAqICQ5DwJrjaJmDa1WAFkfMhDydEbbtZovI3t0NoDekgfEyN+2jEUKTJJ\\n+z72lJemrvTsFO6yZooC0iMAPz491I5pd4V/ptYqqObPEDmYeNOAdkZ/f2waNKT7\\n2q7a76JAhcezXkqPfwm/dj5dKn2Hux5kKaeMdFJuZduaT50s15BtR1Q8GFTVzTz2\\n317LPEqvP1qJjSA20slx6fX239+FthrIJ7iVacceFIoMZTQGMdmddzb5R75I1Kf1\\n0y/2GuzA9SRgo0vk4tEmgUfqBQqC5Q7jTn1FEyHBWeK7LUpon/7WKSbx/8NwDKP7\\njwNhDjT4e0Q4Nr5VL526LfaWHmVohx+EiHu2J5ia8PHdCvgvviVZ33RTzEOihxkZ\\n/yih3iY7zyTY8TV+OygdupbiRti9V+E2EzNLEIrb/pfjBJSI+1oOIQdM9g9h3NGI\\nZF+YAD4YShlWU+Y8e2M9T6DtwpoxKyGNVfEpIhgQd79jo6rhhBSKDgUjTOr5Q+Ok\\nMwGn1fBAo6iUVUwLniSx\\n=5CMU\\n-----END PGP SIGNATURE-----\\n\",\"payload\":\"tree 85a2e6996bd88e6243ad71d378e94a4ca7a9a1fa\\nparent 9ef69c9dd2dcf7bbf07fd0c1f707c8f134bcd7a4\\nauthor Ritesh. <119659853+rit3zh@users.noreply.github.com> 1753027163 -0400\\ncommitter GitHub <noreply@github.com> 1753027163 -0400\\n\\nUpdate AudioPlayer.swift\",\"verified_at\":\"2025-07-20T15:59:23Z\"}},\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/commits/b3877a4505907fe138ee1e5eb7bbe69999877ec2\",\"html_url\":\"https://github.com/rit3zh/expo-ios-sonic-player/commit/b3877a4505907fe138ee1e5eb7bbe69999877ec2\",\"comments_url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/commits/b3877a4505907fe138ee1e5eb7bbe69999877ec2/comments\",\"author\":{\"login\":\"rit3zh\",\"id\":119659853,\"node_id\":\"U_kgDOByHdTQ\",\"avatar_url\":\"https://avatars.githubusercontent.com/u/119659853?v=4\",\"gravatar_id\":\"\",\"url\":\"https://api.github.com/users/rit3zh\",\"html_url\":\"https://github.com/rit3zh\",\"followers_url\":\"https://api.github.com/users/rit3zh/followers\",\"following_url\":\"https://api.github.com/users/rit3zh/following{/other_user}\",\"gists_url\":\"https://api.github.com/users/rit3zh/gists{/gist_id}\",\"starred_url\":\"https://api.github.com/users/rit3zh/starred{/owner}{/repo}\",\"subscriptions_url\":\"https://api.github.com/users/rit3zh/subscriptions\",\"organizations_url\":\"https://api.github.com/users/rit3zh/orgs\",\"repos_url\":\"https://api.github.com/users/rit3zh/repos\",\"events_url\":\"https://api.github.com/users/rit3zh/events{/privacy}\",\"received_events_url\":\"https://api.github.com/users/rit3zh/received_events\",\"type\":\"User\",\"user_view_type\":\"public\",\"site_admin\":false},\"committer\":{\"login\":\"web-flow\",\"id\":19864447,\"node_id\":\"MDQ6VXNlcjE5ODY0NDQ3\",\"avatar_url\":\"https://avatars.githubusercontent.com/u/19864447?v=4\",\"gravatar_id\":\"\",\"url\":\"https://api.github.com/users/web-flow\",\"html_url\":\"https://github.com/web-flow\",\"followers_url\":\"https://api.github.com/users/web-flow/followers\",\"following_url\":\"https://api.github.com/users/web-flow/following{/other_user}\",\"gists_url\":\"https://api.github.com/users/web-flow/gists{/gist_id}\",\"starred_url\":\"https://api.github.com/users/web-flow/starred{/owner}{/repo}\",\"subscriptions_url\":\"https://api.github.com/users/web-flow/subscriptions\",\"organizations_url\":\"https://api.github.com/users/web-flow/orgs\",\"repos_url\":\"https://api.github.com/users/web-flow/repos\",\"events_url\":\"https://api.github.com/users/web-flow/events{/privacy}\",\"received_events_url\":\"https://api.github.com/users/web-flow/received_events\",\"type\":\"User\",\"user_view_type\":\"public\",\"site_admin\":false},\"parents\":[{\"sha\":\"9ef69c9dd2dcf7bbf07fd0c1f707c8f134bcd7a4\",\"url\":\"https://api.github.com/repos/rit3zh/expo-ios-sonic-player/commits/9ef69c9dd2dcf7bbf07fd0c1f707c8f134bcd7a4\",\"html_url\":\"https://github.com/rit3zh/expo-ios-sonic-player/commit/9ef69c9dd2dcf7bbf07fd0c1f707c8f134bcd7a4\"}]}]",
>     "display_url": "https://api.github.com/repos/rit3zh/expo-ios-sonic-player/commits?per_page=1"
>   }
> }
> ```
>
> Searched the web for `ViroSpatialSound binaural HRTF Google VR Audio ...`
>
> MCP tool call
>
> codex_apps.github.fetch_file
>
> ```json
> {
>   "repository_full_name": "AgoraIO-Extensions/react-native-agora",
>   "path": "src/IAgoraSpatialAudio.ts"
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "content": "import './extension/IAgoraSpatialAudioExtension';\nimport { RtcConnection } from './IAgoraRtcEngineEx';\n\n/**\n * Spatial position information of the remote user or media player.\n */\nexport class RemoteVoicePositionInfo {\n  /**\n   * Coordinates in the world coordinate system. This parameter is an array of length 3, representing the coordinates in the forward, right, and up directions respectively.\n   */\n  position?: number[];\n  /**\n   * Unit vector of the forward axis in the world coordinate system. This parameter is an array of length 3, representing the directions in the forward, right, and up axes respectively.\n   */\n  forward?: number[];\n}\n\n/**\n * Sound isolation zone settings.\n */\nexport class SpatialAudioZone {\n  /**\n   * ID of the sound isolation zone.\n   */\n  zoneSetId?: number;\n  /**\n   * The spatial center point of the sound isolation zone. This parameter is an array of length 3, representing coordinates in the forward, right, and up directions respectively.\n   */\n  position?: number[];\n  /**\n   * Unit vector pointing forward from position. This parameter is an array of length 3, representing coordinates in the forward, right, and up directions respectively.\n   */\n  forward?: number[];\n  /**\n   * Unit vector pointing right from position. This parameter is an array of length 3, representing coordinates in the forward, right, and up directions respectively.\n   */\n  right?: number[];\n  /**\n   * Unit vector pointing upward from position. This parameter is an array of length 3, representing coordinates in the forward, right, and up directions respectively.\n   */\n  up?: number[];\n  /**\n   * Treating the entire sound isolation zone as a cube, this represents the length of the forward edge, in game engine units.\n   */\n  forwardLength?: number;\n  /**\n   * Treating the entire sound isolation zone as a cube, this represents the length of the right edge, in game engine units.\n   */\n  rightLength?: number;\n  /**\n   * Treating the entire sound isolation zone as a cube, this represents the length of the upward edge, in game engine units.\n   */\n  upLength?: number;\n  /**\n   * Sound attenuation coefficient when users inside and outside the sound isolation zone communicate. Value range: [0,1]. Where:\n   *  0: Broadcast mode, volume and timbre do not attenuate with distance; the local user hears no change regardless of distance.\n   *  (0,0.5): Weak attenuation mode; volume and timbre attenuate slightly, allowing sound to travel farther than in real environments.\n   *  0.5: Simulates real-world volume attenuation, equivalent to not setting audioAttenuation.\n   *  (0.5,1]: Strong attenuation mode (default is 1); volume and timbre attenuate rapidly.\n   */\n  audioAttenuation?: number;\n}\n\n/**\n * This class implements spatial audio by calculating user coordinates through the SDK.\n *\n * This class inherits from IBaseSpatialAudioEngine. Before calling other APIs under this class, you need to call the initialize method to initialize it.\n */\nexport abstract class ILocalSpatialAudioEngine {\n  /**\n   * @ignore\n   */\n  abstract release(): void;\n\n  /**\n   * Initializes ILocalSpatialAudioEngine.\n   *\n   * You need to call this method to initialize ILocalSpatialAudioEngine before calling other methods of the ILocalSpatialAudioEngine class.\n   *  The SDK only supports creating one instance of ILocalSpatialAudioEngine per app.\n   *\n   * @returns\n   * 0: Success.\n   *  < 0: Failure. See [Error Codes](https://docs.agora.io/en/video-calling/troubleshooting/error-codes) for details and resolution suggestions.\n   */\n  abstract initialize(): number;\n\n  /**\n   * Updates the spatial position information of a remote user.\n   *\n   * After successfully calling this method, the SDK calculates spatial audio parameters based on the relative positions of the local and remote users. This method must be called after joinChannel.\n   *\n   * @param uid User ID. Must be the same as the user ID used when the user joined the channel.\n   * @param posInfo Spatial position information of the remote user. See RemoteVoicePositionInfo.\n   *\n   * @returns\n   * 0: Success.\n   *  < 0: Failure. See [Error Codes](https://docs.agora.io/en/video-calling/troubleshooting/error-codes) for details and resolution suggestions.\n   */\n  abstract updateRemotePosition(\n    uid: number,\n    posInfo: RemoteVoicePositionInfo\n  ): number;\n\n  /**\n   * @ignore\n   */\n  abstract updateRemotePositionEx(\n    uid: number,\n    posInfo: RemoteVoicePositionInfo,\n    connection: RtcConnection\n  ): number;\n\n  /**\n   * Deletes the spatial position information of the specified remote user.\n   *\n   * After this method is successfully called, the local user will no longer hear the specified remote user.\n   * To avoid wasting computational resources after leaving the channel, you need to call this method to remove the spatial position information of the specified remote user. Otherwise, the spatial position information of that user will be retained. When the number of remote users exceeds the maximum number of audio streams that can be received as set in setMaxAudioRecvCount, the SDK will automatically unsubscribe from the audio streams of the farthest users based on relative distance.\n   *\n   * @param uid User ID. Must match the user ID used when the user joined the channel.\n   *\n   * @returns\n   * 0: Success.\n   *  < 0: Failure. See [Error Codes](https://docs.agora.io/en/video-calling/troubleshooting/error-codes) for details and resolution suggestions.\n   */\n  abstract removeRemotePosition(uid: number): number;\n\n  /**\n   * @ignore\n   */\n  abstract removeRemotePositionEx(\n    uid: number,\n    connection: RtcConnection\n  ): number;\n\n  /**\n   * @ignore\n   */\n  abstract clearRemotePositionsEx(connection: RtcConnection): number;\n\n  /**\n   * @ignore\n   */\n  abstract updateSelfPositionEx(\n    position: number[],\n    axisForward: number[],\n    axisRight: number[],\n    axisUp: number[],\n    connection: RtcConnection\n  ): number;\n\n  /**\n   * @ignore\n   */\n  abstract setMaxAudioRecvCount(maxCount: number): number;\n\n  /**\n   * @ignore\n   */\n  abstract setAudioRecvRange(range: number): number;\n\n  /**\n   * @ignore\n   */\n  abstract setDistanceUnit(unit: number): number;\n\n  /**\n   * @ignore\n   */\n  abstract updateSelfPosition(\n    position: number[],\n    axisForward: number[],\n    axisRight: number[],\n    axisUp: number[]\n  ): number;\n\n  /**\n   * @ignore\n   */\n  abstract updatePlayerPositionInfo(\n    playerId: number,\n    positionInfo: RemoteVoicePositionInfo\n  ): number;\n\n  /**\n   * @ignore\n   */\n  abstract setParameters(params: string): number;\n\n  /**\n   * @ignore\n   */\n  abstract muteLocalAudioStream(mute: boolean): number;\n\n  /**\n   * @ignore\n   */\n  abstract muteAllRemoteAudioStreams(mute: boolean): number;\n\n  /**\n   * @ignore\n   */\n  abstract muteRemoteAudioStream(uid: number, mute: boolean): number;\n\n  /**\n   * Sets the audio attenuation effect for the specified user.\n   *\n   * @param uid User ID. Must be the same as the user ID used when joining the channel.\n   * @param attenuation The audio attenuation coefficient for the user. The range is [0,1].\n   * @param forceSet Whether to force the audio attenuation effect for the user: true : Forces the use of attenuation to set the user's audio attenuation effect. In this case, the audioAttenuation set in SpatialAudioZone does not take effect for this user. false : Does not force the use of attenuation to set the user's audio attenuation effect. There are two cases:\n   *  If the audio source and listener are inside and outside the sound insulation zone respectively, the attenuation effect is determined by audioAttenuation in SpatialAudioZone.\n   *  If the audio source and listener are both inside the same sound insulation zone or both outside, the attenuation effect is determined by attenuation in this method.\n   *\n   * @returns\n   * 0: Success.\n   *  < 0: Failure. See [Error Codes](https://docs.agora.io/en/video-calling/troubleshooting/error-codes) for details and resolution suggestions.\n   */\n  abstract setRemoteAudioAttenuation(\n    uid: number,\n    attenuation: number,\n    forceSet: boolean\n  ): number;\n\n  /**\n   * @ignore\n   */\n  abstract setZones(zones: SpatialAudioZone[], zoneCount: number): number;\n\n  /**\n   * @ignore\n   */\n  abstract setPlayerAttenuation(\n    playerId: number,\n    attenuation: number,\n    forceSet: boolean\n  ): number;\n\n  /**\n   * Deletes the spatial position information of all remote users.\n   *\n   * After successfully calling this method, the local user will no longer hear any remote users.\n   * After leaving the channel, you can also call this method to delete all remote users' spatial position information to avoid wasting computing resources.\n   *\n   * @returns\n   * 0: Success.\n   *  < 0: Failure. See [Error Codes](https://docs.agora.io/en/video-calling/troubleshooting/error-codes) for details and resolution suggestions.\n   */\n  abstract clearRemotePositions(): number;\n}\n",
>   "encoding": "utf-8",
>   "sha": "4859b624ac8e1084a9bb7879c7a96c2b2bd75149",
>   "display_url": "https://github.com/AgoraIO-Extensions/react-native-agora/blob/main/src/IAgoraSpatialAudio.ts",
>   "display_title": "IAgoraSpatialAudio.ts"
> }
> ```
>
> MCP tool call
>
> codex_apps.github.search_repositories
>
> ```json
> {
>   "query": "virocore org:ReactVision",
>   "per_page": 5
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "archive_filter_applied": null,
>   "repositories": [
>     {
>       "id": "313492009",
>       "name": "virocore",
>       "owner": {
>         "login": "ReactVision",
>         "id": 74572641,
>         "type": "Organization",
>         "avatar_url": "https://avatars.githubusercontent.com/u/74572641?v=4",
>         "url": "https://api.github.com/users/ReactVision"
>       },
>       "repository_full_name": "ReactVision/virocore",
>       "permissions": {
>         "admin": false,
>         "maintain": false,
>         "pull": true,
>         "push": false,
>         "triage": false
>       },
>       "allow_auto_merge": null,
>       "allow_merge_commit": null,
>       "allow_rebase_merge": null,
>       "allow_squash_merge": null,
>       "allow_update_branch": null,
>       "clone_url": "https://github.com/ReactVision/virocore.git",
>       "size": 1467405,
>       "default_branch": "main",
>       "git_commits_url": "https://api.github.com/repos/ReactVision/virocore/git/commits{/sha}",
>       "git_refs_url": "https://api.github.com/repos/ReactVision/virocore/git/refs{/sha}",
>       "git_url": "git://github.com/ReactVision/virocore.git",
>       "master_branch": null,
>       "visibility": "public",
>       "archived": false,
>       "is_code_search_indexed": null,
>       "display_title": "ReactVision/virocore",
>       "display_url": "https://github.com/ReactVision/virocore"
>     }
>   ]
> }
> ```
>
> MCP tool call
>
> codex_apps.github.fetch
>
> ```json
> {
>   "url": "https://api.github.com/repos/ReactVision/virocore/git/trees/main?recursive=1"
> }
> ```
>
> ```text
> {"content":[{"type":"text","text":"{\"content\":[{\"type\":\"text\",\"text\":\"Action completed.\"}],\"structuredContent\":{\"content\":\"{\\\"sha\\\":\\\"23710240d2cab5d4e866f3dba44ef568d8e563b4\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/23710240d2cab5d4e866f3dba44ef568d8e563b4\\\",\\\"tree\\\":[{\\\"path\\\":\\\".github\\\",\\\"mode\\\":\\\"040000\\\",\\\"type\\\":\\\"tree\\\",\\\"sha\\\":\\\"7a52310442c186c506b35f6926f5aba8eada7094\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/7a52310442c186c506b35f6926f5aba8eada7094\\\"},{\\\"path\\\":\\\".github/dependabot.yml\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"f006eb8dc9185754cab1e400bd48bc1bcfb3e51d\\\",\\\"size\\\":618,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/f006eb8dc9185754cab1e400bd48bc1bcfb3e51d\\\"},{\\\"path\\\":\\\".github/release.yml\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"d62e3abfef25cbd5e7ce75795c12e50bdad81358\\\",\\\"size\\\":310,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/d62e3abfef25cbd5e7ce75795c12e50bdad81358\\\"},{\\\"path\\\":\\\".github/workflows\\\",\\\"mode\\\":\\\"040000\\\",\\\"type\\\":\\\"tree\\\",\\\"sha\\\":\\\"9dd6bc9d7919d98a0890a1faeccfc2647f5cc0ab\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/9dd6bc9d7919d98a0890a1faeccfc2647f5cc0ab\\\"},{\\\"path\\\":\\\".github/workflows/gradle-wrapper-validation.yml\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"5c5038f26b7b943cd6d8563daee1ff72373ed9c9\\\",\\\"size\\\":369,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/5c5038f26b7b943cd6d8563daee1ff72373ed9c9\\\"},{\\\"path\\\":\\\".github/workflows/pull-request.yml\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"53006312f97a90856cde7eb96be014f31c604ffd\\\",\\\"size\\\":2413,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/53006312f97a90856cde7eb96be014f31c604ffd\\\"},{\\\"path\\\":\\\".github/workflows/release.yml\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"bd11218ce556a3910649bc56c3e20162e63f63b5\\\",\\\"size\\\":1844,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/bd11218ce556a3910649bc56c3e20162e63f63b5\\\"},{\\\"path\\\":\\\".gitignore\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"fcc213bd1e59f2095c67b38808935fbf84a46ec8\\\",\\\"size\\\":2066,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/fcc213bd1e59f2095c67b38808935fbf84a46ec8\\\"},{\\\"path\\\":\\\".reviewboardrc\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"9bc0d03fd951e5d50237483df31d38960f9048bf\\\",\\\"size\\\":88,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/9bc0d03fd951e5d50237483df31d38960f9048bf\\\"},{\\\"path\\\":\\\"CHANGELOG.md\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"6063bc9224ca47dbe46a22d4f9019c8441ef7e1c\\\",\\\"size\\\":63329,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/6063bc9224ca47dbe46a22d4f9019c8441ef7e1c\\\"},{\\\"path\\\":\\\"ISSUE_TEMPLATE\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"fb6090a94319821efb17a61f4b0ca2f0ed7912a7\\\",\\\"size\\\":900,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/fb6090a94319821efb17a61f4b0ca2f0ed7912a7\\\"},{\\\"path\\\":\\\"Jenkinsfile\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"10a916d7a3dfe61082935d51d55213a0440faf4c\\\",\\\"size\\\":1092,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/10a916d7a3dfe61082935d51d55213a0440faf4c\\\"},{\\\"path\\\":\\\"LICENSE\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"77375227cbe0251de00cd2cbf7c8b1aa01d290b3\\\",\\\"size\\\":1106,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/77375227cbe0251de00cd2cbf7c8b1aa01d290b3\\\"},{\\\"path\\\":\\\"README.md\\\",\\\"mode\\\":\\\"100755\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"726ca5fd0c347c8ebdbdaed936dec540655b4fcf\\\",\\\"size\\\":3501,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/726ca5fd0c347c8ebdbdaed936dec540655b4fcf\\\"},{\\\"path\\\":\\\"RELEASE_NOTES.md\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"e6d11f2286033f229cdd9a1e96bb9cbea4a28fb6\\\",\\\"size\\\":1795,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/e6d11f2286033f229cdd9a1e96bb9cbea4a28fb6\\\"},{\\\"path\\\":\\\"ViroRenderer\\\",\\\"mode\\\":\\\"040000\\\",\\\"type\\\":\\\"tree\\\",\\\"sha\\\":\\\"fed08911bca8054185f7138f81639e883e023dda\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/fed08911bca8054185f7138f81639e883e023dda\\\"},{\\\"path\\\":\\\"ViroRenderer/Nodes.pb.cc\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"1cd860e51c1579789cae75ed04e51cdf63f43e9e\\\",\\\"size\\\":322563,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/1cd860e51c1579789cae75ed04e51cdf63f43e9e\\\"},{\\\"path\\\":\\\"ViroRenderer/Nodes.pb.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"e6d9eb9cf3cd03e9be3fe9f04794e0fefc1555e3\\\",\\\"size\\\":210241,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/e6d9eb9cf3cd03e9be3fe9f04794e0fefc1555e3\\\"},{\\\"path\\\":\\\"ViroRenderer/Shaders.metal\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"2e76305158fe765b06f843b622b9bea4a9305772\\\",\\\"size\\\":102798,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/2e76305158fe765b06f843b622b9bea4a9305772\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARAnchor.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"25d640a94863b9c6f62f8a37175ecace8cfc703d\\\",\\\"size\\\":5308,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/25d640a94863b9c6f62f8a37175ecace8cfc703d\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARCamera.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"5baa4f39d3394f08c8dd629083755772e122973d\\\",\\\"size\\\":4010,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/5baa4f39d3394f08c8dd629083755772e122973d\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARConstraintMatcher.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"3226f1e57df8a55d8870670bbe3855f8e16115a7\\\",\\\"size\\\":10848,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/3226f1e57df8a55d8870670bbe3855f8e16115a7\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARConstraintMatcher.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"4cb3b4d1a35c37d13680463f11bdd7cb3122de52\\\",\\\"size\\\":5004,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/4cb3b4d1a35c37d13680463f11bdd7cb3122de52\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARDeclarativeImageNode.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"ee60db48f52cf96d48b2d0a57e66df0937a7a9f8\\\",\\\"size\\\":2380,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/ee60db48f52cf96d48b2d0a57e66df0937a7a9f8\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARDeclarativeNode.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"1ec7edaf6aa28cc442e94afe12e51f50fe42b272\\\",\\\"size\\\":5118,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/1ec7edaf6aa28cc442e94afe12e51f50fe42b272\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARDeclarativeNodeDelegate.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"fcff594b88926548b9eac1aed9f2485940cbacfe\\\",\\\"size\\\":2040,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/fcff594b88926548b9eac1aed9f2485940cbacfe\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARDeclarativeObjectNode.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"bcde44cde86a936d3b581a81bc256aed6c207aca\\\",\\\"size\\\":2422,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/bcde44cde86a936d3b581a81bc256aed6c207aca\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARDeclarativePlane.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"b72aeb114682f6a72d7785c1f8cb4411530b79fc\\\",\\\"size\\\":5941,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/b72aeb114682f6a72d7785c1f8cb4411530b79fc\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARDeclarativeSession.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"a11c6de551ba6a9baf92d092c41fd1dedabb8e3d\\\",\\\"size\\\":8850,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/a11c6de551ba6a9baf92d092c41fd1dedabb8e3d\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARDeclarativeSession.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"9d96388974ddea9f0d4b716756b2f8257e013597\\\",\\\"size\\\":5133,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/9d96388974ddea9f0d4b716756b2f8257e013597\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARDepthMesh.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"ef42364c49c61a47c9781c8776cee467f0f37f04\\\",\\\"size\\\":2109,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/ef42364c49c61a47c9781c8776cee467f0f37f04\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARDepthMesh.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"6bf01b72e7023e8a2ec3b880f43af0c9b5ed5ac3\\\",\\\"size\\\":3616,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/6bf01b72e7023e8a2ec3b880f43af0c9b5ed5ac3\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARDepthMesh.mm\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"ef42364c49c61a47c9781c8776cee467f0f37f04\\\",\\\"size\\\":2109,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/ef42364c49c61a47c9781c8776cee467f0f37f04\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARDraggableNodeTest.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"da95ff10dfe64878d4a1fd0c0e49a9b2dc4374b8\\\",\\\"size\\\":4377,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/da95ff10dfe64878d4a1fd0c0e49a9b2dc4374b8\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARDraggableNodeTest.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"87933c71b8acd6e69f0a82cad971f4a14a4d9ebe\\\",\\\"size\\\":2327,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/87933c71b8acd6e69f0a82cad971f4a14a4d9ebe\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARFrame.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"476f9685aa30d8fc4c81e57fef3c47d18e4be2ae\\\",\\\"size\\\":10635,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/476f9685aa30d8fc4c81e57fef3c47d18e4be2ae\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARHitTestResult.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"cead43bc81fbf8e0cc82df6e3f1968b127d7be7e\\\",\\\"size\\\":5450,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/cead43bc81fbf8e0cc82df6e3f1968b127d7be7e\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARImageAnchor.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"a63bf23ab0fa017beb449617f3e86f49ed1976c9\\\",\\\"size\\\":2197,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/a63bf23ab0fa017beb449617f3e86f49ed1976c9\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARImageDatabase.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"4a6a97b1665e33b0449513efcb4f2d773d227962\\\",\\\"size\\\":1716,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/4a6a97b1665e33b0449513efcb4f2d773d227962\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARImageTarget.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"00bc6f47d27cbd69c8d288516b6f8db5c91bdd6a\\\",\\\"size\\\":2412,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/00bc6f47d27cbd69c8d288516b6f8db5c91bdd6a\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARImageTargetAndroid.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"3735a967285fe4aed07d565abaa563115e05b9bc\\\",\\\"size\\\":829,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/3735a967285fe4aed07d565abaa563115e05b9bc\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARImageTargetAndroid.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"23e8328d5a44fb48afeb8ecb55b239fd989e55a3\\\",\\\"size\\\":2411,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/23e8328d5a44fb48afeb8ecb55b239fd989e55a3\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARImperativeSession.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"b8ef3d8f8af673760dab9a64832b5f2cafb66dff\\\",\\\"size\\\":5089,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/b8ef3d8f8af673760dab9a64832b5f2cafb66dff\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARImperativeSession.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"a43bcc068e9afb0de96dcd252e4b8ef828e678e9\\\",\\\"size\\\":3866,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/a43bcc068e9afb0de96dcd252e4b8ef828e678e9\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARNode.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"aaa9a7b9618730028a791f2b1fc3d6efa591ca7c\\\",\\\"size\\\":1410,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/aaa9a7b9618730028a791f2b1fc3d6efa591ca7c\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARNode.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"76161f6eb7f524b78fa299cc4fa36efaf6a8c4d0\\\",\\\"size\\\":2655,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/76161f6eb7f524b78fa299cc4fa36efaf6a8c4d0\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARObjectAnchor.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"9f0a7d0bf04e7d3026ed5aca79019c2b1ef72181\\\",\\\"size\\\":1741,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/9f0a7d0bf04e7d3026ed5aca79019c2b1ef72181\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARObjectTarget.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"97fd7e22078461a1e8e37203a633b45696f3d903\\\",\\\"size\\\":1690,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/97fd7e22078461a1e8e37203a633b45696f3d903\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARObjectTrackingTest.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"bc9b31601aa517815c3d0c92ff4b8239b04eda4f\\\",\\\"size\\\":5276,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/bc9b31601aa517815c3d0c92ff4b8239b04eda4f\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARObjectTrackingTest.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"e23147a8af83129dc112dc0d9773ea8b91cfd060\\\",\\\"size\\\":2310,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/e23147a8af83129dc112dc0d9773ea8b91cfd060\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARPlaneAnchor.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"4deddb8498fd0f255e5c7cd2243a7d9a139cfbc8\\\",\\\"size\\\":9610,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/4deddb8498fd0f255e5c7cd2243a7d9a139cfbc8\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARPlaneTest.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"ab346453e0cc9b480f60f89dc8fa4004003c92d1\\\",\\\"size\\\":5189,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/ab346453e0cc9b480f60f89dc8fa4004003c92d1\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARPlaneTest.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"f5d279219a9dd6551fd6aedb5bdc0a4bc755775c\\\",\\\"size\\\":2257,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/f5d279219a9dd6551fd6aedb5bdc0a4bc755775c\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARPointCloud.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"095dc335c1073dd76d4693a37cc04ae1f420992c\\\",\\\"size\\\":2286,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/095dc335c1073dd76d4693a37cc04ae1f420992c\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARScene.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"0ac8e2f82a6206d54d3b80dcc023b145fdd0dec7\\\",\\\"size\\\":12547,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/0ac8e2f82a6206d54d3b80dcc023b145fdd0dec7\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARScene.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"a341e5050d7a2458f31c59a606e5a445553fce3a\\\",\\\"size\\\":8309,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/a341e5050d7a2458f31c59a606e5a445553fce3a\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARSceneController.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"23f6c7716eda61403c3efdda2bf6c6cbfc0a9be7\\\",\\\"size\\\":2162,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/23f6c7716eda61403c3efdda2bf6c6cbfc0a9be7\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARSceneController.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"e9ac2ada46234fac26b113e5ba8e81a162441353\\\",\\\"size\\\":1762,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/e9ac2ada46234fac26b113e5ba8e81a162441353\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARSession.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"f24eeeb5529fc33cb636e9049b22c081771c7624\\\",\\\"size\\\":35171,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/f24eeeb5529fc33cb636e9049b22c081771c7624\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARShadow.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"56a7cdc750f2d5fca666bc793ac5ab262dadbf93\\\",\\\"size\\\":4966,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/56a7cdc750f2d5fca666bc793ac5ab262dadbf93\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARShadow.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"3216b064adb8b2914c0a51d7588ef10b148bc8bf\\\",\\\"size\\\":2192,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/3216b064adb8b2914c0a51d7588ef10b148bc8bf\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARShadowTest.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"60c2595eceadd854e24b51e117c114e9fbda16a1\\\",\\\"size\\\":5464,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/60c2595eceadd854e24b51e117c114e9fbda16a1\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARShadowTest.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"1be1a8455c22f5f4f08eb9ad537f0ce170dadae3\\\",\\\"size\\\":1951,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/1be1a8455c22f5f4f08eb9ad537f0ce170dadae3\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARWorldMesh.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"098cc18ccd6f194c5e14e4d0b5e6c24a6c40b34b\\\",\\\"size\\\":27932,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/098cc18ccd6f194c5e14e4d0b5e6c24a6c40b34b\\\"},{\\\"path\\\":\\\"ViroRenderer/VROARWorldMesh.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"667c26d5951237cf37a744330628d951c87f51eb\\\",\\\"size\\\":16069,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/667c26d5951237cf37a744330628d951c87f51eb\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAction.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"ecafba6a8a8508c84b335c850bda9a7202e6a8c1\\\",\\\"size\\\":5311,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/ecafba6a8a8508c84b335c850bda9a7202e6a8c1\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAction.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"a000290f75eab145b0e47db479dbdf6beb30ede3\\\",\\\"size\\\":6964,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/a000290f75eab145b0e47db479dbdf6beb30ede3\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAllocationTracker.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"3a0ee83bc24d584f8c2baf8cf30953ab0b28a922\\\",\\\"size\\\":4814,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/3a0ee83bc24d584f8c2baf8cf30953ab0b28a922\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAllocationTracker.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"ddf0a4fc3e74c3a992f50d60cf4d4ab242cb74f8\\\",\\\"size\\\":3603,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/ddf0a4fc3e74c3a992f50d60cf4d4ab242cb74f8\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAnimatable.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"0c72cde308990fde2e988b88766b52b3d05b8a28\\\",\\\"size\\\":2017,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/0c72cde308990fde2e988b88766b52b3d05b8a28\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAnimatable.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"1d88b7439b8bccdd78da6632e0300adcf18d74cf\\\",\\\"size\\\":1716,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/1d88b7439b8bccdd78da6632e0300adcf18d74cf\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAnimatedTextureOpenGL.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"576954bed8d0b0c12fcf5f5c0df4a986ecab7361\\\",\\\"size\\\":15404,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/576954bed8d0b0c12fcf5f5c0df4a986ecab7361\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAnimatedTextureOpenGL.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"2bf97ed771847623cd0c2648218a2b117248c0d9\\\",\\\"size\\\":4808,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/2bf97ed771847623cd0c2648218a2b117248c0d9\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAnimation.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"cb8d0b6197c61fde11b34965f470a08c7dc5e375\\\",\\\"size\\\":3136,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/cb8d0b6197c61fde11b34965f470a08c7dc5e375\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAnimationChain.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"8d4807db219982f6fcab871ab92061352cc912c7\\\",\\\"size\\\":6106,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/8d4807db219982f6fcab871ab92061352cc912c7\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAnimationChain.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"c55dc4a82872ca93660d844528332a7ded383210\\\",\\\"size\\\":3188,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/c55dc4a82872ca93660d844528332a7ded383210\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAnimationFloat.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"7aa882a306ad88373c96941962cb34036f38c8bb\\\",\\\"size\\\":3407,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/7aa882a306ad88373c96941962cb34036f38c8bb\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAnimationGroup.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"9b59682b2dbf2c6e6ba0e7a8624ce3f880c4caeb\\\",\\\"size\\\":11192,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/9b59682b2dbf2c6e6ba0e7a8624ce3f880c4caeb\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAnimationGroup.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"7590d4effdb92811d5b1d2ad6a301bc6c71507e8\\\",\\\"size\\\":3840,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/7590d4effdb92811d5b1d2ad6a301bc6c71507e8\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAnimationKeyFrameIndex.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"e177c64e1a209a72027fb25e20bd8d0274ee055b\\\",\\\"size\\\":1565,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/e177c64e1a209a72027fb25e20bd8d0274ee055b\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAnimationMatrix4f.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"630318b2c3c3e7dca7dc3e60eabc99901ae2e2b9\\\",\\\"size\\\":3623,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/630318b2c3c3e7dca7dc3e60eabc99901ae2e2b9\\\"},{\\\"path\\\":\\\"ViroRenderer/VROAnimationQuaternion.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"c45df6ee119d4abc20c8b30ac5a14e6ff5f77987\\\",\\\"size\\\":3709,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/c45df6ee119d4abc20c8b30ac5a14e6ff5f77987\\\"},…997541 chars truncated…eload/constant_q_fsh_adreno.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"4363c237b0367ae8901d57a9050023ab8cda3cd3\\\",\\\"size\\\":1249,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/4363c237b0367ae8901d57a9050023ab8cda3cd3\\\"},{\\\"path\\\":\\\"wasm/preload/equirect_to_cube_fsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"c22b69e61bc48ea48190cd416ced3eb611417cd0\\\",\\\"size\\\":504,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/c22b69e61bc48ea48190cd416ced3eb611417cd0\\\"},{\\\"path\\\":\\\"wasm/preload/equirect_to_cube_vsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"b29163ad8dc4ca4906bbee12195c6c888985cf10\\\",\\\"size\\\":241,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/b29163ad8dc4ca4906bbee12195c6c888985cf10\\\"},{\\\"path\\\":\\\"wasm/preload/image_fsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"37460a1da9e7f9126d6a14e8124cf041b9b9b1d7\\\",\\\"size\\\":154,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/37460a1da9e7f9126d6a14e8124cf041b9b9b1d7\\\"},{\\\"path\\\":\\\"wasm/preload/image_vsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"94860a2346c758bf38ba0f0807a71868e5e2ab54\\\",\\\"size\\\":163,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/94860a2346c758bf38ba0f0807a71868e5e2ab54\\\"},{\\\"path\\\":\\\"wasm/preload/irradiance_convolution_fsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"bca1651b66a17bed494f0046bb6a66220d779de4\\\",\\\"size\\\":2172,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/bca1651b66a17bed494f0046bb6a66220d779de4\\\"},{\\\"path\\\":\\\"wasm/preload/irradiance_convolution_vsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"b29163ad8dc4ca4906bbee12195c6c888985cf10\\\",\\\"size\\\":241,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/b29163ad8dc4ca4906bbee12195c6c888985cf10\\\"},{\\\"path\\\":\\\"wasm/preload/lighting_general_functions_fsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"46a4e5540fb93dcf47f5d6bdfcc0cb82929d30ca\\\",\\\"size\\\":2924,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/46a4e5540fb93dcf47f5d6bdfcc0cb82929d30ca\\\"},{\\\"path\\\":\\\"wasm/preload/particles_fsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"c9f9bd5cef35d066f3b972c11643037a1901410f\\\",\\\"size\\\":200,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/c9f9bd5cef35d066f3b972c11643037a1901410f\\\"},{\\\"path\\\":\\\"wasm/preload/particles_vsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"685694afa27b85f2e34b392ed6e74d4f49637c0e\\\",\\\"size\\\":190,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/685694afa27b85f2e34b392ed6e74d4f49637c0e\\\"},{\\\"path\\\":\\\"wasm/preload/pbr_fsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"c4c94ce38c4dfa85bca2b0eed8a642d98b93b0d9\\\",\\\"size\\\":5148,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/c4c94ce38c4dfa85bca2b0eed8a642d98b93b0d9\\\"},{\\\"path\\\":\\\"wasm/preload/point_cloud.png\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"6e2ac7dee34e88e231c7c194232010603b1bbe06\\\",\\\"size\\\":2571,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/6e2ac7dee34e88e231c7c194232010603b1bbe06\\\"},{\\\"path\\\":\\\"wasm/preload/prefilter_convolution_fsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"54649ec0b5f56b5df18cd4aa0cb37e91c77cce08\\\",\\\"size\\\":3594,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/54649ec0b5f56b5df18cd4aa0cb37e91c77cce08\\\"},{\\\"path\\\":\\\"wasm/preload/prefilter_convolution_vsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"bb7fce10b7a414e54b6b676c5782e1bcf99cc903\\\",\\\"size\\\":243,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/bb7fce10b7a414e54b6b676c5782e1bcf99cc903\\\"},{\\\"path\\\":\\\"wasm/preload/skinning_vsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"e7f6aedb2abcb207d95d650da341c4f36fb8d39c\\\",\\\"size\\\":706,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/e7f6aedb2abcb207d95d650da341c4f36fb8d39c\\\"},{\\\"path\\\":\\\"wasm/preload/standard_fsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"e72f972572e54ac1b522f3178d032b1ab3ad64ca\\\",\\\"size\\\":3038,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/e72f972572e54ac1b522f3178d032b1ab3ad64ca\\\"},{\\\"path\\\":\\\"wasm/preload/standard_vsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"55a934efdb31e9627cd5ba2304ce187aac5221eb\\\",\\\"size\\\":2099,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/55a934efdb31e9627cd5ba2304ce187aac5221eb\\\"},{\\\"path\\\":\\\"wasm/preload/standard_vsh_adreno.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"8c6ba71e94b88b878391c8e5da16258ce5be9e4d\\\",\\\"size\\\":2207,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/8c6ba71e94b88b878391c8e5da16258ce5be9e4d\\\"},{\\\"path\\\":\\\"wasm/preload/surface_functions_fsh.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"0d0a99c6e7434968efafcd53b49d7fd820fed35b\\\",\\\"size\\\":475,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/0d0a99c6e7434968efafcd53b49d7fd820fed35b\\\"},{\\\"path\\\":\\\"wasm/preload/surface_functions_fsh_adreno.glsl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"37bda5fb525b618ba7125299678293214cf0ecfb\\\",\\\"size\\\":339,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/37bda5fb525b618ba7125299678293214cf0ecfb\\\"},{\\\"path\\\":\\\"wasm/run.sh\\\",\\\"mode\\\":\\\"100755\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"b98a1f9183763d66173e9afe335863ce7eeb1cc7\\\",\\\"size\\\":93,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/b98a1f9183763d66173e9afe335863ce7eeb1cc7\\\"},{\\\"path\\\":\\\"wasm/src\\\",\\\"mode\\\":\\\"040000\\\",\\\"type\\\":\\\"tree\\\",\\\"sha\\\":\\\"741fc5c8aa3922a112cee92f1fadf6612500003a\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/741fc5c8aa3922a112cee92f1fadf6612500003a\\\"},{\\\"path\\\":\\\"wasm/src/cpp\\\",\\\"mode\\\":\\\"040000\\\",\\\"type\\\":\\\"tree\\\",\\\"sha\\\":\\\"ceed7911230cb3cf25fcae03b41d323d14ec9445\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/ceed7911230cb3cf25fcae03b41d323d14ec9445\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROARWeb.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"78bfb4b513b8ce58bb2c07631364bc20bc92704f\\\",\\\"size\\\":6017,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/78bfb4b513b8ce58bb2c07631364bc20bc92704f\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROARWeb.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"34905642a56bebc7aa4639d178c089927ee19fe3\\\",\\\"size\\\":8272,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/34905642a56bebc7aa4639d178c089927ee19fe3\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VRODriverOpenGLWasm.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"127094d5625469c052bf75f206c452ac72d105ac\\\",\\\"size\\\":3968,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/127094d5625469c052bf75f206c452ac72d105ac\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROImageWasm.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"966f922bdc7674ce26b06b403609f21a5df1d49d\\\",\\\"size\\\":4402,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/966f922bdc7674ce26b06b403609f21a5df1d49d\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROImageWasm.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"3e670a1e28b72a3f98bceabf1bbaf0498c794a7b\\\",\\\"size\\\":1088,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/3e670a1e28b72a3f98bceabf1bbaf0498c794a7b\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROInputControllerWasm.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"4fb6cca82bc6ace36dce3436ed66a397a9180d5f\\\",\\\"size\\\":3154,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/4fb6cca82bc6ace36dce3436ed66a397a9180d5f\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROInputControllerWasm.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"c8f9797b1c9c1930ccc691fcab3a08dc6935ff57\\\",\\\"size\\\":2038,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/c8f9797b1c9c1930ccc691fcab3a08dc6935ff57\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROInputPresenterWasm.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"d7015464ff96255d095365bbcf8cb10165ed0fd1\\\",\\\"size\\\":932,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/d7015464ff96255d095365bbcf8cb10165ed0fd1\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROJpegReader.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"8617c9e2e9eda31a56a7e9523b2bb8a6c47bc376\\\",\\\"size\\\":9972,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/8617c9e2e9eda31a56a7e9523b2bb8a6c47bc376\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROJpegReader.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"f1f381c52ea45c8a5204e8c7a4c0a546413bfae2\\\",\\\"size\\\":408,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/f1f381c52ea45c8a5204e8c7a4c0a546413bfae2\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROSceneWeb.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"e27d2f2df76f2eabf734a6308f3b1aa582104a57\\\",\\\"size\\\":97072,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/e27d2f2df76f2eabf734a6308f3b1aa582104a57\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROSceneWeb.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"54cedf9c35c29ebb20397ad9ed1c7667454a0d06\\\",\\\"size\\\":4153,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/54cedf9c35c29ebb20397ad9ed1c7667454a0d06\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROTypefaceWasm.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"ca48fc7c489b2a25113e438cf396f8f639001cdb\\\",\\\"size\\\":3919,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/ca48fc7c489b2a25113e438cf396f8f639001cdb\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROTypefaceWasm.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"4e27bc7bab958e52761d3abc4acadd4a3f079e6e\\\",\\\"size\\\":1056,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/4e27bc7bab958e52761d3abc4acadd4a3f079e6e\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROViewScene.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"094d6caf9908dd787193fc2f350e62570199d187\\\",\\\"size\\\":3725,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/094d6caf9908dd787193fc2f350e62570199d187\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROViewScene.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"ee1fb0c5217492a721bcc1557f571fa73c3799a3\\\",\\\"size\\\":982,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/ee1fb0c5217492a721bcc1557f571fa73c3799a3\\\"},{\\\"path\\\":\\\"wasm/src/cpp/VROWasmCAPI.h\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"99419baea97e4e0872c9ffb5d728091ba2b14e9a\\\",\\\"size\\\":4322,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/99419baea97e4e0872c9ffb5d728091ba2b14e9a\\\"},{\\\"path\\\":\\\"wasm/src/js\\\",\\\"mode\\\":\\\"040000\\\",\\\"type\\\":\\\"tree\\\",\\\"sha\\\":\\\"d74fb72602a5bf04829318c00951f31eeadf20bc\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/d74fb72602a5bf04829318c00951f31eeadf20bc\\\"},{\\\"path\\\":\\\"wasm/src/js/TestAPI.js\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"db0f08acf95d07f623cc54eddb3e628a53d4c898\\\",\\\"size\\\":819,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/db0f08acf95d07f623cc54eddb3e628a53d4c898\\\"},{\\\"path\\\":\\\"wasm/test\\\",\\\"mode\\\":\\\"040000\\\",\\\"type\\\":\\\"tree\\\",\\\"sha\\\":\\\"0c737cf2538d4e7fcd3ec3cbd357eeb0540d16af\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/0c737cf2538d4e7fcd3ec3cbd357eeb0540d16af\\\"},{\\\"path\\\":\\\"wasm/test/fbx\\\",\\\"mode\\\":\\\"040000\\\",\\\"type\\\":\\\"tree\\\",\\\"sha\\\":\\\"3b892ebb1614c0bd378c64c881e8210ee572822c\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/3b892ebb1614c0bd378c64c881e8210ee572822c\\\"},{\\\"path\\\":\\\"wasm/test/fbx/bootstrap.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"7cd58c5bbd43439d3608bbf10c5c56db4ee2d732\\\",\\\"size\\\":274,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/7cd58c5bbd43439d3608bbf10c5c56db4ee2d732\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload\\\",\\\"mode\\\":\\\"040000\\\",\\\"type\\\":\\\"tree\\\",\\\"sha\\\":\\\"c5c7de41f000f946121f1489e04442e9c4581894\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/c5c7de41f000f946121f1489e04442e9c4581894\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/Lamborginhi Aventador_diffuse.jpeg\\\",\\\"mode\\\":\\\"100755\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"6a6dfd6c92e75f097724103cb313a57c07256be8\\\",\\\"size\\\":1454385,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/6a6dfd6c92e75f097724103cb313a57c07256be8\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/Lamborginhi Aventador_gloss.jpeg\\\",\\\"mode\\\":\\\"100755\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"f867f7c8fec24abc0d17cf7d86862995a5ac38d0\\\",\\\"size\\\":560449,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/f867f7c8fec24abc0d17cf7d86862995a5ac38d0\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/Lamborginhi Aventador_spec.jpeg\\\",\\\"mode\\\":\\\"100755\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"dbadcb836b4447681397b47a20017256782d620d\\\",\\\"size\\\":1129272,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/dbadcb836b4447681397b47a20017256782d620d\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/blinn2_Base_Color.png\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"00c7394623e48038b366dc8937f247504ceb39b0\\\",\\\"size\\\":159075,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/00c7394623e48038b366dc8937f247504ceb39b0\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/blinn2_Metallic.png\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"4c060e87250b11dfa46c18142bc13443b1e14375\\\",\\\"size\\\":46773,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/4c060e87250b11dfa46c18142bc13443b1e14375\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/blinn2_Mixed_AO.png\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"285fa161fb750a87d09f8be1099a5427f5095252\\\",\\\"size\\\":24632,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/285fa161fb750a87d09f8be1099a5427f5095252\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/blinn2_Normal_DirectX.png\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"9f4b98a98fbcf727f26de24c9f92e64c97a540be\\\",\\\"size\\\":266010,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/9f4b98a98fbcf727f26de24c9f92e64c97a540be\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/blinn2_Roughness.png\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"ba1e1f5fd36eabe45b09beed326e1348f3438076\\\",\\\"size\\\":324239,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/ba1e1f5fd36eabe45b09beed326e1348f3438076\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/cylinder_pbr.vrx\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"3d78609ebfd3ba13ecc34b00ca5343b6037d07da\\\",\\\"size\\\":15295,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/3d78609ebfd3ba13ecc34b00ca5343b6037d07da\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/dragao_map.jpg\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"8ba1e012d11246b614b93c72030e6260835f991c\\\",\\\"size\\\":1812460,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/8ba1e012d11246b614b93c72030e6260835f991c\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/dragon.vrx\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"cbb2e0fb7ba234bd20b4c8d0dc45eb2dbdc963cb\\\",\\\"size\\\":2249340,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/cbb2e0fb7ba234bd20b4c8d0dc45eb2dbdc963cb\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/ibl_mans_outside.hdr\\\",\\\"mode\\\":\\\"100755\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"43d309ad9adce358ff545e0fd5cdc03ea1d835a9\\\",\\\"size\\\":6193189,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/43d309ad9adce358ff545e0fd5cdc03ea1d835a9\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/lamborghini.vrx\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"57c921dd847bf7634f55bbb81ebbcc6d6073263a\\\",\\\"size\\\":461437,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/57c921dd847bf7634f55bbb81ebbcc6d6073263a\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/object_pumpkin_diffuse.png\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"0930879fe6fc8820e8f17fcfede26dee956f11bc\\\",\\\"size\\\":306728,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/0930879fe6fc8820e8f17fcfede26dee956f11bc\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/object_pumpkin_inside_diffuse.png\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"4c54e080d266015e52e280d34ca19bf0cb1bc391\\\",\\\"size\\\":68645,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/4c54e080d266015e52e280d34ca19bf0cb1bc391\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/object_pumpkin_inside_normal.png\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"1583b2a8f88274520293553dccaccba0c5940be2\\\",\\\"size\\\":265235,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/1583b2a8f88274520293553dccaccba0c5940be2\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/object_pumpkin_normal.png\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"faa44dc0b115d180577272db5a94ce9e03ab8d98\\\",\\\"size\\\":904681,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/faa44dc0b115d180577272db5a94ce9e03ab8d98\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/object_pumpkin_specular.png\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"112c9ad3719929c4373e7d725a4d138e62e55d4f\\\",\\\"size\\\":47715,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/112c9ad3719929c4373e7d725a4d138e62e55d4f\\\"},{\\\"path\\\":\\\"wasm/test/fbx/preload/pumpkin.vrx\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"b96d5d134ff56d43db8fe0768674033527bf1804\\\",\\\"size\\\":281764,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/b96d5d134ff56d43db8fe0768674033527bf1804\\\"},{\\\"path\\\":\\\"wasm/test/obj\\\",\\\"mode\\\":\\\"040000\\\",\\\"type\\\":\\\"tree\\\",\\\"sha\\\":\\\"9e6eebb2c8640de3553f51b26f786432e3e9c9bc\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/9e6eebb2c8640de3553f51b26f786432e3e9c9bc\\\"},{\\\"path\\\":\\\"wasm/test/obj/preload\\\",\\\"mode\\\":\\\"040000\\\",\\\"type\\\":\\\"tree\\\",\\\"sha\\\":\\\"ff7accbd18e96041693bed634380729a2cf6fc96\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/ff7accbd18e96041693bed634380729a2cf6fc96\\\"},{\\\"path\\\":\\\"wasm/test/obj/preload/01_-_Default1noCulling.JPG\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"204d701368594ee321b28666da1167d8d665cccf\\\",\\\"size\\\":34307,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/204d701368594ee321b28666da1167d8d665cccf\\\"},{\\\"path\\\":\\\"wasm/test/obj/preload/male-02-1noCulling.JPG\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"1f3ea42efb21d61360174afad546c8b309eb7ac4\\\",\\\"size\\\":130731,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/1f3ea42efb21d61360174afad546c8b309eb7ac4\\\"},{\\\"path\\\":\\\"wasm/test/obj/preload/male02.mtl\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"fc2ad99cc1126adc8ca3d5e9ffb95fb9c58fda3c\\\",\\\"size\\\":1129,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/fc2ad99cc1126adc8ca3d5e9ffb95fb9c58fda3c\\\"},{\\\"path\\\":\\\"wasm/test/obj/preload/male02.obj\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"c788c80746e3fdbb540487a2197ef3e70e34dc10\\\",\\\"size\\\":464590,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/c788c80746e3fdbb540487a2197ef3e70e34dc10\\\"},{\\\"path\\\":\\\"wasm/test/obj/preload/orig_02_-_Defaul1noCulling.JPG\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"c5a2eed8e6372dcb7bd98b011e41a0510233a0f2\\\",\\\"size\\\":21891,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/c5a2eed8e6372dcb7bd98b011e41a0510233a0f2\\\"},{\\\"path\\\":\\\"wasm/test/pbr\\\",\\\"mode\\\":\\\"040000\\\",\\\"type\\\":\\\"tree\\\",\\\"sha\\\":\\\"6ce27f39769e2baae43bb991812e838c4f092664\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/6ce27f39769e2baae43bb991812e838c4f092664\\\"},{\\\"path\\\":\\\"wasm/test/pbr/bootstrap.cpp\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"55d90847762b7183c4341d696b0513317601585f\\\",\\\"size\\\":288,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/55d90847762b7183c4341d696b0513317601585f\\\"},{\\\"path\\\":\\\"wasm/test/pbr/preload\\\",\\\"mode\\\":\\\"040000\\\",\\\"type\\\":\\\"tree\\\",\\\"sha\\\":\\\"a95bf8e2acbf479616d33fe0b31f55b4331841d1\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/a95bf8e2acbf479616d33fe0b31f55b4331841d1\\\"},{\\\"path\\\":\\\"wasm/test/pbr/preload/ibl_mans_outside.hdr\\\",\\\"mode\\\":\\\"100755\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"43d309ad9adce358ff545e0fd5cdc03ea1d835a9\\\",\\\"size\\\":6193189,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/43d309ad9adce358ff545e0fd5cdc03ea1d835a9\\\"},{\\\"path\\\":\\\"wasm/test/pbr/preload/ibl_newport_loft.hdr\\\",\\\"mode\\\":\\\"100755\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"93f4d9c4a17cdb6ffd7d42673f95aacd6e5671ae\\\",\\\"size\\\":3843910,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/93f4d9c4a17cdb6ffd7d42673f95aacd6e5671ae\\\"},{\\\"path\\\":\\\"wasm/test/pbr/preload/ibl_ridgecrest_road.hdr\\\",\\\"mode\\\":\\\"100755\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"6272080c49aa5a0fc665299012a1b8a80e17373e\\\",\\\"size\\\":6594471,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/6272080c49aa5a0fc665299012a1b8a80e17373e\\\"},{\\\"path\\\":\\\"wasm/test/pbr/preload/ibl_wooden_door.hdr\\\",\\\"mode\\\":\\\"100755\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"d9a8fd88ee9354ee6976716ae56476ab85a824ec\\\",\\\"size\\\":6679282,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/d9a8fd88ee9354ee6976716ae56476ab85a824ec\\\"},{\\\"path\\\":\\\"wasm/test/viro_shell.html\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"2580994c4b3523c1eafc994ef5390d1f464a8cb2\\\",\\\"size\\\":504,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/2580994c4b3523c1eafc994ef5390d1f464a8cb2\\\"},{\\\"path\\\":\\\"wasm/test/web\\\",\\\"mode\\\":\\\"040000\\\",\\\"type\\\":\\\"tree\\\",\\\"sha\\\":\\\"97a0c9f6c2c48d87fbaeae3567dc6a5e563b394b\\\",\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/trees/97a0c9f6c2c48d87fbaeae3567dc6a5e563b394b\\\"},{\\\"path\\\":\\\"wasm/test/web/index.html\\\",\\\"mode\\\":\\\"100644\\\",\\\"type\\\":\\\"blob\\\",\\\"sha\\\":\\\"730127130b9941031b3d107fe2a22dae1f080581\\\",\\\"size\\\":2321,\\\"url\\\":\\\"https://api.github.com/repos/ReactVision/virocore/git/blobs/730127130b9941031b3d107fe2a22dae1f080581\\\"}],\\\"truncated\\\":false}\",\"display_url\":\"https://api.github.com/repos/ReactVision/virocore/git/trees/main?recursive=1\"}},\"isError\":false}"}],"isError":false}
> ```
>
> Searched the web for `https://github.com/goldfire/howler.js#3d-spatial-audio`
>
> MCP tool call
>
> codex_apps.github.fetch_file
>
> ```json
> {
>   "repository_full_name": "ReactVision/virocore",
>   "path": "ViroRenderer/VROGVRUtil.cpp"
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "content": "//\n//  VROGVRUtil.cpp\n//  ViroRenderer\n//\n//  Created by Raj Advani on 3/11/17\n//  Copyright © 2017 Viro Media. All rights reserved.\n//\n//  Permission is hereby granted, free of charge, to any person obtaining\n//  a copy of this software and associated documentation files (the\n//  \"Software\"), to deal in the Software without restriction, including\n//  without limitation the rights to use, copy, modify, merge, publish,\n//  distribute, sublicense, and/or sell copies of the Software, and to\n//  permit persons to whom the Software is furnished to do so, subject to\n//  the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included\n//  in all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\n//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.\n//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY\n//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,\n//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE\n//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n\n#include \"VROGVRUtil.h\"\n\nVROMatrix4f VROGVRUtil::toMatrix4f(const gvr::Mat4f &glm) {\n    float m[16] = {\n            glm.m[0][0], glm.m[1][0], glm.m[2][0], glm.m[3][0],\n            glm.m[0][1], glm.m[1][1], glm.m[2][1], glm.m[3][1],\n            glm.m[0][2], glm.m[1][2], glm.m[2][2], glm.m[3][2],\n            glm.m[0][3], glm.m[1][3], glm.m[2][3], glm.m[3][3],\n    };\n\n    return VROMatrix4f(m);\n}\n\ngvr::Mat4f VROGVRUtil::toGVRMat4f(VROMatrix4f m) {\n    gvr::Mat4f glm;\n    glm.m[0][0] = m[0];\n    glm.m[1][0] = m[1];\n    glm.m[2][0] = m[2];\n    glm.m[3][0] = m[3];\n    glm.m[0][1] = m[4];\n    glm.m[1][1] = m[5];\n    glm.m[2][1] = m[6];\n    glm.m[3][1] = m[7];\n    glm.m[0][2] = m[8];\n    glm.m[1][2] = m[9];\n    glm.m[2][2] = m[10];\n    glm.m[3][2] = m[11];\n    glm.m[0][3] = m[12];\n    glm.m[1][3] = m[13];\n    glm.m[2][3] = m[14];\n    glm.m[3][3] = m[15];\n\n    return glm;\n}\n\n",
>   "encoding": "utf-8",
>   "sha": "c82e2a73f362315473b102cd68e31a58de51fd99",
>   "display_url": "https://github.com/ReactVision/virocore/blob/main/ViroRenderer/VROGVRUtil.cpp",
>   "display_title": "VROGVRUtil.cpp"
> }
> ```
>
> MCP tool call
>
> codex_apps.github.fetch_file
>
> ```json
> {
>   "repository_full_name": "ReactVision/virocore",
>   "path": "ViroRenderer/VROSoundGVR.cpp"
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "content": "//\n//  VROSoundGVR.cpp\n//  ViroRenderer\n//\n//  Created by Andy Chu on 1/26/17.\n//  Copyright © 2017 Viro Media. All rights reserved.\n//\n//  Permission is hereby granted, free of charge, to any person obtaining\n//  a copy of this software and associated documentation files (the\n//  \"Software\"), to deal in the Software without restriction, including\n//  without limitation the rights to use, copy, modify, merge, publish,\n//  distribute, sublicense, and/or sell copies of the Software, and to\n//  permit persons to whom the Software is furnished to do so, subject to\n//  the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included\n//  in all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\n//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.\n//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY\n//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,\n//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE\n//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n\n\n#include \"VROSoundGVR.h\"\n#include \"VROSoundDataGVR.h\"\n#include \"VROLog.h\"\n#include \"vr/gvr/capi/include/gvr_audio.h\"\n\nstd::shared_ptr<VROSoundGVR> VROSoundGVR::create(std::string resource, VROResourceType resourceType,\n                                                 std::shared_ptr<gvr::AudioApi> gvrAudio,\n                                                 VROSoundType type) {\n    std::shared_ptr<VROSoundGVR> sound = std::make_shared<VROSoundGVR>(resource, resourceType, gvrAudio,\n                                                                       type);\n    sound->setup();\n    return sound;\n}\n\nstd::shared_ptr<VROSoundGVR> VROSoundGVR::create(std::shared_ptr<VROSoundData> data,\n                                                 std::shared_ptr<gvr::AudioApi> gvrAudio,\n                                                 VROSoundType type) {\n    std::shared_ptr<VROSoundGVR> sound = std::make_shared<VROSoundGVR>(data, gvrAudio, type);\n    sound->setup();\n    return sound;\n}\n\nVROSoundGVR::VROSoundGVR(std::string resource, VROResourceType resourceType,\n                         std::shared_ptr<gvr::AudioApi> gvrAudio,\n                         VROSoundType type) :\n    _gvrAudio(gvrAudio) {\n    _type = type;\n    std::shared_ptr<VROSoundDataGVR> data = VROSoundDataGVR::create(resource, resourceType);\n    _data = std::dynamic_pointer_cast<VROSoundData>(data);\n    _gvrRolloffType = GVR_AUDIO_ROLLOFF_NONE;\n}\n\nVROSoundGVR::VROSoundGVR(std::shared_ptr<VROSoundData> data, std::shared_ptr<gvr::AudioApi> gvrAudio,\n                         VROSoundType type) :\n    _data(data),\n    _gvrAudio(gvrAudio) {\n    _type = type;\n    _gvrRolloffType = GVR_AUDIO_ROLLOFF_NONE;\n}\n\nVROSoundGVR::~VROSoundGVR() {\n    std::shared_ptr<gvr::AudioApi> gvrAudio = _gvrAudio.lock();\n    if (!gvrAudio) {\n        return;\n    }\n    \n    if (gvrAudio && gvrAudio->IsSoundPlaying(_audioId)) {\n        gvrAudio->PauseSound(_audioId);\n    }\n    if (gvrAudio && _data) {\n        gvrAudio->UnloadSoundfile(_data->getLocalFilePath());\n    }\n}\n\nvoid VROSoundGVR::setup() {\n    _data->setDelegate(shared_from_this());\n    if (_ready) {\n        _gvrAudio.lock()->PreloadSoundfile(_data->getLocalFilePath());\n    }\n}\n\nvoid VROSoundGVR::play() {\n    if (!_ready) {\n        pwarn(\"VROSoundGVR play() called before it's ready.\");\n        return;\n    }\n    std::shared_ptr<gvr::AudioApi> gvrAudio = _gvrAudio.lock();\n    if (!gvrAudio) {\n        return;\n    }\n\n    gvrAudio->Resume();\n\n    // Check if a loaded sound has become invalid; if so, we need\n    // to stop it (to destroy it), and reload it\n    if (_audioId != -1 && !gvrAudio->IsSourceIdValid(_audioId)) {\n        gvrAudio->StopSound(_audioId);\n        _audioId = -1;\n    }\n\n    // create the sound if it hasn't been created yet.\n    if (_audioId == -1) {\n\n        // For some reason GVR behaves differently between iOS and Android where on iOS it does not\n        // like the path starting with \"file://\" whereas their Android API does want it, so remove the\n        // \"file://\" prefix only on iOS\n#if VRO_PLATFORM_ANDROID\n        std::string path = _data->getLocalFilePath();\n#else\n        std::string path = _data->getLocalFilePath().substr(7);\n#endif\n        switch (_type) {\n            case VROSoundType::Normal:\n                _audioId = gvrAudio->CreateStereoSound(path);\n                break;\n            case VROSoundType::Spatial:\n                _audioId = gvrAudio->CreateSoundObject(path);\n                break;\n            case VROSoundType::SoundField:\n                _audioId = gvrAudio->CreateSoundfield(path);\n                break;\n        }\n\n        setProperties();\n        gvrAudio->PlaySound(_audioId, _loop);\n    }\n    else {\n        gvrAudio->ResumeSound(_audioId);\n    }\n\n    _paused = false;\n}\n\nvoid VROSoundGVR::pause() {\n    std::shared_ptr<gvr::AudioApi> gvrAudio = _gvrAudio.lock();\n    if (!gvrAudio) {\n        return;\n    }\n    if (_audioId != -1) {\n        gvrAudio->PauseSound(_audioId);\n        _paused = true;\n    }\n}\n\nvoid VROSoundGVR::setVolume(float volume) {\n    _volume = volume;\n    \n    std::shared_ptr<gvr::AudioApi> gvrAudio = _gvrAudio.lock();\n    if (gvrAudio && _audioId != -1) {\n        if (!_muted) {\n            gvrAudio->SetSoundVolume(_audioId, volume);\n        }\n    }\n}\n\nvoid VROSoundGVR::setMuted(bool muted) {\n    _muted = muted;\n    \n    std::shared_ptr<gvr::AudioApi> gvrAudio = _gvrAudio.lock();\n    if (gvrAudio && _audioId != -1) {\n        if (muted) {\n            gvrAudio->SetSoundVolume(_audioId, 0);\n        } else {\n            gvrAudio->SetSoundVolume(_audioId, _volume);\n        }\n    }\n}\n\nvoid VROSoundGVR::setLoop(bool loop) {\n    if (loop == _loop) {\n        return;\n    }\n\n    _loop = loop;\n    std::shared_ptr<gvr::AudioApi> gvrAudio = _gvrAudio.lock();\n    if (gvrAudio && _audioId != -1) {\n        // We have to stop the sound and recreate it to change the\n        // _loop setting\n        gvrAudio->StopSound(_audioId);\n        if (!_paused) {\n            play();\n        }\n    }\n}\n\nvoid VROSoundGVR::seekToTime(float seconds) {\n    // no-op: GVR doesn't support this yet\n}\n\nvoid VROSoundGVR::setRotation(VROQuaternion rotation) {\n    _rotation = rotation;\n    \n    std::shared_ptr<gvr::AudioApi> gvrAudio = _gvrAudio.lock();\n    if (gvrAudio && _audioId != -1 && _type == VROSoundType::SoundField) {\n        gvrAudio->SetSoundfieldRotation(_audioId,\n                                         {rotation.X, rotation.Y, rotation.Z, rotation.W});\n    }\n}\n\nvoid VROSoundGVR::setPosition(VROVector3f position) {\n    _position = position;\n}\n\nVROVector3f VROSoundGVR::getPosition() {\n    return _position;\n}\n\nvoid VROSoundGVR::setTransformedPosition(VROVector3f transformedPosition) {\n    _transformedPosition = transformedPosition;\n    \n    std::shared_ptr<gvr::AudioApi> gvrAudio = _gvrAudio.lock();\n    if (gvrAudio && _audioId != -1 && _type == VROSoundType::Spatial) {\n        gvrAudio->SetSoundObjectPosition(_audioId, _transformedPosition.x, _transformedPosition.y,\n                                          _transformedPosition.z);\n    }\n}\n\nvoid VROSoundGVR::setDistanceRolloffModel(VROSoundRolloffModel model, float minDistance,\n                                              float maxDistance) {\n    _rolloffModel = model;\n    _rolloffMinDistance = minDistance;\n    _rolloffMaxDistance = maxDistance;\n    \n    switch(model) {\n        case VROSoundRolloffModel::Linear:\n            _gvrRolloffType = GVR_AUDIO_ROLLOFF_LINEAR;\n            break;\n        case VROSoundRolloffModel::Logarithmic:\n            _gvrRolloffType = GVR_AUDIO_ROLLOFF_LOGARITHMIC;\n            break;\n        case VROSoundRolloffModel::None:\n            _gvrRolloffType = GVR_AUDIO_ROLLOFF_NONE;\n            break;\n    }\n    \n    std::shared_ptr<gvr::AudioApi> gvrAudio = _gvrAudio.lock();\n    if (gvrAudio && _audioId != -1 && _type == VROSoundType::Spatial) {\n        gvrAudio->SetSoundObjectDistanceRolloffModel(_audioId, (gvr_audio_distance_rolloff_type) _gvrRolloffType,\n                                                      _rolloffMinDistance, _rolloffMaxDistance);\n    }\n}\n\nvoid VROSoundGVR::setDelegate(std::shared_ptr<VROSoundDelegateInternal> delegate) {\n    _delegate = delegate;\n    if (_ready && _delegate) {\n        _delegate->soundIsReady();\n    }\n}\n\nvoid VROSoundGVR::dataIsReady() {\n    _ready = true;\n    if (_delegate) {\n        _delegate->soundIsReady();\n    }\n}\n\nvoid VROSoundGVR::dataError(std::string error) {\n    if (_delegate) {\n        _delegate->soundDidFail(error);\n    }\n}\n\nvoid VROSoundGVR::setProperties() {\n    if (_audioId == -1) {\n        return;\n    }\n    std::shared_ptr<gvr::AudioApi> gvrAudio = _gvrAudio.lock();\n    if (!gvrAudio) {\n        return;\n    }\n\n    gvrAudio->SetSoundVolume(_audioId, _muted ? 0 : _volume);\n    \n    if (_type == VROSoundType::Spatial) {\n        gvrAudio->SetSoundObjectPosition(_audioId, _transformedPosition.x, _transformedPosition.y,\n                                          _transformedPosition.z);\n        gvrAudio->SetSoundObjectDistanceRolloffModel(_audioId, (gvr_audio_distance_rolloff_type) _gvrRolloffType,\n                                                      _rolloffMinDistance, _rolloffMaxDistance);\n    } else if (_type == VROSoundType::SoundField) {\n        gvrAudio->SetSoundfieldRotation(_audioId,\n                                         {_rotation.X, _rotation.Y, _rotation.Z, _rotation.W});\n    }\n}\n",
>   "encoding": "utf-8",
>   "sha": "bd731022cbf1114c428f38a82080510aab3551dd",
>   "display_url": "https://github.com/ReactVision/virocore/blob/main/ViroRenderer/VROSoundGVR.cpp",
>   "display_title": "VROSoundGVR.cpp"
> }
> ```
>
> MCP tool call
>
> codex_apps.github.fetch_file
>
> ```json
> {
>   "repository_full_name": "ReactVision/virocore",
>   "path": "ViroRenderer/VRODriverOpenGL.cpp"
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "content": "//\n//  VRODriverOpenGL.cpp\n//  ViroRenderer\n//\n//  Created by Raj Advani on 11/19/18.\n//  Copyright © 2018 Viro Media. All rights reserved.\n//\n//  Permission is hereby granted, free of charge, to any person obtaining\n//  a copy of this software and associated documentation files (the\n//  \"Software\"), to deal in the Software without restriction, including\n//  without limitation the rights to use, copy, modify, merge, publish,\n//  distribute, sublicense, and/or sell copies of the Software, and to\n//  permit persons to whom the Software is furnished to do so, subject to\n//  the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included\n//  in all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\n//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.\n//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY\n//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,\n//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE\n//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n#include \"VRODriverOpenGL.h\"\n\n// Note this class has limited functionality (most is in the header) but we still require a\n// cpp file in order to have a 'key function' which guarantees we get a strong global symbol\n// for this class in the typeinfo of the library, so that dynamic_cast works across dlopen\n// boundaries.\n//\n// See here: https://github.com/android-ndk/ndk/issues/533#issuecomment-335977747\nVRODriverOpenGL::VRODriverOpenGL() :\n        _gpuType(VROGPUType::Normal),\n        _lastPurgeFrame(0),\n        _softwareGammaPass(false),\n        _depthWritingEnabled(true),\n        _depthReadingEnabled(true),\n        _materialColorWritingMask(VROColorMaskAll),\n        _renderTargetColorWritingMask(VROColorMaskAll),\n        _aggregateColorWritingMask(VROColorMaskAll),\n        _cullMode(VROCullMode::None),\n        _blendMode(VROBlendMode::Alpha) {\n\n    _shaderFactory = std::unique_ptr<VROShaderFactory>(new VROShaderFactory());\n    _scheduler = std::make_shared<VROFrameScheduler>();\n}\n\nVRODriverOpenGL::~VRODriverOpenGL() {\n    // Delete all moribund (pending deletion) GPU resources\n    std::lock_guard<std::recursive_mutex> lock(_deletionMutex);\n\n    if (!_moribundTextures.empty()) {\n        GL( glDeleteTextures(_moribundTextures.size(), &_moribundTextures[0]) );\n        _moribundTextures.clear();\n    }\n\n    if (!_moribundFramebuffers.empty()) {\n        GL( glDeleteFramebuffers(_moribundFramebuffers.size(), &_moribundFramebuffers[0]) );\n        _moribundFramebuffers.clear();\n    }\n\n    if (!_moribundRenderbuffers.empty()) {\n        GL( glDeleteRenderbuffers(_moribundRenderbuffers.size(), &_moribundRenderbuffers[0]) );\n        _moribundRenderbuffers.clear();\n    }\n\n    if (!_moribundBuffers.empty()) {\n        GL( glDeleteBuffers(_moribundBuffers.size(), &_moribundBuffers[0]) );\n        _moribundBuffers.clear();\n    }\n\n    if (!_moribundShaders.empty()) {\n        for (auto shader : _moribundShaders) {\n            GL( glDeleteShader(shader) );\n        }\n        _moribundShaders.clear();\n    }\n\n    if (!_moribundPrograms.empty()) {\n        for (auto program : _moribundPrograms) {\n            GL( glDeleteProgram(program) );\n        }\n        _moribundPrograms.clear();\n    }\n\n    // Clear shader factory to release compiled shaders\n    _shaderFactory.reset();\n\n    // Clear lighting UBOs\n    _lightingUBOs.clear();\n}\n",
>   "encoding": "utf-8",
>   "sha": "b7d242083072c056e0744ad09a56b09d43ecdd49",
>   "display_url": "https://github.com/ReactVision/virocore/blob/main/ViroRenderer/VRODriverOpenGL.cpp",
>   "display_title": "VRODriverOpenGL.cpp"
> }
> ```
>
> Searched the web for `'updatePlayerPositionInfo'`
>
> MCP tool call
>
> codex_apps.github.fetch_file
>
> ```json
> {
>   "repository_full_name": "ReactVision/virocore",
>   "path": "android/sharedCode/src/main/cpp/VRODriverOpenGLAndroid.cpp"
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "content": "//\n//  VRODriverOpenGLAndroid.cpp\n//  ViroRenderer\n//\n//  Created by Raj Advani on 11/19/18.\n//  Copyright © 2018 Viro Media. All rights reserved.\n//\n//  Permission is hereby granted, free of charge, to any person obtaining\n//  a copy of this software and associated documentation files (the\n//  \"Software\"), to deal in the Software without restriction, including\n//  without limitation the rights to use, copy, modify, merge, publish,\n//  distribute, sublicense, and/or sell copies of the Software, and to\n//  permit persons to whom the Software is furnished to do so, subject to\n//  the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included\n//  in all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\n//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.\n//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY\n//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,\n//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE\n//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n\n#include \"VRODriverOpenGLAndroid.h\"\n\n// Note this class has limited functionality (most is in the header) but we still require a\n// cpp file in order to have a 'key function' which guarantees we get a strong global symbol\n// for this class in the typeinfo of the library, so that dynamic_cast works across dlopen\n// boundaries.\n//\n// See here: https://github.com/android-ndk/ndk/issues/533#issuecomment-335977747\nVRODriverOpenGLAndroid::VRODriverOpenGLAndroid(std::shared_ptr<gvr::AudioApi> gvrAudio) :\n        _gvrAudio(gvrAudio),\n        _ft(nullptr) {\n}\n\nVRODriverOpenGLAndroid::~VRODriverOpenGLAndroid() {\n    if (_ft != nullptr) {\n        FT_Done_FreeType(_ft);\n        _ft = nullptr;\n    }\n}",
>   "encoding": "utf-8",
>   "sha": "d4e6a122f8443cef8987a644a7e85d6dbd3294da",
>   "display_url": "https://github.com/ReactVision/virocore/blob/main/android/sharedCode/src/main/cpp/VRODriverOpenGLAndroid.cpp",
>   "display_title": "VRODriverOpenGLAndroid.cpp"
> }
> ```
>
> MCP tool call
>
> codex_apps.github.fetch_file
>
> ```json
> {
>   "repository_full_name": "ReactVision/virocore",
>   "path": "ios/ViroKit/VRODriverOpenGLiOS.mm"
> }
> ```
>
> Error: GitHub API error 404: {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/contents#get-repository-content","status":"404"}
>
> </details>
>
> ViroReact 确实提供了可放置、循环播放的三维声源，也有官方 Expo 接入方案；代价是会带入整套 AR／VR 框架。另一个 iOS 音频库虽然内部用了 HRTF，但还没把声源位置接口暴露给 JS，不能直接满足你的需求。
>
> <details><summary>Called 5 tools, searched the web</summary>
>
> MCP tool call
>
> codex_apps.github.fetch_file
>
> ```json
> {
>   "repository_full_name": "ReactVision/virocore",
>   "path": "android/sharedCode/src/main/cpp/VROSceneRenderer.cpp"
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "content": "//\n//  Created by vik.advani on 10/11/18.\n//  Copyright © 2018 Viro Media. All rights reserved.\n//\n//  Permission is hereby granted, free of charge, to any person obtaining\n//  a copy of this software and associated documentation files (the\n//  \"Software\"), to deal in the Software without restriction, including\n//  without limitation the rights to use, copy, modify, merge, publish,\n//  distribute, sublicense, and/or sell copies of the Software, and to\n//  permit persons to whom the Software is furnished to do so, subject to\n//  the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included\n//  in all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\n//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.\n//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY\n//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,\n//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE\n//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n\n#include \"VROSceneRenderer.h\"\n#include \"VROProjector.h\"\n\n#include <memory>\n#include <string>\n#include <thread>\n#include <vector>\n\nstd::vector<VROHitTestResult> VROSceneRenderer::performHitTest(int x, int y, bool boundsOnly) {\n    std::vector<VROHitTestResult> results;\n    if (!_driver) {\n        return results;\n    }\n\n    int viewportArr[4] = {0, 0, (int) getRenderer()->getCamera().getViewport().getWidth(),\n                                (int) getRenderer()->getCamera().getViewport().getHeight()};\n    VROMatrix4f projection = getRenderer()->getCamera().getProjection();\n    VROMatrix4f mvp = projection.multiply(getRenderer()->getCamera().getLookAtMatrix());\n\n    // Unproject the touch vector at z = 0 and z = 1\n    VROVector3f resultNear;\n    VROVector3f resultFar;\n\n    VROProjector::unproject(VROVector3f(x, y, 0), mvp.getArray(), viewportArr, &resultNear);\n    VROProjector::unproject(VROVector3f(x, y, 1), mvp.getArray(), viewportArr, &resultFar);\n\n    // Subtract resultNear from resultFar to get the vector\n    VROVector3f ray = (resultFar - resultNear).normalize();\n    return this->performHitTest(getRenderer()->getCamera().getPosition(), ray, boundsOnly);\n}\n\nstd::vector<VROHitTestResult> VROSceneRenderer::performHitTest(VROVector3f origin, VROVector3f ray, bool boundsOnly) {\n    std::vector<VROHitTestResult> results;\n    std::shared_ptr<VROScene> scene = _sceneController->getScene();\n    std::shared_ptr<VROPortal> sceneRootNode = scene->getRootNode();\n    // Grab all the nodes that were hit\n    std::vector<VROHitTestResult> nodeResults = sceneRootNode->hitTest(_renderer->getCamera(), origin, ray, boundsOnly);\n    results.insert(results.end(), nodeResults.begin(), nodeResults.end());\n\n    // Sort and get the closest node\n    std::sort(results.begin(), results.end(), [](VROHitTestResult a, VROHitTestResult b) {\n        return a.getDistance() < b.getDistance();\n    });\n\n    return results;\n}\n",
>   "encoding": "utf-8",
>   "sha": "3f68deb9e774aeae0db647048d383e607c5cb22f",
>   "display_url": "https://github.com/ReactVision/virocore/blob/main/android/sharedCode/src/main/cpp/VROSceneRenderer.cpp",
>   "display_title": "VROSceneRenderer.cpp"
> }
> ```
>
> MCP tool call
>
> codex_apps.github.fetch_file
>
> ```json
> {
>   "repository_full_name": "ReactVision/virocore",
>   "path": "ios/ViroKit/VRODriverOpenGLiOS.cpp"
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "content": "//\n//  VRODriverOpenGLiOS.cpp\n//  ViroKit\n//\n//  Created by Raj Advani on 12/5/17.\n//  Copyright © 2017 Viro Media. All rights reserved.\n//\n//  Permission is hereby granted, free of charge, to any person obtaining\n//  a copy of this software and associated documentation files (the\n//  \"Software\"), to deal in the Software without restriction, including\n//  without limitation the rights to use, copy, modify, merge, publish,\n//  distribute, sublicense, and/or sell copies of the Software, and to\n//  permit persons to whom the Software is furnished to do so, subject to\n//  the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included\n//  in all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\n//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.\n//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY\n//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,\n//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE\n//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n\n#include \"VRODriverOpenGLiOS.h\"\n#include \"vr/gvr/capi/include/gvr_audio.h\"\n\nvoid VRODriverOpenGLiOS::setSoundRoom(float sizeX, float sizeY, float sizeZ, std::string wallMaterial,\n                                      std::string ceilingMaterial, std::string floorMaterial) {\n    std::shared_ptr<gvr::AudioApi> gvrAudio = activateGVRAudio();\n\n    if (sizeX == 0 && sizeY == 0 && sizeZ == 0) {\n        gvrAudio->EnableRoom(false);\n    } else {\n        gvrAudio->EnableRoom(true);\n        gvrAudio->SetRoomProperties(sizeX, sizeY, sizeZ,\n                                    (gvr_audio_material_type) VROPlatformParseGVRAudioMaterial(wallMaterial),\n                                    (gvr_audio_material_type) VROPlatformParseGVRAudioMaterial(ceilingMaterial),\n                                    (gvr_audio_material_type) VROPlatformParseGVRAudioMaterial(floorMaterial));\n    }\n}\n",
>   "encoding": "utf-8",
>   "sha": "1497d5383dcc6100a1a55effeba5ded8980f79d1",
>   "display_url": "https://github.com/ReactVision/virocore/blob/main/ios/ViroKit/VRODriverOpenGLiOS.cpp",
>   "display_title": "VRODriverOpenGLiOS.cpp"
> }
> ```
>
> Searched the web for `site.docs.agora.io "spatial audio" "enable" "contact" "React Native" ...`
>
> MCP tool call
>
> codex_apps.github.search
>
> ```json
> {
>   "query": "BINAURAL",
>   "repository_name": "ReactVision/virocore",
>   "topn": 5
> }
> ```
>
> Error: RemoteProtocolError: Server disconnected without sending a response.
>
> MCP tool call
>
> codex_apps.github.search
>
> ```json
> {
>   "query": "activateGVRAudio",
>   "repository_name": "ReactVision/virocore",
>   "topn": 5
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "results": [
>     {
>       "url": "https://github.com/ReactVision/virocore/blob/23710240d2cab5d4e866f3dba44ef568d8e563b4/ios/ViroKit/VRODriverOpenGLiOS.h",
>       "path": "ios/ViroKit/VRODriverOpenGLiOS.h",
>       "display_url": "https://github.com/ReactVision/virocore/blob/23710240d2cab5d4e866f3dba44ef568d8e563b4/ios/ViroKit/VRODriverOpenGLiOS.h",
>       "display_title": "ios/ViroKit/VRODriverOpenGLiOS.h",
>       "text_matches": [
>         {
>           "property": "content",
>           "fragment": "    /*\n     We lazily initialize GVR audio until VIRO-2944 is resolved.\n     */\n    std::shared_ptr<gvr::AudioApi> activateGVRAudio() {\n        if (!_gvrAudio) {\n            _gvrAudio = std::make_shared<gvr::AudioApi>();\n            _gvrAudio->Init(GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY);",
>           "matches": [
>             {
>               "text": "activateGVRAudio",
>               "indices": [
>                 115,
>                 131
>               ]
>             }
>           ]
>         }
>       ]
>     },
>     {
>       "url": "https://github.com/ReactVision/virocore/blob/23710240d2cab5d4e866f3dba44ef568d8e563b4/ios/ViroKit/VRODriverOpenGLiOS.cpp",
>       "path": "ios/ViroKit/VRODriverOpenGLiOS.cpp",
>       "display_url": "https://github.com/ReactVision/virocore/blob/23710240d2cab5d4e866f3dba44ef568d8e563b4/ios/ViroKit/VRODriverOpenGLiOS.cpp",
>       "display_title": "ios/ViroKit/VRODriverOpenGLiOS.cpp",
>       "text_matches": [
>         {
>           "property": "content",
>           "fragment": "\nvoid VRODriverOpenGLiOS::setSoundRoom(float sizeX, float sizeY, float sizeZ, std::string wallMaterial,\n                                      std::string ceilingMaterial, std::string floorMaterial) {\n    std::shared_ptr<gvr::AudioApi> gvrAudio = activateGVRAudio();\n\n    if (sizeX == 0 && sizeY == 0 && sizeZ == 0) {\n        gvrAudio->EnableRoom(false);",
>           "matches": [
>             {
>               "text": "activateGVRAudio",
>               "indices": [
>                 246,
>                 262
>               ]
>             }
>           ]
>         }
>       ]
>     }
>   ]
> }
> ```
>
> MCP tool call
>
> codex_apps.github.search
>
> ```json
> {
>   "query": "GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY",
>   "repository_name": "ReactVision/virocore",
>   "topn": 5
> }
> ```
>
> ```text
> Action completed.
> ```
>
> ```json
> {
>   "results": [
>     {
>       "url": "https://github.com/ReactVision/virocore/blob/23710240d2cab5d4e866f3dba44ef568d8e563b4/ios/ViroKit/VRODriverOpenGLiOS.h",
>       "path": "ios/ViroKit/VRODriverOpenGLiOS.h",
>       "display_url": "https://github.com/ReactVision/virocore/blob/23710240d2cab5d4e866f3dba44ef568d8e563b4/ios/ViroKit/VRODriverOpenGLiOS.h",
>       "display_title": "ios/ViroKit/VRODriverOpenGLiOS.h",
>       "text_matches": [
>         {
>           "property": "content",
>           "fragment": "    std::shared_ptr<gvr::AudioApi> activateGVRAudio() {\n        if (!_gvrAudio) {\n            _gvrAudio = std::make_shared<gvr::AudioApi>();\n            _gvrAudio->Init(GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY);\n        }\n        return _gvrAudio;\n    }",
>           "matches": [
>             {
>               "text": "GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY",
>               "indices": [
>                 169,
>                 210
>               ]
>             }
>           ]
>         }
>       ]
>     },
>     {
>       "url": "https://github.com/ReactVision/virocore/blob/23710240d2cab5d4e866f3dba44ef568d8e563b4/android/sharedCode/src/main/cpp/jni/VRORenderer_JNI.cpp",
>       "path": "android/sharedCode/src/main/cpp/jni/VRORenderer_JNI.cpp",
>       "display_url": "https://github.com/ReactVision/virocore/blob/23710240d2cab5d4e866f3dba44ef568d8e563b4/android/sharedCode/src/main/cpp/jni/VRORenderer_JNI.cpp",
>       "display_title": "android/sharedCode/src/main/cpp/jni/VRORenderer_JNI.cpp",
>       "text_matches": [
>         {
>           "property": "content",
>           "fragment": "    std::shared_ptr<gvr::AudioApi> gvrAudio = std::make_shared<gvr::AudioApi>();\n    gvrAudio->Init(env, android_context, class_loader, GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY);\n    VROPlatformSetEnv(env, android_context, asset_mgr, platform_util);",
>           "matches": [
>             {
>               "text": "GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY",
>               "indices": [
>                 136,
>                 177
>               ]
>             }
>           ]
>         },
>         {
>           "property": "content",
>           "fragment": "    std::shared_ptr<gvr::AudioApi> gvrAudio = std::make_shared<gvr::AudioApi>();\n    gvrAudio->Init(env, android_context, class_loader, GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY);\n",
>           "matches": [
>             {
>               "text": "GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY",
>               "indices": [
>                 136,
>                 177
>               ]
>             }
>           ]
>         }
>       ]
>     },
>     {
>       "url": "https://github.com/ReactVision/virocore/blob/23710240d2cab5d4e866f3dba44ef568d8e563b4/android/libs/gvr/include/vr/gvr/capi/include/gvr_audio.h",
>       "path": "android/libs/gvr/include/vr/gvr/capi/include/gvr_audio.h",
>       "display_url": "https://github.com/ReactVision/virocore/blob/23710240d2cab5d4e866f3dba44ef568d8e563b4/android/libs/gvr/include/vr/gvr/capi/include/gvr_audio.h",
>       "display_title": "android/libs/gvr/include/vr/gvr/capi/include/gvr_audio.h",
>       "text_matches": [
>         {
>           "property": "content",
>           "fragment": "///   is enabled.\n/// - `GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY`:\n///   This renders sound objects over a virtual array of 16 loudspeakers",
>           "matches": [
>             {
>               "text": "GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY",
>               "indices": [
>                 25,
>                 66
>               ]
>             }
>           ]
>         },
>         {
>           "property": "content",
>           "fragment": "///     std::unique_ptr<gvr::AudioApi> gvr_audio_api(new gvr::AudioApi);\n///     gvr_audio_api->Init(GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY);\n///",
>           "matches": [
>             {
>               "text": "GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY",
>               "indices": [
>                 101,
>                 142
>               ]
>             }
>           ]
>         }
>       ]
>     },
>     {
>       "url": "https://github.com/ReactVision/virocore/blob/23710240d2cab5d4e866f3dba44ef568d8e563b4/android/libs/gvr/include/vr/gvr/capi/include/gvr_types.h",
>       "path": "android/libs/gvr/include/vr/gvr/capi/include/gvr_types.h",
>       "display_url": "https://github.com/ReactVision/virocore/blob/23710240d2cab5d4e866f3dba44ef568d8e563b4/android/libs/gvr/include/vr/gvr/capi/include/gvr_types.h",
>       "display_title": "android/libs/gvr/include/vr/gvr/capi/include/gvr_types.h",
>       "text_matches": [
>         {
>           "property": "content",
>           "fragment": "  GVR_AUDIO_RENDERING_BINAURAL_LOW_QUALITY = 1,\n  /// HRTF-based rendering over a virtual array of 16 loudspeakers arranged in\n  /// an approximate equidistribution about the around the listener’s head.\n  GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY = 2,\n} gvr_audio_rendering_mode;\n\n/// Room surface material names, used to set room properties.",
>           "matches": [
>             {
>               "text": "GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY",
>               "indices": [
>                 207,
>                 248
>               ]
>             }
>           ]
>         }
>       ]
>     },
>     {
>       "url": "https://github.com/ReactVision/virocore/blob/23710240d2cab5d4e866f3dba44ef568d8e563b4/android/sharedCode/src/main/cpp/jni/VRORendererARCore_JNI.cpp",
>       "path": "android/sharedCode/src/main/cpp/jni/VRORendererARCore_JNI.cpp",
>       "display_url": "https://github.com/ReactVision/virocore/blob/23710240d2cab5d4e866f3dba44ef568d8e563b4/android/sharedCode/src/main/cpp/jni/VRORendererARCore_JNI.cpp",
>       "display_title": "android/sharedCode/src/main/cpp/jni/VRORendererARCore_JNI.cpp",
>       "text_matches": [
>         {
>           "property": "content",
>           "fragment": "    VROPlatformSetType(VROPlatformType::AndroidARCore);\n\n    std::shared_ptr<gvr::AudioApi> gvrAudio = std::make_shared<gvr::AudioApi>();\n    gvrAudio->Init(env, android_context, class_loader, GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY);\n    VROPlatformSetEnv(env, android_context, asset_mgr, platform_util);\n\n    VRORendererConfiguration config;",
>           "matches": [
>             {
>               "text": "GVR_AUDIO_RENDERING_BINAURAL_HIGH_QUALITY",
>               "indices": [
>                 193,
>                 234
>               ]
>             }
>           ]
>         }
>       ]
>     }
>   ]
> }
> ```
>
> Searched the web for `https://viro-community.readme.io/docs/virospatialsound`
>
> </details>
</details>

**有。查到最接近你需求的是 ViroReact，但它会带入整套 AR／VR 框架。** 目前找到的候选是：

| 库 | 能力 | 对你的适用程度 |
|---|---|---|
| **[ViroReact](https://viro-community.readme.io/docs/virospatialsound)** | iOS、Android；多个三维声源、位置更新、循环播放 | **最值得先验证**，但框架较重 |
| **[react-native-agora](https://agoraio-extensions.github.io/react-native-agora/classes/SpatialAudioParams.html)** | 已封装空间音频，支持方位角、距离、高度 | 偏实时通信 SDK；离线冥想场景的授权和使用方式需进一步确认 |
| **[expo-ios-sonic-player](https://github.com/rit3zh/expo-ios-sonic-player)** | iOS 原生实现里用了 HRTF | 封装还不完整，不适合直接承担你的多声源需求 |
| **[react-native-audio-api](https://docs.swmansion.com/react-native-audio-api/docs/next/effects/panner-node/)** | 音频合成、混音、滤波、左右声像 | 当前内置定位仍只有 `equalpower`，没有完整 HRTF |

ViroReact 的接口已经很接近你的产品。在 Viro 场景中，可以这样放两个声源：

```tsx
<ViroSpatialSound
  source={require('./stream.wav')}
  position={[-2, 0, -3]}
  loop
  volume={0.5}
/>

<ViroSpatialSound
  source={require('./fire.wav')}
  position={[2, 0, 3]}
  loop
  volume={0.4}
/>
```

拖动时更新 `position` 即可，素材需要是**单声道**。我还核对了底层源码，两端都启用了 GVR 的高质量双耳渲染：[iOS 实现](https://github.com/ReactVision/virocore/blob/main/ios/ViroKit/VRODriverOpenGLiOS.h)、[Android 实现](https://github.com/ReactVision/virocore/blob/main/android/sharedCode/src/main/cpp/jni/VRORenderer_JNI.cpp)。它也提供[官方 Expo 接入方案](https://viro-community.readme.io/docs/integrating-with-expo)，需要 development build。

Sonic Player 则有个关键缺口：虽然 Swift 内部存在 `setSpatialAudioPosition`，但我检查到的 JS／Expo 导出接口没有暴露它，而且播放器结构围绕单个实例设计，所以暂时只能作为参考。

**针对你的 App，我会先用 ViroReact 验证多声源拖动和前后听感，再验证锁屏持续播放、循环接缝和功耗。** 这些目前只是文档及源码核查，还没有真机测试；对冥想产品，后台播放能否稳定工作会直接影响最终选型。

> 官方开发文档是不是已经有了完整的功能介绍和 API？其实不一定用第三方，我们可以做一个封装，然后开源，是吧？

<details><summary>2 previous messages</summary>

> 我核对一下两端官方文档覆盖的能力，尤其是 iOS 能否直接封装，以及 Android 是否还需要额外的 HRTF 实现。
>
> <details><summary>Searched the web</summary>
>
> Searched the web for `https://developer.apple.com/documentation/avfaudio/avaudioenvironmentnode?changes=_3`
>
> Searched the web for `site.developer.apple.com/documentation/avfaudio/avaudioenvironmentnode "mono" "listener" ...`
>
> </details>
</details>

**是的，尤其是 iOS：官方已经提供了音频引擎、三维定位和 HRTF API，我们可以基于它做一个 Expo 原生模块，再独立开源。**

Apple 的能力可以组成完整的处理链：

| 系统 API | 用途 |
|---|---|
| `AVAudioEngine` | 管理音频处理链和混音 |
| `AVAudioPlayerNode` | 播放每个声源 |
| `AVAudioEnvironmentNode` | 管理听者、声源空间关系、距离衰减和混响 |
| `.HRTF` / `.HRTFHQ` | 生成耳机里的双耳空间效果 |

HRTF 算法由系统执行，我们主要负责把这些能力组织成方便使用的接口。[Apple 官方文档](https://developer.apple.com/documentation/avfaudio/avaudio3dmixingrenderingalgorithm)

对外 API 可以设计成这样，下面是接口示意：

```ts
const scene = await SpatialAudio.createScene();

const stream = await scene.createSource({
  uri: 'stream.wav',
  loop: true,
  position: { x: -2, y: 0, z: -3 },
});

await scene.play();

// 拖动时更新位置
stream.setPosition({ x: 2, y: 0, z: 3 });

await scene.dispose();
```

**需要单独处理的是 Android。** 它的系统 `Spatializer` 没有提供与 Apple 对等的“逐个声源设置三维坐标”接口，所以目前不能承诺两端仅靠系统 API 就有相同能力。可以先完成 iOS 后端，保持公共接口独立，之后再补 Android 的空间音频实现。[Android 官方 API](https://developer.android.com/reference/android/media/Spatializer)

我建议首版聚焦：

- 多声源播放、循环、音量、三维位置和听者朝向。
- 拖动时平滑更新，处理循环接缝。
- 锁屏后台播放、来电中断、耳机连接变化和资源释放。
- 一个可拖动声源的示例 App，以及明确的平台能力说明。

这些才是封装的主要工程量。Expo 官方支持先在 App 内开发本地模块，之后整理成独立 npm 包分享；开发和测试使用 development build。[Expo 模块开发与分发](https://docs.expo.dev/workflow/customizing/#sharing-a-module-with-multiple-apps)

对你的纯音频产品，**先做一个专注声音的 iOS 封装，比引入整套 AR／VR 框架更贴合需求。**

> 如果原声不支持，封装也很难 workaround 吧

**对，薄封装只能暴露已有能力，补不出底层缺失的 HRTF 算法。** 我前面说“之后补 Android”确实说轻了。

这里有两种不同的工作量：

- **iOS：封装系统能力。** 系统已经提供 HRTF，主要处理接口、播放管理和生命周期。
- **Android：集成音频引擎。** 系统 `Spatializer` 没有我们需要的逐声源定位接口，需要引入现成的 HRTF 引擎，或者自行实现 DSP。处理完输出普通双声道音频即可，但这已经超出了简单封装。[Android API](https://developer.android.com/reference/android/media/Spatializer)

所以，**Android 系统没有直接接口，不等于 Android 无法实现；意味着这部分算法和运行成本要由 App 内的引擎承担。**

如果坚持“只用系统 API、保持轻量”，先做 iOS 版很合理。如果双平台完整空间音频是首版要求，就应该先验证 Android 引擎，再确定公共接口和开源库范围。

> 所以Android 也能做，但是比较复杂，得组合更多的原生 API，是这样么？

**Android 能做，更准确地说，需要组合“空间音频引擎＋原生播放 API”。**

处理流程是：

```text
多个音源 → HRTF 空间化处理 → 混音 → Android 播放 → 耳机
```

其中：

- **HRTF 引擎**负责根据声源位置，生成左右耳的声音。
- **Android 系统 API**负责音频输出、音频焦点、后台播放等。

复杂的地方在于：**HRTF 这一层需要由 App 集成，单纯多调用几个系统 API 无法补齐。** 使用现成引擎时，我们主要做接入和管理，无需从零写算法。

iOS 已经把这一层包含在系统音频框架中，因此封装起来更直接。

> HRTF 是两个平台都原生支持的？还是一个算法？

<details><summary>2 previous messages</summary>

> 我再核对一下官方定义，把 HRTF 本身和系统提供的实现分清楚。
>
> <details><summary>Searched the web</summary>
>
> Searched the web for `site.valvesoftware.github.io/steam-audio/doc/capi/guide.html HRTF pair filters head torso outer ear ...`
>
> </details>
</details>

**HRTF 本身是“头相关传递函数”，一种声学模型；利用它处理声音、产生空间感的才是算法。它不是某个平台专属的 API。**

它描述声音从某个方向传来时，经过头部和耳廓后，分别到达左右耳会发生怎样的变化。音频引擎利用这些数据进行滤波，生成双耳声音。[HRTF 原理](https://github.com/ValveSoftware/steam-audio/blob/master/core/doc/guide.rst#hrtf)

两端的区别是：

- **iOS：系统已经提供基于 HRTF 的渲染实现**，App 可以通过原生 API 使用。[Apple 文档](https://developer.apple.com/documentation/avfaudio/avaudio3dmixingrenderingalgorithm)
- **Android：有设备相关的系统空间音频能力，但没有与 Apple 对等的逐声源定位接口。** 你的 App 可以自带 HRTF 引擎来实现，不要求手机系统内置这套算法。[Android 文档](https://developer.android.com/reference/android/media/Spatializer)

我前面把“HRTF 模型”“HRTF 渲染算法”和“系统 API”混着简称了，容易造成“两端都有同一个原生接口”的误解。

> OK，了解了，所以 expo 实现多声音播放+全3d定位 是没问题的，对吧？
> 下一步，expo 实现任意绘图，不是一个 view，而是一个圆形，可以拖放不同音源到不同位置，也是可行的吧？不需要什么特别复杂工具

<details><summary>2 previous messages</summary>

> 我核对一下 Expo 里的圆形画布和拖动手势方案，并把界面实现与音频引擎的复杂度分开说明。
>
> <details><summary>Searched the web</summary>
>
> Searched the web for `site.reactnative.dev/docs/view-style-props borderRadius ...`
>
> </details>
</details>

**对，Expo 可以实现这套 App。** 多声音和完整 3D 定位，需要接入前面讨论的原生音频引擎；**圆形画布和拖放界面则是很常规的 React Native 开发，不需要复杂工具。**

“圆形”也可以由 `View` 实现：设置相同宽高和圆角半径即可，界面外观不会被矩形布局限制。需要同心圆、方位线或任意形状时，再用 [react-native-svg](https://docs.expo.dev/versions/latest/sdk/svg/) 绘制。

你描述的界面，用这些就够：

| 部分 | 实现方式 |
|---|---|
| 圆盘、距离圈、方向标记 | 普通样式或 SVG |
| 雨声、篝火等声源节点 | `View`、图标、图片 |
| 从素材栏拖进圆盘、移动位置 | Gesture Handler |
| 拖动、吸附、缩放动画 | Reanimated |

[Gesture Handler](https://docs.expo.dev/versions/latest/sdk/gesture-handler/) 和 [Reanimated](https://docs.expo.dev/versions/latest/sdk/reanimated/) 都有 Expo 官方接入文档。

**圆盘可以作为声音空间的俯视图：**

- 中心是听者。
- 左右拖动，对应空间的左右。
- 上下拖动，对应空间的前后。
- 离中心的距离，对应声源距离。
- 如果还需要声音来自头顶或脚下，增加一个“高度”控件即可。

圆盘中的拖动控制的是**水平面上的 360° 位置**，再加高度就能表达完整三维坐标。界面只要把坐标传给音频引擎，就能让声音随拖动变化；保存方案时保存这些坐标和播放参数即可。

> 考虑到视觉效果，是不是用 skia 之类的好一些？

<details><summary>2 previous messages</summary>

> 我查一下 Skia 在 Expo 里的支持，以及它和拖动动画的配合方式，看看是否更适合这个声音圆盘。
>
> <details><summary>Searched the web</summary>
>
> Searched the web for `https://docs.expo.dev/versions/latest/sdk/skia/`
>
> Searched the web for `React Native Skia official Reanimated gestures animations shared values ...`
>
> Searched the web for `https://wcandillon.github.io/react-native-skia/v2/docs/animations/gestures/`
>
> </details>
</details>

**是的，如果声音圆盘是 App 的核心视觉，我会更倾向于 Skia。** 它适合做持续变化的图形，Expo 也提供了[官方接入说明](https://docs.expo.dev/versions/latest/sdk/skia/)。

比如你可以做：

- 每个声源周围的柔和渐变、光晕和扩散波纹。
- 距离变化时，节点大小、透明度和影响范围平滑变化。
- 拖动时的跟随、吸附和边界反馈。
- 中心听者缓慢的呼吸动画。

我建议采用这个分工：

| 部分 | 技术 |
|---|---|
| 圆盘、声源外观、视觉效果 | Skia |
| 动画和位置变化 | Reanimated |
| 拖动、点击、长按 | Gesture Handler |
| 按钮、音源列表、设置面板 | 普通 React Native 组件 |

Skia 可以直接使用 Reanimated 的共享值驱动画面；官方也给出了用透明触摸层跟踪画布元素的方案，适合给每个音源建立拖动区域。[动画文档](https://wcandillon.github.io/react-native-skia/v2/docs/animations/animations/)、[手势文档](https://wcandillon.github.io/react-native-skia/v2/docs/animations/gestures/)

**这套组合足够，不需要 Unity 或完整的 3D 渲染工具。** Skia 绘制二维俯视圆盘，位置数据交给音频引擎处理三维声场。

对于冥想场景，我会把动效集中在操作反馈上：拖动时有细腻变化，开始聆听后逐渐安静，锁屏后停止视觉动画。

> expo 能绘制溶液里的气泡那种连续不断的动画效果么？

<details><summary>2 previous messages</summary>

> 我查一下 Skia 对持续动画、气泡融合和折射效果的支持，确认这种“液体里冒泡”的视觉该怎么实现。
>
> <details><summary>Searched the web</summary>
>
> Searched the web for `https://wcandillon.github.io/react-native-skia/v2/docs/shaders/overview/`
>
> </details>
</details>

**能，Expo＋Skia 很适合做这种持续流动的气泡动画。** 可以按你想要的质感分成两类：

- **汽水、水中的小气泡**：不断上浮、左右摇摆，大小和速度各不相同。用圆形、渐变和连续位移动画就能实现，比较简单。
- **熔岩灯那种液泡**：缓慢变形，靠近时融合，分开时拉伸。可以用 **Metaball（融合球）＋自定义 Shader** 实现，复杂度稍高，但不需要完整的流体物理引擎。Skia 提供了[自定义着色器能力](https://wcandillon.github.io/react-native-skia/v2/docs/shaders/overview/)。

动画可以由时间持续驱动，循环利用气泡，让它们不断生成、移动、消失；通过不同的运动周期和扰动，避免明显的重复感。Skia 支持直接使用 Reanimated 共享值，在 UI 线程驱动动画。[动画文档](https://wcandillon.github.io/react-native-skia/v2/docs/animations/animations/)

**放进你的 App，可以让每个声源就是一团缓慢浮动的液泡：**拖动改变空间位置，音量改变大小，选中时出现柔和光晕，平时保持轻微呼吸和形变。这种视觉模拟，用 Skia 就可以完成。

> 有没有类似的网站收集了这些效果的？

<details><summary>2 previous messages</summary>

> 我找几类可以直接看动态效果的网站，重点挑液体、气泡、融合球和 Shader 素材，方便你选视觉方向。
>
> <details><summary>Searched the web</summary>
>
> Searched the web for `Shadertoy metaballs bubbles liquid shader gallery ...`
>
> Searched the web for `site.shadertoy.com metaballs bubbles ...`
>
> Searched the web for `https://www.shadertoy.com/`
>
> Searched the web for `https://wcandillon.github.io/react-native-skia/v2/docs/tutorials/`
>
> Searched the web for `https://reactbits.dev/backgrounds/liquid-ether`
>
> </details>
</details>

有，**你这个项目建议先逛 ittybitty 和 React Bits**，都能直接预览、调整效果。

| 网站 | 适合看什么 |
|---|---|
| **[ittybitty](https://ittybitty.dev/)** | 液体、气泡、水面、光晕等 Shader 效果，可以调整参数 |
| **[React Bits](https://reactbits.dev/)** | 液泡融合、流动背景、发光球体和交互效果 |
| **[Reactiive Demos](https://reactiive.io/demos)** | React Native 动画合集，使用 Skia、Reanimated 和手势库 |
| **[Skia 官方教程合集](https://wcandillon.github.io/react-native-skia/v2/docs/tutorials/)** | 有 Metaball、液态玻璃、液面波动等具体实现教程 |
| **[Codrops Creative Hub](https://tympanus.net/codrops/hub/)** | 流体、水波、折射等创意网页效果，适合找整体视觉灵感 |

最贴近我们刚才讨论的，可以直接看：

- **[ittybitty · Metaballs](https://ittybitty.dev/shaders/metaballs)**：切换 **Bubbles / Lava**，试着降低速度、调整气泡数量和融合程度。
- **[React Bits · Meta Balls](https://reactbits.dev/animations/meta-balls)**：液泡靠近、融合、拉伸和分离。
- **[React Bits · Orb](https://reactbits.dev/backgrounds/orb)**：缓慢呼吸、流动的发光圆环。
- **[React Bits · Liquid Ether](https://reactbits.dev/backgrounds/liquid-ether)**：随指针流动的彩色液体。

继续搜索时，用这些关键词比较准确：`metaballs`、`lava lamp`、`liquid blobs`、`bubbles shader`。

网页案例适合选视觉方向；**Reactiive 和 Skia 教程更接近可以用于 Expo 的实现。**

