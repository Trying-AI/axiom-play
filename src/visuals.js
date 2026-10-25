export function icon(name, size = 20) {
  const shapes = {
    people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v3"/>',
    home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>',
    chart:'<path d="M4 3v18h17M8 16l4-5 4 2 5-8"/>',
    settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    back:'<path d="M19 12H5m6-6-6 6 6 6"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
    bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
    crown:'<path d="m3 6 3 12h12l3-12-6 5-3-7-3 7zM6 21h12"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    moon:'<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
    bulb:'<path d="M8 17c0-3-3-4-3-8a7 7 0 0 1 14 0c0 4-3 5-3 8M8 17h8m-7 4h6"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    route:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h10a4 4 0 0 1 0 8H7a3 3 0 0 0 0 6h10"/>',
    pipes:'<path d="M3 7h8V3m0 4v10h10m-10 0v4"/>',
    cross:'<path d="M3 7h8M7 3v8m8 4 6 6m0-6-6 6"/>',
    patches:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M11 3v18m0-10h10M3 15h8"/>',
    skyline:'<path d="M3 21h18M5 21V10h5v11m0 0V3h5v18m0 0V7h4v14M7 13h1m4-7h1m4 4h1"/>',
    knight:'<path d="M5 21h14M7 18c0-5 5-6 5-10L7 9 5 6l7-4 5 5c3 5 1 8 1 11H7Z"/><circle cx="12" cy="5" r=".6"/>',
    code:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m6 9 2 3-2 3m5-6v6m4-6h3m-3 6h3"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name]||shapes.spark}</svg>`;
}
export function artwork(id, large = false) {
  let shapes = '';
  const rect=(x,y,w,h,c,rx=7)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${c}"/>`;
  const text=(x,y,t,c='#404967',s=21)=>`<text x="${x}" y="${y}" fill="${c}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${s}" font-weight="600">${t}</text>`;
  if(id==='nonogram') {
    const filled=[1,3,5,6,7,8,9,10,11,12,13,14,16,17,18,22];
    for(let i=0;i<25;i++)shapes+=rect(84+i%5*25,35+Math.floor(i/5)*25,22,22,filled.includes(i)?'#659c88':'#ffffffa0',4);
    ['1 1','5','5','3','1'].forEach((v,i)=>{shapes+=text(65,51+i*25,v,'#4e8072',10);});
    [2,4,4,4,2].forEach((v,i)=>{shapes+=text(95+i*25,25,v,'#4e8072',11);});
  } else if(id==='skyscrapers') {
    const heights=[2,4,1,3];
    for(let i=0;i<4;i++){const x=60+i*43,h=heights[i]*25;shapes+=rect(x,151-h,34,h,['#9eb8df','#6489bb','#b2c9e9','#809fca'][i],5);for(let j=0;j<heights[i];j++)shapes+=rect(x+8,158-h+j*25,6,8,'#ffffffba',1)+rect(x+20,158-h+j*25,6,8,'#ffffffba',1);shapes+=text(x+17,168,heights[i],'#5574a3',11);}
    shapes+=text(140,22,'2 ←   → 2','#5574a3',14);
  } else if(id==='lightsout') {
    for(let i=0;i<9;i++){const x=72+i%3*47,y=16+Math.floor(i/3)*47,on=[1,3,4,5,7].includes(i);shapes+=rect(x,y,42,42,on?'#efd07c':'#ffffff8a',9);shapes+=`<circle cx="${x+21}" cy="${y+21}" r="${on?9:5}" fill="${on?'#fff8de':'#d9d6c5'}"/>`;}
  } else if(id==='knighttrail') {
    for(let i=0;i<16;i++)shapes+=rect(65+i%4*37,14+Math.floor(i/4)*37,33,33,(i+Math.floor(i/4))%2?'#bcaee1':'#ffffff99',5);
    shapes+='<path d="M81 30 155 67 118 141 81 67 155 104 192 30" stroke="#8162b6" stroke-width="3" stroke-dasharray="4 5" fill="none"/>';
    shapes+=text(81,42,'♞','#665094',31)+`<circle cx="192" cy="30" r="6" fill="#8162b6"/>`;
  } else if(id==='codebreaker') {
    [[1,2,3],[3,1,5],[3,6,5]].forEach((row,r)=>{row.forEach((value,c)=>{shapes+=rect(55+c*42,22+r*46,36,36,'#ffffffb0',7)+text(73+c*42,48+r*46,value,'#b77958',19);});for(let c=0;c<3;c++)shapes+=`<circle cx="${198+c*13}" cy="${40+r*46}" r="4" fill="${c<=r?'#bb805f':'#ffffff'}"/>`;});
  } else if(id==='queens') {
    const colors=['#b5a0e9','#b5a0e9','#d5c6f3','#d5c6f3','#b5a0e9','#a5c9bc','#a5c9bc','#d5c6f3','#efc27d','#efc27d','#a5c9bc','#a1b9e4','#efc27d','#a1b9e4','#a1b9e4','#a1b9e4'];
    for(let i=0;i<16;i++) shapes+=rect(65+i%4*37,14+Math.floor(i/4)*37,34,34,colors[i]);
    for(const [x,y] of [[119,31],[193,68],[82,105],[156,142]]) shapes+=`<path d="m${x-11} ${y-4} 3 13h16l3-13-7 5-4-9-4 9Z" fill="#fff" stroke="#665393" stroke-width="1.5"/>`;
  } else if(id==='sudoku'||id==='cages'||id==='crossmath'||id==='ability'||id==='flash') {
    const numbers = id==='ability'?['x²','√','7','3','∑','9','2','÷','π']:id==='flash'?['+','8','−','6','24','7','3','×','2']:id==='crossmath'?['3','×','2','+','9','−','1','=','7']:['','3','6','2','','1','5','4',''];
    for(let i=0;i<9;i++){ shapes+=rect(71+i%3*47,16+Math.floor(i/3)*47,42,42,i===4?'#7b92c7':'#ffffffb3');shapes+=text(92+i%3*47,45+Math.floor(i/3)*47,numbers[i],i===4?'white':'#596f97',i===4&&id==='flash'?23:21);}
  } else if(id==='zip'||id==='maze'||id==='pinball') {
    for(let i=0;i<16;i++) shapes+=rect(65+i%4*37,14+Math.floor(i/4)*37,33,33,'#ffffff80');
    shapes+='<path d="M81 30h111v37H81v37h111v37H81" stroke="#e19169" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    for(const [i,x,y] of [[1,81,30],[2,192,67],[3,118,104],[4,81,141]])shapes+=`<circle cx="${x}" cy="${y}" r="13" fill="#fff"/>${text(x,y+5,id==='pinball'?'↗':i,'#996045',15)}`;
  } else if(id==='mindsnap') {
    for(let i=0;i<16;i++)shapes+=rect(65+i%4*37,14+Math.floor(i/4)*37,32,32,[1,4,6,9,11,14].includes(i)?'#649d8d':'#ffffff88');
  } else if(id==='tango') {
    for(let i=0;i<12;i++){const x=65+i%4*37,y=29+Math.floor(i/4)*37;shapes+=rect(x,y,33,33,'#ffffff85');if([0,3,5,7,8,10].includes(i)) shapes+=`<circle cx="${x+16}" cy="${y+16}" r="9" fill="#e5ac43"/>`;else shapes+=`<path d="M${x+22} ${y+22}a11 11 0 0 1-10-15 10 10 0 1 0 10 15" fill="#8793c6"/>`;}
  } else if(id==='pipes') {
    for(let i=0;i<16;i++)shapes+=rect(65+i%4*37,14+Math.floor(i/4)*37,33,33,'#ffffff7a');
    shapes+='<path d="M81 30v74h111V67h-74v74m37-111v74m0-37h37" fill="none" stroke="#5eaaa8" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><circle cx="81" cy="30" r="9" fill="#fff" stroke="#5eaaa8" stroke-width="5"/>';
  } else {
    shapes+=rect(65,14,72,72,'#8aa9d4')+rect(141,14,72,34,'#b8c9e5')+rect(141,52,72,72,'#b1a3d5')+rect(65,90,72,72,'#bad1bf')+rect(141,128,72,34,'#e5c498');
    shapes+=text(101,58,'4','white')+text(177,39,'2','#617293')+text(177,95,'4','white')+text(101,134,'4','#648b75')+text(177,153,'2','#997b54');
  }
  return `<svg viewBox="0 0 280 176" class="puzzle-art${large?' large':''}" aria-hidden="true">${shapes}</svg>`;
}
