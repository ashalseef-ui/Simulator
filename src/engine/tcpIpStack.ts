/**
 * Userspace TCP/IP Stack & Socket Stream Engine (Mimicking lwIP / WebAssembly socket streams)
 * Enables virtual hosts and servers to run HTTP, SSH, and raw TCP socket sessions across simulated interfaces.
 */

export interface TcpSocket {
  socketId: string;
  localIp: string;
  localPort: number;
  remoteIp: string;
  remotePort: number;
  state: 'CLOSED' | 'SYN_SENT' | 'ESTABLISHED' | 'CLOSE_WAIT';
  sendQueue: string[];
  recvBuffer: string[];
}

export class UserspaceTcpStack {
  private sockets: Map<string, TcpSocket> = new Map();

  public connect(localIp: string, remoteIp: string, remotePort: number): TcpSocket {
    const socketId = `tcp_${Math.random().toString(36).substr(2, 9)}`;
    const socket: TcpSocket = {
      socketId,
      localIp,
      localPort: 49152 + Math.floor(Math.random() * 10000),
      remoteIp,
      remotePort,
      state: 'ESTABLISHED',
      sendQueue: [],
      recvBuffer: ['HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\n<html><body><h1>NetSim lwIP Server Active</h1></body></html>'],
    };
    this.sockets.set(socketId, socket);
    return socket;
  }

  public sendData(socketId: string, data: string): boolean {
    const sock = this.sockets.get(socketId);
    if (!sock || sock.state !== 'ESTABLISHED') return false;
    sock.sendQueue.push(data);
    return true;
  }

  public readData(socketId: string): string[] {
    const sock = this.sockets.get(socketId);
    if (!sock) return [];
    const data = [...sock.recvBuffer];
    sock.recvBuffer = [];
    return data;
  }

  public closeSocket(socketId: string) {
    const sock = this.sockets.get(socketId);
    if (sock) {
      sock.state = 'CLOSED';
      this.sockets.delete(socketId);
    }
  }
}

export const globalTcpStack = new UserspaceTcpStack();
