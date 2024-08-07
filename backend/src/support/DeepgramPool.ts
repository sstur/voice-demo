import { DeepgramConnection } from './DeepgramConnection';

const DEFAULT_POOL_SIZE = 2;

export class DeepgramPool {
  private poolSize: number;
  private connections: Array<DeepgramConnection> = [];

  constructor(init: { poolSize?: number } = {}) {
    const { poolSize = DEFAULT_POOL_SIZE } = init;
    this.poolSize = poolSize;
    this.fillPool();
  }

  private fillPool() {
    const { poolSize, connections } = this;
    while (connections.length < poolSize) {
      connections.push(this.createConnection());
    }
  }

  private createConnection() {
    return new DeepgramConnection();
  }

  get() {
    const { connections } = this;
    const connection = connections.shift() ?? this.createConnection();
    this.fillPool();
    return connection;
  }
}
