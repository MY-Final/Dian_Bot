/**
 * 事件发射上下文
 * 在一次 emit 调用中创建，传递给所有 handler
 * handler 可通过此对象控制事件传播
 */
export class EmitEventContext<T = unknown> {
  /** 原始事件数据 */
  readonly data: T;

  private _stopped = false;
  private _stoppedBy: string | undefined;
  private _handledCount = 0;

  constructor(data: T) {
    this.data = data;
  }

  /** 是否已停止传播 */
  get propagationStopped(): boolean {
    return this._stopped;
  }

  /** 调用 stopPropagation 的调用者名称 */
  get stoppedBy(): string | undefined {
    return this._stoppedBy;
  }

  /** 已执行的 handler 数量 */
  get handledCount(): number {
    return this._handledCount;
  }

  /**
   * 停止后续 handler 执行
   * @param callerName - 调用者标识（用于调试）
   */
  stopPropagation(callerName?: string): void {
    this._stopped = true;
    this._stoppedBy = callerName;
  }

  /** @internal 标记一个 handler 已执行 */
  _markHandled(): void {
    this._handledCount++;
  }
}
