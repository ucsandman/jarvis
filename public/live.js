// Compare small local thumbnails, never upload the stream or queue old frames.
export function frameChanged(a,b) {
  if (!a || a.length!==b.length) return true;
  let changed=0;
  for(let i=0;i<b.length;i+=4) if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>18) changed++;
  return changed/(b.length/4)>=0.003;
}
export class LiveFrames {
  constructor() {this.candidate=null;this.sent=null;this.stableSince=0;this.lastSent=-Infinity;}
  inspect(pixels,now,interval) {
    if(frameChanged(this.candidate,pixels)) {this.candidate=pixels.slice();this.stableSince=now;}
    if(!frameChanged(this.sent,pixels)) return 'unchanged';
    if(now-this.stableSince<3000) return 'drawing';
    if(now-this.lastSent<interval) return 'cooldown';
    return 'ready';
  }
  accept(pixels,now) {this.sent=pixels.slice();this.lastSent=now;}
}
