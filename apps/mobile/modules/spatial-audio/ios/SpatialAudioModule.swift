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
        // 轻度的小房间混响能给大脑提供空间外部化（Externalization）反射线索，显著提升前后辨识度。
        environment.reverbParameters.enable = true
        environment.reverbParameters.level = -18.0
        environment.reverbParameters.loadFactoryReverbPreset(.smallRoom)

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
      self?.sources[id]?.player.position = AVAudio3DPoint(
        x: Float(x), y: Float(y), z: Float(z)
      )
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
