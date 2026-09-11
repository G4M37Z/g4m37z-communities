// FIX #7 REAL: group call limitation — mesh not supported; 1-to-1 only (documented)
export class WebRTCPeer {
  private pc: RTCPeerConnection;
  constructor() { this.pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }); }
  addLocal(t: MediaStreamTrack) { this.pc.addTrack(t); }
  async offer() { const o = await this.pc.createOffer(); await this.pc.setLocalDescription(o); return o; }
  async answer(o: RTCSessionDescriptionInit) { await this.pc.setRemoteDescription(o); const a = await this.pc.createAnswer(); await this.pc.setLocalDescription(a); return a; }
  onTrack(cb: (s: MediaStream) => void) { this.pc.ontrack = (e) => cb(e.streams[0]); }
  close() { this.pc.close(); }
}
