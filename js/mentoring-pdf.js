/* Client-side A4 PDF generator for mentoring activity reports (zero external dependencies). */
(() => {
  const PAGE_W=595.28,PAGE_H=841.89,SCALE=2.5;
  const MARGIN_X=44,MARGIN_TOP=46,CONTENT_W=PAGE_W-MARGIN_X*2,CONTENT_BOTTOM=PAGE_H-56,FOOTER_Y=PAGE_H-30;
  const MAX_PAGES=40;
  const SANS='Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", -apple-system, BlinkMacSystemFont, sans-serif';
  const MONO='Consolas, "D2Coding", "SFMono-Regular", Menlo, Monaco, monospace';
  const encoder=new TextEncoder();

  function safePdfFilename(pdfTitle){
    const base=String(pdfTitle||'').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'_').trim().replace(/\.pdf$/i,'').replace(/^\.+|[.\s]+$/g,'').trim();
    return (base||'멘토링 활동 결과보고서')+'.pdf';
  }
  function formatFileSize(bytes){
    const size=Math.max(0,Number(bytes)||0);
    if(size>=1024*1024)return (size/(1024*1024)).toFixed(1).replace(/\.0$/,'')+' MB';
    return Math.max(1,Math.ceil(size/1024))+' KB';
  }
  function fileExtensionLabel(name){
    const match=/\.([a-z0-9]{1,6})$/i.exec(String(name||'').trim());
    return match?match[1].toUpperCase():'FILE';
  }
  function pdfHexUtf16(str){
    let hex='FEFF';
    const text=String(str||'');
    for(let i=0;i<text.length;i++)hex+=text.charCodeAt(i).toString(16).padStart(4,'0').toUpperCase();
    return '<'+hex+'>';
  }
  function concatChunks(chunks){
    let total=0;
    for(const c of chunks)total+=c.length;
    const out=new Uint8Array(total);
    let offset=0;
    for(const c of chunks){out.set(c,offset);offset+=c.length;}
    return out;
  }
  function buildPdfFromJpegs(pages,title='멘토링 활동 결과보고서'){
    if(!Array.isArray(pages)||!pages.length)throw new Error('empty-pdf');
    const totalObjs=3+pages.length*3;
    const chunks=[];
    let offset=0;
    const offsets=new Array(totalObjs+1).fill(0);
    const pushBytes=bytes=>{chunks.push(bytes);offset+=bytes.length;};
    const pushStr=str=>pushBytes(encoder.encode(str));

    pushBytes(new Uint8Array([0x25,0x50,0x44,0x46,0x2D,0x31,0x2E,0x34,0x0A,0x25,0xE2,0xE3,0xCF,0xD3,0x0A]));
    const kidRefs=pages.map((_,i)=>`${4+i*3} 0 R`).join(' ');

    offsets[1]=offset;
    pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    offsets[2]=offset;
    pushStr(`2 0 obj\n<< /Type /Pages /Kids [${kidRefs}] /Count ${pages.length} >>\nendobj\n`);

    offsets[3]=offset;
    pushStr(`3 0 obj\n<< /Title ${pdfHexUtf16(title)} /Creator ${pdfHexUtf16('CodeWiki')} >>\nendobj\n`);

    for(let i=0;i<pages.length;i++){
      const p=pages[i];
      if(!(p?.bytes instanceof Uint8Array)||!p.bytes.length||!p.width||!p.height)throw new Error('invalid-page');
      const pageObj=4+i*3,contentObj=5+i*3,imgObj=6+i*3;
      const streamStr=`q\n${PAGE_W.toFixed(2)} 0 0 ${PAGE_H.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
      const streamBytes=encoder.encode(streamStr);

      offsets[pageObj]=offset;
      pushStr(`${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Resources << /XObject << /Im0 ${imgObj} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${contentObj} 0 R >>\nendobj\n`);

      offsets[contentObj]=offset;
      pushStr(`${contentObj} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
      pushBytes(streamBytes);
      pushStr('endstream\nendobj\n');

      offsets[imgObj]=offset;
      pushStr(`${imgObj} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(p.width)} /Height ${Math.round(p.height)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`);
      pushBytes(p.bytes);
      pushStr('\nendstream\nendobj\n');
    }

    const xrefOffset=offset;
    pushStr(`xref\n0 ${totalObjs+1}\n0000000000 65535 f \n`);
    for(let i=1;i<=totalObjs;i++){
      pushStr(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
    }
    pushStr(`trailer\n<< /Size ${totalObjs+1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
    return concatChunks(chunks);
  }

  function roundedRect(ctx,x,y,w,h,r){
    const radius=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+radius,y);
    ctx.lineTo(x+w-radius,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+radius);
    ctx.lineTo(x+w,y+h-radius);
    ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);
    ctx.lineTo(x+radius,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-radius);
    ctx.lineTo(x,y+radius);
    ctx.quadraticCurveTo(x,y,x+radius,y);
    ctx.closePath();
  }
  function wrapParagraph(ctx,para,maxWidth){
    const expanded=para.replace(/\t/g,'  ');
    if(!expanded)return [''];
    if(ctx.measureText(expanded).width<=maxWidth)return [expanded];
    const lines=[];
    let line='';
    const tokens=expanded.split(/(\s+)/).filter(Boolean);
    for(const token of tokens){
      const candidate=line+token;
      if(line&&ctx.measureText(candidate).width<=maxWidth){line=candidate;continue;}
      if(!line&&ctx.measureText(token).width<=maxWidth){line=token;continue;}
      let leadingIndent='';
      if(line){
        if(/\S/.test(line))lines.push(line.replace(/\s+$/,''));
        else leadingIndent=line;
        line='';
      }
      const trimmed=/^\s+$/.test(token)?'':token;
      if(!trimmed)continue;
      if(ctx.measureText(trimmed).width<=maxWidth){line=trimmed;continue;}
      let chunk=ctx.measureText(leadingIndent).width<maxWidth?leadingIndent:'';
      for(const ch of trimmed){
        if(chunk&&ctx.measureText(chunk+ch).width>maxWidth){lines.push(chunk);chunk=ch;}
        else chunk+=ch;
      }
      line=chunk;
    }
    if(line||!lines.length)lines.push(line.replace(/\s+$/,''));
    return lines;
  }
  function wrapText(ctx,text,maxWidth){
    const raw=String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const out=[];
    for(const para of raw.split('\n'))out.push(...wrapParagraph(ctx,para,maxWidth));
    return out;
  }
  function truncateText(ctx,text,maxWidth){
    const str=String(text||'');
    if(ctx.measureText(str).width<=maxWidth)return str;
    const chars=Array.from(str);
    let lo=0,hi=chars.length;
    while(lo<hi){
      const mid=(lo+hi+1)>>1;
      if(ctx.measureText(chars.slice(0,mid).join('')+'…').width<=maxWidth)lo=mid;
      else hi=mid-1;
    }
    return chars.slice(0,Math.max(1,lo)).join('')+'…';
  }
  async function loadDrawableImage(blob){
    if(!blob)return null;
    if(typeof createImageBitmap==='function'){
      try{
        const bmp=await createImageBitmap(blob);
        return {source:bmp,width:bmp.width,height:bmp.height,release:()=>bmp.close?.()};
      }catch{}
    }
    if(typeof Image==='function'&&typeof URL?.createObjectURL==='function'){
      const url=URL.createObjectURL(blob);
      try{
        const img=await new Promise((resolve,reject)=>{
          const el=new Image();
          el.onload=()=>resolve(el);
          el.onerror=()=>reject(new Error('image-load'));
          el.src=url;
        });
        return {source:img,width:img.naturalWidth||img.width,height:img.naturalHeight||img.height,release:()=>URL.revokeObjectURL(url)};
      }catch{
        URL.revokeObjectURL(url);
        return null;
      }
    }
    return null;
  }
  function isJpegBytes(bytes){
    return bytes instanceof Uint8Array&&bytes.length>=2&&bytes[0]===0xFF&&bytes[1]===0xD8;
  }
  async function canvasToJpegBytes(canvas){
    if(typeof canvas.toBlob==='function'){
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92));
      if(blob&&typeof blob.arrayBuffer==='function'){
        const bytes=new Uint8Array(await blob.arrayBuffer());
        if(isJpegBytes(bytes))return bytes;
      }
    }
    if(typeof canvas.toDataURL==='function'){
      const dataUrl=canvas.toDataURL('image/jpeg',0.92);
      const b64=dataUrl.split(',')[1]||'';
      if(b64){
        const bin=atob(b64);
        const bytes=new Uint8Array(bin.length);
        for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
        if(isJpegBytes(bytes))return bytes;
      }
    }
    throw new Error('canvas-export-unavailable');
  }
  function createCanvas(width,height){
    const c=document.createElement('canvas');
    c.width=width;c.height=height;
    return c;
  }

  async function renderPages(report){
    const pxW=Math.round(PAGE_W*SCALE),pxH=Math.round(PAGE_H*SCALE);
    const canvases=[];
    let ctx=null,y=MARGIN_TOP,truncated=false;
    const releaseCanvases=()=>{for(const item of canvases){item.canvas.width=0;item.canvas.height=0;}};

    function newPage(){
      if(canvases.length>=MAX_PAGES){truncated=true;return false;}
      const c=createCanvas(pxW,pxH);
      const nextCtx=c.getContext('2d');
      if(!nextCtx){c.width=0;c.height=0;throw new Error('canvas-export-unavailable');}
      nextCtx.scale(SCALE,SCALE);
      nextCtx.fillStyle='#ffffff';
      nextCtx.fillRect(0,0,PAGE_W,PAGE_H);
      nextCtx.textBaseline='top';
      canvases.push({canvas:c,ctx:nextCtx});
      ctx=nextCtx;
      y=MARGIN_TOP;
      return true;
    }
    function ensureSpace(height){
      if(y+height<=CONTENT_BOTTOM)return true;
      return newPage();
    }
    function setFont(weight,size,family=SANS){ctx.font=`${weight} ${size}px ${family}`;}

    try{
    newPage();

    // 1. Report Header
    setFont(500,10);ctx.fillStyle='#556070';
    ctx.fillText('멘토링 활동 결과보고서',MARGIN_X,y);
    y+=17;

    setFont(700,19);ctx.fillStyle='#111827';
    const titleLines=wrapText(ctx,report.title||'멘토링 활동',CONTENT_W);
    for(const line of titleLines){ctx.fillText(line,MARGIN_X,y);y+=25;}
    y+=3;

    const metaSubtitle=[report.date,report.timeRange].filter(Boolean).join(' · ');
    if(metaSubtitle){
      setFont(400,10);ctx.fillStyle='#556070';
      ctx.fillText(metaSubtitle,MARGIN_X,y);
      y+=18;
    }
    ctx.fillStyle='#111827';
    ctx.fillRect(MARGIN_X,y+4,CONTENT_W,1.8);
    y+=20;

    // 2. Metadata Info Row (Mentor, Participants, Location)
    const people=Array.isArray(report.participants)?report.participants:[];
    const infoCols=[
      {label:'작성자 · 멘토',value:report.mentorName||''},
      {label:'참여 인원',value:`${people.length}명${people.length?` (${people.join(',')})`:''}`}
    ];
    if(report.location)infoCols.push({label:'장소',value:report.location});
    const colGap=16,colW=(CONTENT_W-colGap*(infoCols.length-1))/infoCols.length;
    const colLines=infoCols.map(col=>{
      setFont(500,10.5);
      return wrapText(ctx,col.value||'—',colW);
    });
    const maxInfoLines=Math.max(...colLines.map(l=>l.length),1);
    const infoHeight=15+maxInfoLines*16+14;
    ensureSpace(infoHeight);
    infoCols.forEach((col,idx)=>{
      const x=MARGIN_X+idx*(colW+colGap);
      setFont(500,9.5);ctx.fillStyle='#6B7280';
      ctx.fillText(col.label,x,y);
      setFont(500,10.5);ctx.fillStyle='#111827';
      let ly=y+15;
      for(const line of colLines[idx]){ctx.fillText(line,x,ly);ly+=16;}
    });
    y+=infoHeight-6;
    ctx.fillStyle='#DDE3EC';
    ctx.fillRect(MARGIN_X,y,CONTENT_W,0.8);
    y+=20;

    // 3. 진행 내용
    const bodyText=String(report.task||'').trim()||'아직 작성하지 않았습니다.';
    setFont(400,10.5);
    const bodyLines=wrapText(ctx,bodyText,CONTENT_W);
    if(ensureSpace(22+Math.min(bodyLines.length,2)*18)){
      setFont(700,11.5);ctx.fillStyle='#111827';
      ctx.fillText('진행 내용',MARGIN_X,y);
      y+=20;
      setFont(400,10.5);ctx.fillStyle=report.task?'#1F2937':'#6B7280';
      for(const line of bodyLines){
        if(!ensureSpace(18))break;
        setFont(400,10.5);ctx.fillStyle=report.task?'#1F2937':'#6B7280';
        ctx.fillText(line,MARGIN_X,y);
        y+=18;
      }
      y+=14;
    }

    // 4. 작성한 코드 (paginates cleanly across pages)
    const codeText=String(report.code||'');
    if(codeText.trim()&&!truncated){
      setFont(400,9,MONO);
      const codePad=12,codeLineH=14.5;
      const codeLines=wrapText(ctx,codeText,CONTENT_W-codePad*2);
      if(ensureSpace(22+codePad*2+Math.min(codeLines.length,3)*codeLineH)){
        setFont(700,11.5);ctx.fillStyle='#111827';
        ctx.fillText('작성한 코드',MARGIN_X,y);
        y+=20;
        let idx=0;
        while(idx<codeLines.length&&!truncated){
          const avail=CONTENT_BOTTOM-y-codePad*2;
          const fit=Math.floor(avail/codeLineH);
          if(fit<1){if(!newPage())break;continue;}
          const chunk=codeLines.slice(idx,idx+fit);
          const boxH=chunk.length*codeLineH+codePad*2;
          roundedRect(ctx,MARGIN_X,y,CONTENT_W,boxH,6);
          ctx.fillStyle='#F4F5F7';ctx.fill();
          ctx.strokeStyle='#D8DDE6';ctx.lineWidth=0.8;ctx.stroke();
          setFont(400,9,MONO);ctx.fillStyle='#111827';
          let cy=y+codePad;
          for(const line of chunk){ctx.fillText(line,MARGIN_X+codePad,cy);cy+=codeLineH;}
          y+=boxH+12;
          idx+=chunk.length;
        }
        y+=6;
      }
    }

    // 5. 첨부 자료 (Images gallery + non-image cards)
    const images=Array.isArray(report.images)?report.images:[];
    const otherFiles=Array.isArray(report.otherFiles)?report.otherFiles:[];
    const totalFiles=images.length+otherFiles.length;
    if(totalFiles>0&&!truncated){
      const loadedImages=[];
      try{
        for(const img of images)loadedImages.push({...img,drawable:await loadDrawableImage(img.blob)});

        const singleMediaH=item=>{
          const maxMediaH=330;
          if(!item?.drawable||!item.drawable.width||!item.drawable.height)return 140;
          const ratio=Math.min((CONTENT_W-16)/item.drawable.width,(maxMediaH-16)/item.drawable.height,1);
          return Math.max(110,Math.min(maxMediaH,Math.round(item.drawable.height*ratio+16)));
        };
        const multiGap=12,multiColW=(CONTENT_W-multiGap)/2,multiMaxH=205;
        const pairMediaH=pair=>Math.max(...pair.map(item=>{
          if(!item?.drawable||!item.drawable.width||!item.drawable.height)return 120;
          const ratio=Math.min((multiColW-16)/item.drawable.width,(multiMaxH-16)/item.drawable.height,1);
          return Math.max(110,Math.min(multiMaxH,Math.round(item.drawable.height*ratio+16)));
        }));
        const cardH=44;
        const firstBlockH=loadedImages.length===1
          ? singleMediaH(loadedImages[0])+28
          : loadedImages.length>1
            ? pairMediaH(loadedImages.slice(0,2))+28
            : cardH+8;

        if(ensureSpace(20+firstBlockH)){
          setFont(700,11.5);ctx.fillStyle='#111827';
          ctx.fillText(`첨부 자료 (${totalFiles}건)`,MARGIN_X,y);
          y+=20;

        const drawFigure=(item,figIndex,x,w,mediaBoxH,topY)=>{
          const capH=28,figCardH=mediaBoxH+capH;
          roundedRect(ctx,x,topY,w,figCardH,8);
          ctx.fillStyle='#FFFFFF';ctx.fill();
          ctx.strokeStyle='#D8DDE6';ctx.lineWidth=0.8;ctx.stroke();

          ctx.save();
          roundedRect(ctx,x+0.5,topY+0.5,w-1,figCardH-1,7.5);
          ctx.clip();
          ctx.fillStyle='#F7F8FA';
          ctx.fillRect(x,topY,w,mediaBoxH);
          if(item.drawable&&item.drawable.width>0&&item.drawable.height>0){
            const pad=8,availW=w-pad*2,availH=mediaBoxH-pad*2;
            const ratio=Math.min(availW/item.drawable.width,availH/item.drawable.height,1);
            const dw=item.drawable.width*ratio,dh=item.drawable.height*ratio;
            ctx.drawImage(item.drawable.source,x+(w-dw)/2,topY+(mediaBoxH-dh)/2,dw,dh);
          }else{
            setFont(400,9.5);ctx.fillStyle='#6B7280';ctx.textAlign='center';
            ctx.fillText('이미지를 불러오지 못했습니다.',x+w/2,topY+mediaBoxH/2-6);
            ctx.textAlign='left';
          }
          ctx.fillStyle='#E2E6EE';
          ctx.fillRect(x,topY+mediaBoxH,w,0.8);
          ctx.fillStyle='#FFFFFF';
          ctx.fillRect(x,topY+mediaBoxH+0.8,w,capH);

          // Caption strip: [그림 N] filename [size]
          const tagText=`그림 ${figIndex}`;
          setFont(700,8.5);
          const tagW=ctx.measureText(tagText).width+12;
          const tagX=x+9,tagY=topY+mediaBoxH+6.5;
          roundedRect(ctx,tagX,tagY,tagW,15,7.5);
          ctx.fillStyle='#EEF4FF';ctx.fill();
          ctx.fillStyle='#1B4D9E';
          ctx.fillText(tagText,tagX+6,tagY+3);

          const sizeText=formatFileSize(item.size);
          setFont(400,8.5);
          const sizeW=ctx.measureText(sizeText).width;
          ctx.fillStyle='#6B7280';
          ctx.fillText(sizeText,x+w-9-sizeW,topY+mediaBoxH+9.5);

          const nameX=tagX+tagW+7,nameMaxW=Math.max(40,w-(nameX-x)-sizeW-16);
          setFont(500,9.5);ctx.fillStyle='#111827';
          ctx.fillText(truncateText(ctx,item.name,nameMaxW),nameX,topY+mediaBoxH+9);
          ctx.restore();
          return figCardH;
        };

        if(loadedImages.length===1&&!truncated){
          const item=loadedImages[0];
          const mediaH=singleMediaH(item);
          if(ensureSpace(mediaH+28)){
            const h=drawFigure(item,1,MARGIN_X,CONTENT_W,mediaH,y);
            y+=h+14;
          }
        }else if(loadedImages.length>1&&!truncated){
          for(let i=0;i<loadedImages.length&&!truncated;i+=2){
            const pair=loadedImages.slice(i,i+2);
            const rowMediaH=pairMediaH(pair);
            if(!ensureSpace(rowMediaH+28))break;
            const rowY=y;
            pair.forEach((item,j)=>{
              drawFigure(item,i+j+1,MARGIN_X+j*(multiColW+multiGap),multiColW,rowMediaH,rowY);
            });
            y+=rowMediaH+28+12;
          }
        }

        if(otherFiles.length&&!truncated){
          if(loadedImages.length)y+=4;
          for(const f of otherFiles){
            if(!ensureSpace(cardH+8))break;
            roundedRect(ctx,MARGIN_X,y,CONTENT_W,cardH,7);
            ctx.fillStyle='#F7F8FA';ctx.fill();
            ctx.strokeStyle='#D8DDE6';ctx.lineWidth=0.8;ctx.stroke();

            const ext=fileExtensionLabel(f.name);
            setFont(700,8.5);
            const badgeW=Math.max(38,ctx.measureText(ext).width+14);
            roundedRect(ctx,MARGIN_X+11,y+11,badgeW,22,5);
            ctx.fillStyle='#FFFFFF';ctx.fill();
            ctx.strokeStyle='#D0D7E2';ctx.lineWidth=0.8;ctx.stroke();
            ctx.fillStyle='#111827';ctx.textAlign='center';
            ctx.fillText(ext,MARGIN_X+11+badgeW/2,y+17.5);
            ctx.textAlign='left';

            const metaX=MARGIN_X+11+badgeW+11,metaW=CONTENT_W-(metaX-MARGIN_X)-12;
            setFont(600,10);ctx.fillStyle='#111827';
            ctx.fillText(truncateText(ctx,f.name,metaW),metaX,y+9);
            setFont(400,8.8);ctx.fillStyle='#556070';
            ctx.fillText(`${formatFileSize(f.size)} · 별도 첨부파일`,metaX,y+24.5);
            y+=cardH+8;
          }
        }
        }
      }finally{
        for(const item of loadedImages)item.drawable?.release?.();
      }
    }

    if(truncated&&canvases.length){
      const lastCtx=canvases[canvases.length-1].ctx;
      lastCtx.font=`400 8.5px ${SANS}`;
      lastCtx.fillStyle='#6B7280';
      lastCtx.fillText('※ 분량 제한으로 이후 내용은 생략되었습니다.',MARGIN_X,CONTENT_BOTTOM+2);
    }

    // 6. Footers on every page
    const totalPages=canvases.length;
    canvases.forEach(({ctx:pageCtx},index)=>{
      pageCtx.fillStyle='#E2E6EE';
      pageCtx.fillRect(MARGIN_X,FOOTER_Y-10,CONTENT_W,0.8);
      pageCtx.font=`400 8.5px ${SANS}`;
      pageCtx.fillStyle='#6B7280';
      pageCtx.textBaseline='top';
      pageCtx.textAlign='left';
      pageCtx.fillText('코드위키 · 멘토링 활동 기록',MARGIN_X,FOOTER_Y);
      pageCtx.textAlign='right';
      pageCtx.fillText(`${index+1} / ${totalPages}`,PAGE_W-MARGIN_X,FOOTER_Y);
      pageCtx.textAlign='left';
    });

    const pages=[];
    for(const item of canvases){
      pages.push({bytes:await canvasToJpegBytes(item.canvas),width:pxW,height:pxH});
      item.canvas.width=0;item.canvas.height=0;
    }
    return pages;
    }finally{
      releaseCanvases();
    }
  }

  async function generate(report){
    if(globalThis.document?.fonts?.ready){
      try{await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,300))]);}catch{}
    }
    const pages=await renderPages(report);
    const pdfBytes=buildPdfFromJpegs(pages,report.pdfTitle||report.title||'멘토링 활동 결과보고서');
    return new Blob([pdfBytes],{type:'application/pdf'});
  }

  window.CodeWikiMentoringPdf={generate,buildPdfFromJpegs,safePdfFilename,PAGE_W,PAGE_H};
})();
