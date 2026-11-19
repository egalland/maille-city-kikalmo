import {drawKikalmoPuppet} from './kikalmo-canvas.js';
import {portrait} from './portrait.js';
import {puppetAppearance} from './puppet-dyes.js';

export function drawCabinDriver(context,vehicle,size){
  if(vehicle.appearance&&drawKikalmoPuppet(context,{...vehicle,moving:false},size*.5,size*1.76,size*1.61,0,Math.PI))return;
  if(vehicle.self||vehicle.peer){portrait(context,size);return;}
  const {coat,pelt}=puppetAppearance('human',vehicle.color,vehicle.id);
  const ellipse=(x,y,rx,ry,color)=>{
    context.beginPath();context.ellipse(x*size,y*size,rx*size,ry*size,0,0,6.283);
    context.fillStyle=color;context.fill();
  };
  ellipse(.5,.98,.37,.36,coat);
  ellipse(.50,.45,.26,.30,pelt.fur);
  ellipse(.50,.26,.25,.15,pelt.shade);
  ellipse(.42,.46,.044,.058,'#3b2d39');ellipse(.59,.46,.044,.058,'#3b2d39');
}
