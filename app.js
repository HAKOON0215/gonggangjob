const views = ['student','schedule','applications'];
const studentView = document.querySelector('#student-view');
const employerView = document.querySelector('#employer-view');
const navButtons = document.querySelectorAll('[data-view]');
const toast = document.querySelector('#toast');

function showToast(message){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}
function showView(name){
  employerView.hidden=true;
  studentView.hidden=name!=='student';
  document.querySelector('#schedule-view').hidden=name!=='schedule';
  document.querySelector('#applications-view').hidden=name!=='applications';
  navButtons.forEach(btn=>btn.classList.toggle('active',btn.dataset.view===name));
  window.scrollTo({top:0,behavior:'smooth'});
}
navButtons.forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));

function showEmployer(){
  views.forEach(name=>{const el=document.querySelector(`#${name}-view`);if(el)el.hidden=true});
  employerView.hidden=false;
  document.querySelectorAll('.nav-item,.mobile-nav button').forEach(b=>b.classList.remove('active'));
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelector('.employer-toggle').addEventListener('click',showEmployer);
document.querySelector('.mobile-employer').addEventListener('click',showEmployer);
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();showView('student')});

document.querySelectorAll('.chip').forEach(chip=>chip.addEventListener('click',()=>{
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));chip.classList.add('active');
  const filter=chip.dataset.filter;let visible=0;
  document.querySelectorAll('.job-card').forEach(card=>{const match=filter==='all'||card.dataset.category.includes(filter);card.hidden=!match;if(match)visible++});
  document.querySelector('#empty-state').hidden=visible>0;
}));

document.querySelectorAll('.bookmark').forEach(button=>button.addEventListener('click',()=>{
  button.classList.toggle('saved');button.textContent=button.classList.contains('saved')?'♥':'♡';
  showToast(button.classList.contains('saved')?'관심 공고에 저장했어요':'관심 공고에서 삭제했어요');
}));

document.querySelectorAll('.apply-button').forEach(button=>button.addEventListener('click',()=>document.querySelector('#apply-modal').showModal()));
document.querySelectorAll('[data-open="schedule-modal"]').forEach(button=>button.addEventListener('click',()=>document.querySelector('#schedule-modal').showModal()));
document.querySelector('#post-job').addEventListener('click',()=>document.querySelector('#post-modal').showModal());
document.querySelector('#confirm-apply').addEventListener('click',()=>showToast('지원이 완료됐어요. 결과를 알려드릴게요!'));
document.querySelector('#confirm-post').addEventListener('click',()=>showToast('긴급 공고가 등록됐어요!'));
document.querySelector('#filter-button').addEventListener('click',()=>showToast('원하는 업무 유형을 선택해 보세요'));

const calendar=document.querySelector('#calendar-grid');
const events={"10-1":"스포츠심리학","15-1":"복싱전공실기","11-2":"체육철학","14-3":"운동생리학","10-4":"스포츠경영","13-5":"교양영어"};
for(let hour=9;hour<=18;hour++){
  const label=document.createElement('div');label.className='hour';label.textContent=`${hour}:00`;calendar.appendChild(label);
  for(let day=1;day<=5;day++){
    const slot=document.createElement('div');slot.className='slot';
    if(events[`${hour}-${day}`]){const event=document.createElement('div');event.className='class-event';event.textContent=events[`${hour}-${day}`];slot.appendChild(event)}
    calendar.appendChild(slot);
  }
}
