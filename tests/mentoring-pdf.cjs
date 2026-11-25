const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

// Verify mentoring-pdf.js: binary PDF 1.4 structure, xref byte offsets, multi-page pagination,
// filename sanitization, image gallery & non-image attachment rendering without throwing.
const fakeJpeg=new Uint8Array([0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0xFF,0xD9]);
const drawnText=[],drawnImages=[];

function makeCanvas(){
  const ctx={
    font:'',fillStyle:'',strokeStyle:'',lineWidth:1,textBaseline:'top',textAlign:'left',
    scale(){},save(){},restore(){},clip(){},beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},closePath(){},
    fill(){},stroke(){},fillRect(){},
    measureText(str){
      const match=/(\d+(?:\.\d+)?)px/.exec(this.font);
      const size=match?Number(match[1]):10;
      return {width:String(str).length*size*0.62};
    },
    fillText(str){drawnText.push(String(str));},
    drawImage(src,x,y,w,h){drawnImages.push({src,x,y,w,h});}
  };
  return {
    width:0,height:0,
    getContext(){return ctx;},
    toBlob(cb,type){assert.equal(type,'image/jpeg');cb(new Blob([fakeJpeg],{type}));}
  };
}

const window={};
let bitmapCalls=0;
const context=vm.createContext({
  window,document:{createElement(tag){assert.equal(tag,'canvas');return makeCanvas();}},
  TextEncoder,Uint8Array,Blob,URL,atob,
  async createImageBitmap(blob){
    bitmapCalls++;
    if(blob.size===0)throw new Error('corrupt-image');
    return {width:800,height:600,closed:false,close(){this.closed=true;}};
  }
});
vm.runInContext(fs.readFileSync('js/mentoring-pdf.js','utf8'),context);
const pdf=window.CodeWikiMentoringPdf;

(async()=>{
  assert.equal(pdf.safePdfFilename('1회차_2주차_6반_3조_이은호 멘토링 활동 결과보고서'),'1회차_2주차_6반_3조_이은호 멘토링 활동 결과보고서.pdf');
  assert.equal(pdf.safePdfFilename('1회차:테스트/제목*?.pdf'),'1회차_테스트_제목__.pdf');
  assert.equal(pdf.safePdfFilename('   '),'멘토링 활동 결과보고서.pdf');

  // Direct PDF binary validation: header, MediaBox, DCTDecode, xref byte offsets, trailer, EOF.
  const raw=pdf.buildPdfFromJpegs([
    {bytes:fakeJpeg,width:1488,height:2105},
    {bytes:fakeJpeg,width:1488,height:2105}
  ],'1회차_2주차_6반_3조_이은호 멘토링 활동 결과보고서');
  const text=Buffer.from(raw).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4\n'),'must emit PDF 1.4 header');
  assert.ok(text.includes('/Count 2'),'must declare 2 pages');
  assert.ok(text.includes('/MediaBox [0 0 595.28 841.89]'),'must use A4 MediaBox');
  assert.ok(text.includes('/Filter /DCTDecode'),'must embed JPEG image streams');
  assert.ok(text.trimEnd().endsWith('%%EOF'),'must end with %%EOF');

  // Verify every xref byte offset actually points to its "<id> 0 obj" header.
  const xrefIdx=text.indexOf('xref\n');
  assert.ok(xrefIdx>0);
  const startxrefMatch=/startxref\n(\d+)\n%%EOF/.exec(text);
  assert.equal(Number(startxrefMatch[1]),xrefIdx,'startxref must point to exact xref byte offset');
  const xrefLines=text.slice(xrefIdx).split('\n').slice(2,2+10);
  assert.equal(xrefLines[0],'0000000000 65535 f ');
  for(let id=1;id<=9;id++){
    const off=Number(xrefLines[id].slice(0,10));
    assert.ok(text.slice(off,off+20).startsWith(`${id} 0 obj\n`),`xref entry ${id} must match exact object offset`);
  }

  // Full multi-page report generation with long body, long code, 2 images (1 valid + 1 corrupt fallback), and non-image attachment.
  const longTask=Array.from({length:55},(_,i)=>`줄 ${i+1}: ABAP Data Type부터 DB Table 구조까지 실습 내용을 정리했습니다.`).join('\n');
  const longCode=Array.from({length:30},(_,i)=>`WRITE: / 'Line ${i+1}', sy-datum.`).join('\n');
  const blob=await pdf.generate({
    title:'1회차_2주차_6반_3조_이은호',
    pdfTitle:'1회차_2주차_6반_3조_이은호 멘토링 활동 결과보고서',
    date:'2026-11-25',
    timeRange:'18:00 ~ 20:00',
    mentorName:'이은호',
    participants:['이은호','김성재','김은철','김지수'],
    location:'CL6 강의장',
    task:longTask,
    code:longCode,
    images:[
      {id:'img1',name:'capture1.png',size:2048,type:'image/png',blob:new Blob(['valid-img'])},
      {id:'img2',name:'broken.png',size:1024,type:'image/png',blob:new Blob([])}
    ],
    otherFiles:[
      {id:'doc1',name:'summary.xlsx',size:1536*1024,type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
    ]
  });
  assert.equal(blob.type,'application/pdf');
  const outBytes=new Uint8Array(await blob.arrayBuffer());
  const outText=Buffer.from(outBytes).toString('latin1');
  const countMatch=/\/Count (\d+)/.exec(outText);
  assert.ok(countMatch&&Number(countMatch[1])>=2,'long report should paginate across multiple A4 pages');
  assert.equal(bitmapCalls,2,'must attempt decoding each image attachment');
  assert.equal(drawnImages.length,1,'valid image drawn while corrupt image gracefully falls back');
  assert.ok(drawnText.includes('이미지를 불러오지 못했습니다.'),'corrupt image must show fallback label');
  assert.ok(drawnText.some(t=>t.includes('첨부 자료 (3건)')),'must render combined attachment section heading');
  assert.ok(drawnText.includes('XLSX'),'must render non-image extension badge');
  assert.ok(drawnText.includes('1 / '+countMatch[1]),'must stamp page numbers in footer');
  console.log('PASS: direct A4 PDF 1.4 binary builder, exact xref offsets, Korean title metadata, multi-page pagination, images and attachments');
})().catch(e=>{console.error(e);process.exitCode=1;});
