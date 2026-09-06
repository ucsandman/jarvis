// The node's eyes look toward the cursor. Pure: no DOM, no timers, no state. Units are the mark's 64 grid;
// callers pass the mark's on-screen size and origin and get an offset to add to the home points.
// Mirrored in desktop/SidelookMark.cs (EyeOffset); scripts/verify-mark.ps1 checks the two agree.
export const EYE_HOME=[[26,32],[38,32]];
export const EYE_TRAVEL=5;    // grid units; keeps a 3.6-radius eye inside the hexagon at every angle
export const EYE_REACH=120;   // grid units of cursor distance at which the eyes are fully turned
export const STATIC_RIGHT=Object.freeze({dx:EYE_TRAVEL,dy:0});

export function eyeOffset({size,left,top,cursor,reducedMotion=false}){
  if(reducedMotion||!cursor)return STATIC_RIGHT;
  const unit=size/64;
  if(cursor.x>=left&&cursor.x<left+size&&cursor.y>=top&&cursor.y<top+size)return {dx:0,dy:0};
  const vx=cursor.x-(left+32*unit),vy=cursor.y-(top+32*unit);
  const d=Math.hypot(vx,vy);
  if(!d)return {dx:0,dy:0};
  const o=Math.min(d/(EYE_REACH*unit),1)*EYE_TRAVEL;
  return {dx:o*vx/d,dy:o*vy/d};
}

export function eyeCenters(offset){return EYE_HOME.map(([x,y])=>[x+offset.dx,y+offset.dy]);}
