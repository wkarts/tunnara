import { EventEmitter } from 'node:events';

const MAX_FRAME_SIZE = 16 * 1024 * 1024;

export class FramedConnection extends EventEmitter {
  constructor(socket, options = {}) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    this.maxFrameSize = options.maxFrameSize ?? MAX_FRAME_SIZE;
    socket.setNoDelay?.(true);
    socket.on('data', (chunk) => this.#onData(chunk));
    socket.on('close', () => { this.closed = true; this.emit('close'); });
    socket.on('end', () => this.emit('end'));
    socket.on('error', (error) => this.emit('error', error));
  }

  send(payload) {
    if (this.closed || this.socket.destroyed) return false;
    const data = Buffer.from(JSON.stringify(payload), 'utf8');
    if (data.length > this.maxFrameSize) throw new Error('Frame excede o limite permitido.');
    const header = Buffer.allocUnsafe(4);
    header.writeUInt32BE(data.length, 0);
    return this.socket.write(Buffer.concat([header, data]));
  }

  close() {
    if (!this.closed) this.socket.end();
  }

  destroy(error) {
    this.closed = true;
    this.socket.destroy(error);
  }

  #onData(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32BE(0);
      if (length <= 0 || length > this.maxFrameSize) {
        this.destroy(new Error('Tamanho de frame inválido.'));
        return;
      }
      if (this.buffer.length < 4 + length) return;
      const payload = this.buffer.subarray(4, 4 + length);
      this.buffer = this.buffer.subarray(4 + length);
      try { this.emit('frame', JSON.parse(payload.toString('utf8'))); }
      catch (error) { this.emit('protocolError', error); }
    }
  }
}

export function onceFrame(connection, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => cleanup(new Error('Tempo limite aguardando frame.')), timeoutMs);
    const onFrame = (frame) => cleanup(null, frame);
    const onError = (error) => cleanup(error);
    const onClose = () => cleanup(new Error('Conexão encerrada antes da resposta.'));
    function cleanup(error, frame) {
      clearTimeout(timeout);
      connection.off('frame', onFrame);
      connection.off('error', onError);
      connection.off('close', onClose);
      if (error) reject(error); else resolve(frame);
    }
    connection.once('frame', onFrame);
    connection.once('error', onError);
    connection.once('close', onClose);
  });
}
