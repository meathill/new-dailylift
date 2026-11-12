import ExpoModulesCore
import AVFoundation

/// 单个声源：播放节点 + 循环 buffer + 当前参数
struct AudioSource {
  let player: AVAudioPlayerNode
  let buffer: AVAudioPCMBuffer
}

/// 空间音频引擎封装：多声源播放、无缝循环、HRTF 双耳定位、距离衰减。
///
/// 坐标约定与 Apple 一致：听者在原点，前方为 -z，右为 +x，上为 +y。
/// 圆盘界面把屏幕位置映射到 (x, z) 平面（demo 不使用高度）。
public class SpatialAudioModule: Module {
  private let engine = AVAudioEngine()
  private let environment = AVAudioEnvironmentNode()
  private var sources: [String: AudioSource] = [:]
  /// AVAudioEngine 的所有操作收敛到同一串行队列，避免与渲染线程竞争
  private let audioQueue = DispatchQueue(label: "dev.dailylift.spatial-audio")
  private var isPrepared = false

  public func definition() -> ModuleDefinition {
    Name("SpatialAudio")

    // 多声源播放、无缝循环、HRTF 双耳定位、距离衰减
    // 坐标约定见类注释

    AsyncFunction("prepare") { [weak self] () -> Void in
      guard let self else { return }
      try self.prepareEngine()
    }

    AsyncFunction("loadSource") { [weak self] (id: String, uri: String, loop: Bool) -> Void in
      guard let self else { return }
      try self.loadSource(id: id, uri: uri, loop: loop)
    }

    AsyncFunction("playSource") { [weak self] (id: String) -> Void in
      guard let self else { return }
      try self.playSource(id: id)
    }

    AsyncFunction("stopSource") { [weak self] (id: String) -> Void in
      guard let self else { return }
      self.stopSource(id: id)
    }

    Function("setSourcePosition") { [weak self] (id: String, x: Double, y: Double, z: Double) -> Void in
      guard let self else { return }
      self.setSourcePosition(id: id, x: x, y: y, z: z)
    }

    Function("setSourceVolume") { [weak self] (id: String, volume: Double) -> Void in
      guard let self else { return }
      self.setSourceVolume(id: id, volume: volume)
    }

    AsyncFunction("unloadSource") { [weak self] (id: String) -> Void in
      guard let self else { return }
      self.unloadSource(id: id)
    }

    AsyncFunction("stopAll") { [weak self] () -> Void in
      guard let self else { return }
      self.stopAll()
    }

    OnDestroy {
      self.audioQueue.sync {
        self.engine.stop()
        self.sources.removeAll()
        self.isPrepared = false
      }
    }
  }

  private func prepareEngine() throws {
    try audioQueue.sync {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .default)
      try session.setActive(true)

      if !isPrepared {
        engine.attach(environment)
        // 显式锁定听者位置与三维朝向：
        // 听者位于原点 (0, 0, 0)，视线朝向 -z（屏幕上方为前），头顶指向 +y
        environment.listenerPosition = AVAudio3DPoint(x: 0, y: 0, z: 0)
        environment.listenerVectorOrientation = AVAudio3DVectorOrientation(
          forward: AVAudio3DVector(x: 0, y: 0, z: -1),
          up: AVAudio3DVector(x: 0, y: 1, z: 0)
        )

        // 开启微量真实空间混响：
        // 纯自由场（无反射）HRTF 容易导致双耳“脑中化”并丢失前后距离感。
        // 适度的环境反射让大脑获得空间外部化（Externalization）线索，大幅提升前后辨识度。
        environment.reverbParameters.enable = true
        environment.reverbParameters.level = -12.0
        environment.reverbParameters.loadFactoryReverbPreset(.mediumChamber)

        if #available(iOS 18.0, *) {
          environment.isListenerHeadTrackingEnabled = true
        }

        // 空图调用 prepare() 会抛 inputNode/outputNode 为空的异常，
        // 先把环境节点接上主混音器，构成有效输出链
        engine.connect(environment, to: engine.mainMixerNode, format: nil)
        isPrepared = true
      }

      if !engine.isRunning {
        engine.prepare()
        try engine.start()
      }
    }
  }

  private func loadSource(id: String, uri: String, loop: Bool) throws {
    try audioQueue.sync {
      guard let url = URL(string: uri), FileManager.default.fileExists(atPath: url.path) else {
        throw NSError(
          domain: "SpatialAudio", code: 1,
          userInfo: [NSLocalizedDescriptionKey: "音频文件不存在: \(uri)"]
        )
      }

      let file = try AVAudioFile(forReading: url)
      let format = file.processingFormat
      let frameCount = AVAudioFrameCount(file.length)
      guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else {
        throw NSError(
          domain: "SpatialAudio", code: 2,
          userInfo: [NSLocalizedDescriptionKey: "无法创建音频 buffer: \(id)"]
        )
      }
      try file.read(into: buffer)

      // 卸载旧实例，保证重复 load 幂等
      teardownSource(id: id)

      let player = AVAudioPlayerNode()
      engine.attach(player)
      engine.connect(player, to: environment, format: format)

      // 单声道素材走 HRTF 双耳渲染
      player.renderingAlgorithm = .HRTFHQ
      player.sourceMode = .spatializeIfMono
      // 默认混响与遮挡参数（初始默认通透）
      player.reverbBlend = 0.20
      player.obstruction = 0.0
      // 距离衰减使用系统默认参数（参考距离 1m、rolloff 1），近处响、远处轻

      player.scheduleBuffer(
        buffer, at: nil,
        options: loop ? [.loops, .interruptsAtLoop] : [],
        completionCallbackType: .dataPlayedBack, completionHandler: nil
      )

      sources[id] = AudioSource(player: player, buffer: buffer)
    }
  }

  private func playSource(id: String) throws {
    try audioQueue.sync {
      guard engine.isRunning else {
        throw NSError(
          domain: "SpatialAudio", code: 3,
          userInfo: [NSLocalizedDescriptionKey: "引擎未启动，请先 prepare()"]
        )
      }
      guard let source = sources[id] else {
        throw NSError(
          domain: "SpatialAudio", code: 4,
          userInfo: [NSLocalizedDescriptionKey: "声源未加载: \(id)"]
        )
      }
      if !source.player.isPlaying {
        // stop() 会清空调度，重新挂上循环 buffer 再播放
        source.player.scheduleBuffer(
          source.buffer, at: nil, options: [.loops, .interruptsAtLoop],
          completionCallbackType: .dataPlayedBack, completionHandler: nil
        )
        source.player.play()
      }
    }
  }

  private func stopSource(id: String) {
    audioQueue.sync {
      sources[id]?.player.stop()
    }
  }

  private func setSourcePosition(id: String, x: Double, y: Double, z: Double) {
    audioQueue.async { [weak self] in
      guard let self, let source = self.sources[id] else { return }

      let floatX = Float(x)
      let floatZ = Float(z)
      // 赋予微弱自然的地面仰俯落差（-0.3m），打破绝对对称水平面的前后声学死角
      let floatY = Float(y == 0 ? -0.3 : y)

      source.player.position = AVAudio3DPoint(x: floatX, y: floatY, z: floatZ)

      // 计算与听者距离及前后朝向分量
      let dist = sqrt(floatX * floatX + floatZ * floatZ)
      if dist > 0.001 {
        // 前方为 -z，正前方 forwardRatio = 1.0，正后方 forwardRatio = -1.0
        let forwardRatio = -floatZ / dist

        if forwardRatio < 0 {
          // 声源在后方：模拟耳廓与头颅自然物理遮挡（Pinna Obstruction）
          // 后方系数 0 ~ 1.0（正后方为 1.0）
          let rearFactor = -forwardRatio
          // 动态高频滤波：越靠近后方，直达声高频衰减至 -6.0 dB，声音变深沉温润
          source.player.obstruction = -6.0 * rearFactor
          // 后方直达声减弱，空间反射声占比增加
          let distReverb = min(0.12, (dist / 4.0) * 0.12)
          source.player.reverbBlend = min(0.38, 0.20 + 0.10 * rearFactor + distReverb)
        } else {
          // 声源在前方：无耳廓遮挡，清脆通透
          source.player.obstruction = 0.0
          let distReverb = min(0.10, (dist / 4.0) * 0.10)
          source.player.reverbBlend = min(0.28, 0.18 + distReverb)
        }
      }
    }
  }

  private func setSourceVolume(id: String, volume: Double) {
    audioQueue.async { [weak self] in
      self?.sources[id]?.player.volume = Float(volume)
    }
  }

  private func unloadSource(id: String) {
    audioQueue.sync {
      teardownSource(id: id)
    }
  }

  private func stopAll() {
    audioQueue.sync {
      for source in sources.values {
        source.player.stop()
      }
    }
  }

  /// 移除并释放一个声源（须在 audioQueue 上调用）
  private func teardownSource(id: String) {
    guard let source = sources.removeValue(forKey: id) else { return }
    source.player.stop()
    engine.disconnectNodeOutput(source.player)
    engine.detach(source.player)
  }
}
