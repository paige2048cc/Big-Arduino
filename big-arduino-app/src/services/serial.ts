// Web Serial API Service for Arduino Communication

type SerialCallback = (data: string) => void;

class SerialService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private port: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private reader: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private writer: any = null;
  private onDataCallback: SerialCallback | null = null;
  private isReading = false;

  // Check if Web Serial is supported
  isSupported(): boolean {
    return 'serial' in navigator;
  }

  // Check if connected
  isConnected(): boolean {
    return this.port !== null;
  }

  // Connect to Arduino
  async connect(baudRate: number = 9600): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
    }

    try {
      // Request port access
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      this.port = await nav.serial.requestPort();

      // Open the port
      await this.port.open({ baudRate });

      // Set up writer
      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(this.port.writable);
      this.writer = textEncoder.writable.getWriter();

      // Set up reader
      const textDecoder = new TextDecoderStream();
      this.port.readable.pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable.getReader();

      // Start reading loop
      this.startReading();

      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      throw error;
    }
  }

  // Disconnect from Arduino
  async disconnect(): Promise<void> {
    this.isReading = false;

    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }

  // Send data to Arduino
  async send(data: string): Promise<void> {
    if (!this.writer) {
      throw new Error('Not connected to Arduino');
    }
    await this.writer.write(data);
  }

  // Set callback for incoming data
  onData(callback: SerialCallback): void {
    this.onDataCallback = callback;
  }

  // Read loop
  private async startReading(): Promise<void> {
    if (!this.reader) return;

    this.isReading = true;

    try {
      while (this.isReading) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }
        if (value && this.onDataCallback) {
          this.onDataCallback(value);
        }
      }
    } catch (error) {
      if (this.isReading) {
        console.error('Read error:', error);
      }
    }
  }
}

// Export singleton instance
export const serialService = new SerialService();
