/** 生成声源实例 id：同一次会话内唯一，导入重放时也不会与旧实例冲突 */
export function createInstanceId(): string {
  const counter = Math.floor(Math.random() * 0x7fffffff).toString(36);
  return `s_${Date.now().toString(36)}_${counter}`;
}
