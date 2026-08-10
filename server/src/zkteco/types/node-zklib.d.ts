declare module 'node-zklib' {
  type ZkSocketCallback = (errorOrType?: unknown) => void;
  type ZkTransport = {
    socket?: {
      destroy?: () => void;
      close?: () => void;
      removeAllListeners?: () => void;
    } | null;
    createSocket(
      cbErr?: ZkSocketCallback,
      cbClose?: ZkSocketCallback,
    ): Promise<void>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
  };

  class ZKLib {
    connectionType: 'tcp' | 'udp' | null;
    zklibTcp: ZkTransport;
    zklibUdp: ZkTransport;
    constructor(ip: string, port: number, timeout: number, inport: number);
    createSocket(
      cbErr?: ZkSocketCallback,
      cbClose?: ZkSocketCallback,
    ): Promise<void>;
    disconnect(): Promise<void>;
    getInfo(): Promise<Record<string, unknown>>;
    getUsers(): Promise<{ data: unknown[]; err?: Error | null }>;
    getAttendances(
      cb?: (downloaded: number, total: number) => void,
    ): Promise<{ data: unknown[]; err?: Error | null }>;
  }

  export default ZKLib;
}
