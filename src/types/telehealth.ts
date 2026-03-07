// Telehealth Technical Check Interface
export interface BrowserInfo {
  name: string;
  version: string;
  webRtcSupported: boolean;
  webCamSupported: boolean;
  microphoneSupported: boolean;
  screenShareSupported: boolean;
}

export interface DeviceCapabilities {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  permissions: {
    camera?: PermissionState;
    microphone?: PermissionState;
  };
}

export interface NetworkTestResult {
  bandwidth: number; // kbps
  latency: number; // ms
  packetLoss: number; // percentage
  connectionType: string;
}

export interface TelehealthTechnicalCheck {
  browserInfo: BrowserInfo;
  deviceCapabilities: DeviceCapabilities;
  networkTest: NetworkTestResult;
}

// Stats Interface
export interface ConnectionStats {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  packetsLost: number;
  jitter: number;
  roundTripTime: number;
}
