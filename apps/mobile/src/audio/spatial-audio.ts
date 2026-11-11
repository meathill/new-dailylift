/**
 * re-export 本地原生模块（apps/mobile/modules/spatial-audio）。
 * 类型与 requireNativeModule 逻辑收敛在模块包内，业务层只从这里引用。
 */
export { default } from '../../modules/spatial-audio';
export type { SpatialAudioNativeModule } from '../../modules/spatial-audio';
