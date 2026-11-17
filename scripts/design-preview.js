// Served only by the loopback preview server in place of production auth.js.
(() => {
  const user = {id:'design-sample', full_name:'디자인 미리보기', class_name:'샘플', mbti:'', role:'admin', status:'approved'};
  window.CodeWikiAuth = {
    isSupabaseConfigured: () => false,
    getSupabaseClient: () => null,
    getSessionToken: () => '',
    getCurrentUser: () => user
  };
  const key='codewiki_feedback_posts_v2';
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify([
    {id:1, author_id:'design-sample',author_name:'샘플 사용자',author_class:'미리보기',author_mbti:'',category:'내용 추가',title:'예제 추가 요청',content:'게시판 디자인을 확인하기 위한 샘플입니다.',status:'open',admin_note:'',created_at:'2026-11-17 17:00'},
    {id:2, author_id:'design-sample',author_name:'샘플 사용자',author_class:'미리보기',author_mbti:'',category:'수정 요청',title:'수정 완료 예시',content:'완료 상태와 답변을 확인하는 샘플입니다.',status:'done',admin_note:'샘플 답변입니다.',created_at:'2026-11-17 17:00'}
  ]));
  document.getElementById('sidebarProfileSlot').textContent='DESIGN V2 · 샘플 데이터';
  document.body.classList.add('authenticated');
  document.title='코드위키 · 디자인 V2 미리보기';
})();
