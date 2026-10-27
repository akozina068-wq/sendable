/* Meta Pixel — loads only after cookie consent (UK PECR). Shared by every page. */
(function(){
  var PIXEL = '2323893205098670';
  var queued = [];
  function load(){
    if (window.fbq) return;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', PIXEL);
    fbq('track', 'PageView');
    queued.forEach(function(a){ fbq.apply(null, a); });
    queued = [];
  }
  function consent(){ try { return localStorage.getItem('pr_consent'); } catch(e){ return null; } }

  /* prTrack('track','Purchase',{...}) — sends now if consented, otherwise holds it until consent */
  window.prTrack = function(){
    var a = Array.prototype.slice.call(arguments);
    if (window.fbq) { fbq.apply(null, a); }
    else if (consent() !== 'no') { queued.push(a); }
  };

  /* prCount('scored') — anonymous funnel counter, no cookies. Visit any page with ?me=1 once to exclude your own device. */
  try { if (/[?&]me=1/.test(location.search)) localStorage.setItem('pr_me','1'); } catch(e){}
  window.prCount = function(name){
    try { if (localStorage.getItem('pr_me') === '1') return; } catch(e){}
    var body = JSON.stringify({ e: name });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/event', body);
    else fetch('/api/event', { method:'POST', body: body, keepalive: true });
  };
  var p = location.pathname.replace(/\.html$/, '');
  if (p === '/' || p === '/index') prCount('home');
  else if (p === '/app') { try { if (localStorage.getItem('sb_paid') !== 'yes') prCount('start'); } catch(e){ prCount('start'); } }
  else if (p === '/thanks') prCount('paid');

  if (consent() === 'yes') load();

  document.addEventListener('DOMContentLoaded', function(){
    if (consent()) return;
    var b = document.createElement('div');
    b.id = 'cookie-banner';
    b.setAttribute('role','dialog');
    b.setAttribute('aria-label','Cookie choice');
    b.innerHTML = '<p>We use one Meta cookie to see whether our ads work. Nothing else. <a href="/privacy">Privacy</a></p><div class="cb"><button class="no" data-consent="no">No thanks</button><button class="yes" data-consent="yes">OK</button></div>';
    document.body.appendChild(b);
    b.querySelectorAll('[data-consent]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var v = btn.getAttribute('data-consent');
        try { localStorage.setItem('pr_consent', v); } catch(e){}
        if (v === 'yes') load(); else queued = [];
        b.remove();
      });
    });
  });
})();
