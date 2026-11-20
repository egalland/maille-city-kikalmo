import {BufferGeometry, Float32BufferAttribute} from './three.js';

// The halves of the felt face come from the same sewn surface. Share its normals
// across the colour boundaries so the jaw flows into the bridge of the nose.
function sewnSurface(rows, sides, sample, swatch = () => 0) {
  const positions = [], uvs = [], faces = [], panels = [];
  for (let row = 0; row < rows; row++) {
    for (let side = 0; side <= sides; side++) {
      const u = side / sides;
      positions.push(...sample(row, u * Math.PI * 2));
      uvs.push(u * 2, row / (rows - 1));
      if (row === rows - 1 || side === sides) continue;
      const a = row * (sides + 1) + side, c = a + sides + 1;
      const pair = [a, a + 1, c, a + 1, c + 1, c];
      faces.push(...pair);
      const index = swatch(row, side, sides);
      (panels[index] ??= []).push(...pair);
    }
  }
  const surface = new BufferGeometry();
  surface.setAttribute('position', new Float32BufferAttribute(positions, 3));
  surface.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  surface.setIndex(faces);
  surface.computeVertexNormals();
  const normals = surface.attributes.normal;
  for (let row = 0; row < rows; row++) {
    const a = row * (sides + 1), b = a + sides;
    const x = normals.getX(a) + normals.getX(b), y = normals.getY(a) + normals.getY(b), z = normals.getZ(a) + normals.getZ(b);
    const length = Math.hypot(x, y, z) || 1;
    normals.setXYZ(a, x / length, y / length, z / length);
    normals.setXYZ(b, x / length, y / length, z / length);
  }
  if (panels.length === 1) return [surface];
  return panels.map(indices => {
    const g = new BufferGeometry();
    for (const [name, attribute] of Object.entries(surface.attributes)) g.setAttribute(name, attribute);
    g.setIndex(indices);
    return g;
  });
}

// Sections run from the nape through the cheeks and meet on the pointed snout.
// The cream panel rises over the cheekbones and the dark panel wraps the nape.
const foxSections = [
  [-.278,.130,.131,.001],[-.274,.120,.141,.042],[-.247,.030,.275,.148],[-.170,-.045,.347,.234],
  [-.081,-.073,.369,.273],[.020,-.077,.358,.290],[.106,-.057,.321,.253],
  [.185,-.030,.257,.208],[.244,.010,.194,.142],[.309,.039,.150,.091],
  [.377,.066,.131,.048],[.393,.076,.123,.029]
];
const darkAngle = [1.12,1.12,1.08,.90,.75,.48,.12,0,0,0,0,0];
const paleAngle = [2.21,2.21,2.04,1.88,1.76,1.60,1.57,1.70,1.83,1.79,1.70,1.70];
function foxFace(sides) {
  return sewnSurface(foxSections.length, sides, (row, a) => {
    const [x, bottom, top, width] = foxSections[row];
    const mirrored=a>Math.PI;
    const t=(mirrored?2*Math.PI-a:a)/Math.PI;
    const dark=Math.max(.04,darkAngle[row]), pale=paleAngle[row];
    // Cut all three panels along the actual markings. Their boundaries slope
    // between stations instead of stepping through the faces of a regular grid.
    const band=t<1/3?t*3*dark:t<2/3?dark+(t*3-1)*(pale-dark):pale+(t*3-2)*(Math.PI-pale);
    const cos=Math.cos(band),sin=Math.sin(band)*(mirrored?-1:1);
    const cheek=Math.max(0,1-Math.abs(x-.020)*9)*Math.pow(Math.abs(sin),7);
    return [x-.074*cheek,(bottom+top)/2+(top-bottom)/2*cos+.044*cheek,
      width*sin+Math.sign(sin)*.032*cheek];
  }, (row,col) => {
    const sideFraction=Math.min(col+.5,sides-col-.5)/(sides/2);
    return sideFraction>2/3?1:row<7&&sideFraction<1/3?2:0;
  });
}
export const foxFaces = {near:foxFace(24), far:foxFace(12)};

// Rings advance up the figure. The reversed angle gives these vertical lofts
// the same outward winding as the longitudinal face and boot patterns.
function standing(rings, sides=12) {
  return sewnSurface(rings.length,sides,(row,a)=>{
    const [y,depth,width,x=0,exponent=1]=rings[row];
    const c=Math.cos(a),s=-Math.sin(a);
    return [x+Math.sign(c)*Math.abs(c)**exponent*depth,y,Math.sign(s)*Math.abs(s)**exponent*width];
  })[0];
}
const sleeveRings = [
  [-.176,.052,.054,.009],[-.151,.060,.060,.006],[-.111,.064,.067,-.005],
  [-.044,.073,.075,-.004],[.001,.082,.073,.002],[.040,.062,.054,.004],[.053,.024,.023]
];
export const upperSleeve=standing(sleeveRings);
export const distantSleeve=standing(sleeveRings.filter((_,i)=>[0,2,4,6].includes(i)),8);
export const foreSleeve = standing([
  [-.149,.048,.050,.037],[-.132,.055,.058,.030],[-.100,.053,.056,.020],
  [-.064,.061,.059,.008],[-.016,.059,.057,.000],[.014,.047,.048]
]);
export const turnedCuff = standing([
  [-.155,.049,.053,.041],[-.147,.056,.058,.038],[-.119,.056,.060,.029],[-.112,.054,.057,.026]
]);
const thighRings = [
  [-.155,.058,.063,-.012],[-.103,.065,.069,-.010],[-.048,.082,.080,-.001],
  [.018,.085,.082,.006],[.045,.061,.058]
];
export const trouserThigh=standing(thighRings);
export const distantThigh=standing(thighRings.filter((_,i)=>i!==1),8);
export const trouserCalf = standing([
  [-.145,.050,.048,.016],[-.110,.060,.062,.012],[-.063,.066,.065,.004],
  [-.020,.057,.059,.003],[.011,.059,.060,.000]
]);

// Side elevations of the gaiter and welt: raised quarters around the ankle,
// a low instep and broad toe. The two parts share the same footprint.
const bootStations = [
  [-.081,-.200,-.199,.001],[-.080,-.237,-.151,.032],[-.068,-.252,-.101,.061],[-.033,-.254,-.075,.076],
  [.024,-.254,-.085,.080],[.071,-.248,-.130,.080],[.119,-.246,-.159,.084],
  [.164,-.242,-.170,.081],[.193,-.232,-.178,.065],[.206,-.222,-.190,.029],[.209,-.213,-.199,.005]
];
function bootShape(sole,sides){
  const profile=sides===8?bootStations.filter((_,i)=>[0,2,3,5,7,9,10].includes(i)):bootStations;
  return sewnSurface(profile.length,sides,(row,a)=>{
    const [x,bottom,upper,width]=profile[row];
    const min=sole?bottom-.013:bottom,max=sole?bottom+.015:upper;
    const c=Math.cos(a),s=Math.sin(a);
    return [x,(max+min)/2+(max-min)/2*Math.sign(c)*Math.abs(c)**.73,
      (width+(sole?.004:0))*Math.sign(s)*Math.abs(s)**.72];
  })[0];
}
export const boots = {
  near:[bootShape(false,12),bootShape(true,12)], far:[bootShape(false,8),bootShape(true,8)]
};

const faceRings = [
  [-.101,.052,.063,.046],[-.077,.149,.147,.036],[-.032,.197,.190,.025],
  [.022,.227,.216,.012],[.089,.254,.265,.001],[.143,.258,.276,-.004],
  [.186,.263,.267,-.003],[.233,.255,.252,-.008],[.286,.225,.240,-.018],
  [.338,.171,.193,-.030],[.372,.087,.112,-.034],[.382,.008,.010,-.036]
];
function facePoint(y,a) {
  let i=1;
  while(i<faceRings.length-1&&faceRings[i][0]<y)i++;
  const from=faceRings[i-1],to=faceRings[i];
  const w=Math.max(0,Math.min(1,(y-from[0])/(to[0]-from[0])));
  const lerp=k=>from[k]+(to[k]-from[k])*w;
  const c=Math.cos(a),s=Math.sin(a),front=Math.max(c,0);
  const socket=.022*Math.exp(-((y-.158)**2/.0014+(Math.abs(s)-.47)**2/.023));
  const cheek=.015*Math.exp(-((y-.087)**2/.0012+(Math.abs(s)-.63)**2/.020));
  const chin=.018*Math.exp(-((y+.047)**2/.0011+s*s/.16));
  return [lerp(3)+lerp(1)*c+front*(cheek+chin-socket),y,lerp(2)*s];
}
export const humanHead=sewnSurface(faceRings.length,20,(row,a)=>facePoint(faceRings[row][0],-a))[0];
const lowFaceRows=[0,1,3,4,6,8,10,11];
export const distantHead=sewnSurface(lowFaceRows.length,12,(row,a)=>facePoint(faceRings[lowFaceRows[row]][0],-a))[0];
const noseRings=[
  [.068,.009,.024,.249],[.079,.019,.040,.260],[.092,.024,.044,.270],
  [.110,.032,.037,.276],[.131,.022,.025,.260],[.171,.011,.020,.250],[.203,.006,.019,.248]
];
export const humanNose=standing(noseRings);
export const distantNose=standing(noseRings.filter((_,i)=>[0,2,3,5,6].includes(i)),6);

function hairpiece(kind,sides){
  // A single swept hairline dips at the temples, rising at the part and
  // tapering into the nape (or a blunt hem on the longer bob).
  return sewnSurface(7,sides,(row,a)=>{
    a=-a;
    const u=row/6,c=Math.cos(a),s=Math.sin(a),front=Math.max(c,0);
    const sideburn=Math.exp(-((Math.abs(s)-.91)**2/.011))*Math.max(c+.15,0);
    const cut=(kind===2?.0:kind===3?-.059:.054)+(.238+(kind===3?.080:0))*front**1.25;
    const fringe=cut-.087*sideburn+.033*Math.sin(2*a+.35)*front-.024*Math.max(0,s)*front;
    const y=fringe+(.377-fringe)*Math.sin(u*Math.PI/2);
    const [x,,z]=facePoint(y,a);
    const curl=(.015+.014*Math.sin(a*5+u*2.9)**2)*(1-u);
    const lift=(kind===1?.038:.025)*Math.sin(u*Math.PI)+.014*u;
    const sideSweep=.018*s*u*(1-u)*front;
    return [x+(curl+.010)*c-.012*u,y+lift+sideSweep,z+(curl+.009)*s-.014*u];
  })[0];
}
export const haircuts=[0,1,2,3,5].reduce((cuts,kind)=>{
  cuts[kind]={near:hairpiece(kind,24),far:hairpiece(kind,12)};
  return cuts;
},{});
