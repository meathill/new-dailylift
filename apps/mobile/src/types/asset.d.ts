/** Metro 打包的音频资源以数字 id 形式存在（Asset.fromModule 使用） */
declare module '*.wav' {
  const asset: number;
  export default asset;
}
