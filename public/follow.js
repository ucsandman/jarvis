// The Screen on lease, page side: what a click means and when a fresh screenshot is due. Pure so tests/follow.test.mjs can drive it with a clock.
// It never captures or sends anything itself; companion.js acts on the verbs it returns.
import {frameChanged} from './live.js';
export const QUIET_MS=3000;
export class Follow {
  constructor(){this.state={on:false,snapshots:false,expires:0,front:null,element:null,captureDue:0};this.inFlight=false;this.pending=false;this.lastPixels=null;this.mutedWindow=null;}
  start({snapshots=false,now=Date.now(),expires}){this.state={on:true,snapshots:!!snapshots,expires,front:null,element:null,captureDue:0};this.inFlight=false;this.pending=false;this.lastPixels=null;this.mutedWindow=null;}
  stop(){this.state={...this.state,on:false,captureDue:0,element:null};this.inFlight=false;this.pending=false;}
  // A click pins the window. The deck refits only when the window changed; the element is shown either way.
  click({front,element=null,now=Date.now()}){
    if(!this.state.on || !front) return 'idle';
    const changed=this.state.front?.id!==front.id;
    this.state.front=front;this.state.element=element;
    if(changed && this.mutedWindow && this.mutedWindow!==front.id) this.mutedWindow=null;
    if(this.state.snapshots && this.mutedWindow!==front.id){if(this.inFlight)this.pending=true;else this.state.captureDue=now+QUIET_MS;}
    return changed?'deck':'idle';
  }
  // Called when a deadline lands. 'capture' means: ask the shell for the pinned window now. 'busy' means the capture is due but the page
  // is mid-flight (a send, a read, a manual screenshot); the deadline stays so the next tick takes it, and nothing is scheduled twice.
  tick(now=Date.now(),busy=false){
    if(!this.state.on) return 'idle';
    if(now>=this.state.expires){this.stop();return 'expired';}
    if(!this.state.snapshots || this.inFlight || !this.state.captureDue || now<this.state.captureDue) return 'skip';
    if(busy) return 'busy';
    this.state.captureDue=0;this.inFlight=true;return 'capture';
  }
  // Milliseconds until the next thing that needs a tick: the capture deadline or the lease's end. Null when nothing is due.
  next(now=Date.now()){
    if(!this.state.on) return null;
    const due=this.state.snapshots && !this.inFlight && this.state.captureDue?this.state.captureDue:Infinity;
    return Math.max(0,Math.min(due,this.state.expires)-now);
  }
  // The shell answered. True when the chip should take this frame; false when the window looks the same.
  captured(pixels,now=Date.now()){
    this.inFlight=false;
    const take=!!pixels && frameChanged(this.lastPixels,pixels);
    if(take) this.lastPixels=pixels.slice();
    if(this.pending){this.pending=false;this.state.captureDue=now+QUIET_MS;}
    return take;
  }
  failed(){this.inFlight=false;this.pending=false;}
  // × on the chip: stay quiet for this window until a different one is clicked.
  chipRemoved(){this.mutedWindow=this.state.front?.id || null;this.lastPixels=null;this.state.captureDue=0;this.pending=false;}
  remaining(now=Date.now()){if(!this.state.on) return '';const left=Math.max(0,Math.ceil((this.state.expires-now)/1000));return `${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;}
}
