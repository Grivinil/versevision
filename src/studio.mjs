export const STUDIO_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="__VERSEVISION_DESCRIPTION__">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="__VERSEVISION_CANONICAL__">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="VerseVision">
  <meta property="og:title" content="__VERSEVISION_TITLE__">
  <meta property="og:description" content="__VERSEVISION_DESCRIPTION__">
  <meta property="og:url" content="__VERSEVISION_CANONICAL__">
  <meta property="og:image" content="__VERSEVISION_SOCIAL_IMAGE__">
  <meta property="og:image:alt" content="VerseVision creative planning studio">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="__VERSEVISION_TITLE__">
  <meta name="twitter:description" content="__VERSEVISION_DESCRIPTION__">
  <meta name="twitter:image" content="__VERSEVISION_SOCIAL_IMAGE__">
  <title>__VERSEVISION_TITLE__</title>
  <script type="application/ld+json">__VERSEVISION_JSONLD__</script>
  <style>
    :root{color-scheme:dark;--bg:#090817;--panel:#121329eF;--panel2:#1a1640;--line:#45406f;--text:#fff7ff;--muted:#b9afd1;--pink:#ff4fd8;--cyan:#39efff;--lime:#caff70;--yellow:#ffe36e;--danger:#ff8ca9;--shadow:0 24px 80px #000b,0 0 30px #ff4fd81c}
    *{box-sizing:border-box}html{background:var(--bg)}body{margin:0;min-height:100vh;background:radial-gradient(900px 540px at 15% -10%,#2b1c63 0,#10112b 45%,transparent 75%),radial-gradient(820px 500px at 105% 25%,#064c69 0,#10132b 48%,transparent 77%),var(--bg);color:var(--text);font:15px/1.55 "Trebuchet MS",ui-sans-serif,system-ui,sans-serif;overflow-x:hidden}body:before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background:repeating-linear-gradient(0deg,#fff0 0 3px,#ff4fd807 4px 5px),linear-gradient(115deg,#ff4fd80b,#39efff08 40%,#caff7007);mix-blend-mode:screen;opacity:.45}body:after{content:"";position:fixed;left:-10%;right:-10%;bottom:-28vh;height:55vh;pointer-events:none;z-index:0;background:linear-gradient(#39efff3b 1px,transparent 1px),linear-gradient(90deg,#ff4fd83a 1px,transparent 1px);background-size:44px 28px;transform:perspective(280px) rotateX(55deg);transform-origin:bottom;mask-image:linear-gradient(transparent,#000)}button,input,textarea,select{font:inherit}button{cursor:pointer}a{color:var(--cyan)}
    .shell{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:30px 20px 70px}.top{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:28px}.brand{display:flex;align-items:center;gap:13px}.mark{display:grid;place-items:center;width:44px;height:44px;border:2px solid var(--cyan);border-radius:13px;background:linear-gradient(145deg,#ff4fd83b,#39efff23);font-weight:900;color:var(--lime);text-shadow:0 0 10px var(--lime);box-shadow:0 0 12px #39efff99,0 0 27px #ff4fd844;transform:skew(-3deg)}h1,h2,h3,p{margin-top:0}.brand h1{font-size:20px;letter-spacing:.08em;margin-bottom:1px;text-transform:uppercase;text-shadow:2px 2px 0 #ff4fd855}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.2em;color:var(--cyan);text-shadow:0 0 8px #39efff88}.top-note{color:var(--muted);font-size:13px;text-align:right}.hero{max-width:800px;margin-bottom:28px}.hero h2{font-size:clamp(29px,4vw,50px);line-height:1.03;letter-spacing:-.04em;margin:0 0 13px;text-shadow:3px 3px 0 #ff4fd822,0 0 22px #39efff2b}.hero p{color:var(--muted);font-size:17px;max-width:720px}.grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(330px,.92fr);gap:18px;align-items:start}.panel{position:relative;background:linear-gradient(160deg,#171633f2,#101225ee);border:1px solid #6c58a7;border-radius:18px;box-shadow:var(--shadow),inset 0 0 0 1px #39efff1a,0 0 18px #ff4fd815;padding:22px}.panel:before{content:"◆";position:absolute;top:12px;right:16px;color:var(--pink);font-size:10px;text-shadow:0 0 8px var(--pink)}.panel h3{font-size:17px;margin-bottom:5px;color:#fff}.sub{color:var(--muted);font-size:13px;margin-bottom:18px}.field{margin-bottom:15px}.field label{display:flex;justify-content:space-between;gap:10px;font-size:12px;font-weight:750;color:#f7eaff;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}.hint{font-weight:400;color:#a99cc7;text-transform:none;letter-spacing:0}.two,.three{display:grid;gap:12px}.two{grid-template-columns:1fr 1fr}.three{grid-template-columns:repeat(3,1fr)}input,textarea,select{width:100%;border:1px solid #514783;border-radius:9px;background:#090b1b;color:var(--text);padding:10px 11px;outline:none;transition:border-color .2s,box-shadow .2s,transform .2s}textarea{min-height:82px;resize:vertical}input:focus,textarea:focus,select:focus{border-color:var(--cyan);box-shadow:0 0 0 2px #39efff33,0 0 15px #39efff2b;transform:translateY(-1px)}.drop{border:1px dashed #9b5bd4;border-radius:14px;padding:22px;background:#0a0c1e;transition:.2s}.drop:hover,.drop.active{border-color:var(--pink);background:#ff4fd811;box-shadow:0 0 18px #ff4fd82a}.drop input{border:0;padding:0;background:transparent}.file-name{color:var(--muted);font-size:12px;margin-top:8px;min-height:18px}.actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:20px}.primary{border:1px solid #fff7;border-radius:10px;padding:12px 18px;background:linear-gradient(100deg,var(--lime),var(--yellow));color:#171329;font-weight:900;box-shadow:0 0 0 1px #fff2,0 0 18px #caff7088,0 8px 25px #ff4fd82c}.primary:hover{filter:brightness(1.08);transform:translateY(-2px);box-shadow:0 0 24px #caff70cc}.secondary{border:1px solid var(--cyan);border-radius:10px;padding:11px 15px;background:#152148;color:#f5f8ff;font-weight:800;box-shadow:0 0 13px #39efff33}.status{color:var(--muted);font-size:13px}.status.error{color:var(--danger)}.status.ok{color:var(--lime);text-shadow:0 0 8px #caff7088}.boundary{margin-top:18px;padding:15px;border-radius:12px;border:1px solid #a88548;background:#292015;color:#f0dda4;font-size:13px;box-shadow:inset 0 0 16px #ffe36e09}.boundary strong{display:block;color:var(--yellow);margin-bottom:4px}.result{display:none}.result.visible{display:block}.empty{border:1px dashed #665991;border-radius:12px;padding:18px;color:var(--muted);font-size:13px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.metric{padding:11px;border-radius:10px;background:#0b0e20;border:1px solid #514783;box-shadow:inset 0 0 12px #39efff0c}.metric b{display:block;font-size:20px;color:var(--cyan);text-shadow:0 0 9px #39efff88}.metric span{font-size:11px;color:var(--muted)}.scene{border:1px solid #674e91;background:#11142a;border-radius:12px;padding:15px;margin-top:11px;box-shadow:inset 0 0 16px #ff4fd809}.scene-head{display:flex;justify-content:space-between;gap:10px;color:#dce5f4;font-size:12px;margin-bottom:7px}.scene h4{font-size:15px;margin:0 0 8px;color:var(--lime);text-shadow:0 0 8px #caff7066}.scene p{font-size:13px;color:#d8d0e8;margin:5px 0}.scene .tag{display:inline-block;color:var(--cyan);font-size:11px;padding:2px 7px;border:1px solid #39efff77;border-radius:99px;margin-right:5px}.fine{font-size:12px;color:var(--muted)}.pill{display:inline-block;padding:4px 8px;border:1px solid #caff7088;border-radius:99px;color:var(--lime);font-size:11px;text-shadow:0 0 6px #caff7088}.check{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--muted)}.check input{width:auto;margin-top:4px}.panel details{margin-top:15px;border-top:1px solid #514783;padding-top:12px}.panel summary{cursor:pointer;color:var(--pink);font-weight:800;text-transform:uppercase;font-size:12px;letter-spacing:.1em;text-shadow:0 0 7px #ff4fd888}.footer{margin-top:26px;color:#8276a0;font-size:12px;text-align:center}
    @media(max-width:900px){.grid{grid-template-columns:1fr}.top-note{display:none}}@media(max-width:560px){.two,.three,.metrics{grid-template-columns:1fr 1fr}.hero h2{font-size:36px}.shell{padding:22px 13px 50px}.panel{padding:17px}}
  </style>
</head>
<body>
  <main class="shell">
    <header class="top"><div class="brand"><div class="mark">VV</div><div><div class="eyebrow">Creative planning studio</div><h1>VerseVision</h1></div></div><div class="top-note">Music → time-coded visual direction<br><span class="pill">Free preview</span></div></header>
    <section class="hero"><div class="eyebrow">Start with the story, not the render bill</div><h2>Turn a track and a creative idea into a visual blueprint.</h2><p>Upload a song, add lyrics or a brief, choose the narrative shape, and preview the first two scene blocks before deciding whether the full blueprint is worth generating.</p></section>
    <div class="grid">
      <form class="panel" id="studioForm">
        <h3>1 · Bring your material</h3><p class="sub">Your audio is analyzed for timing and energy. A lyric file is optional, but supplied lyrics make the scene direction more specific.</p>
        <div class="field"><label for="audio">Audio file <span class="hint">MP3, WAV, M4A · up to 5 minutes</span></label><div class="drop" id="drop"><input id="audio" name="audio" type="file" required accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"><div class="file-name" id="fileName">Choose a track to begin.</div></div></div>
        <div class="field"><label for="lyricsFile">Lyrics file <span class="hint">.txt or .lrc · optional</span></label><input id="lyricsFile" type="file" accept=".txt,.lrc,text/plain"><div class="file-name" id="lyricsFileName"></div></div>
        <div class="field"><label for="lyrics">Lyrics or spoken text <span class="hint">Tags such as [Verse] are welcome</span></label><textarea id="lyrics" placeholder="Paste lyrics, narration, or a meditation script here…"></textarea></div>
        <h3 style="margin-top:25px">2 · Shape the visual world</h3><p class="sub">These choices become explicit constraints in every scene block.</p>
        <div class="field"><label for="brief">Creative brief</label><textarea id="brief" placeholder="A lone traveler follows a glowing thread home through a changing cosmos."></textarea></div>
        <div class="two"><div class="field"><label for="mode">Narrative mode</label><select id="mode"><option value="song">Song · lyrical arc</option><option value="spoken_word">Spoken word · argument and turn</option><option value="meditation">Meditation · guided descent and return</option><option value="cinematic_narration">Cinematic narration · scene progression</option></select></div><div class="field"><label for="ratio">Production framing <span class="hint">optional</span></label><select id="ratio"><option value="">Flexible · choose later</option><option value="16:9">16:9 landscape</option><option value="9:16">9:16 vertical</option><option value="1:1">1:1 square</option><option value="4:5">4:5 portrait</option></select></div></div>
        <div class="two"><div class="field"><label for="genre">Genre <span class="hint">comma-separated</span></label><input id="genre" placeholder="indie pop, surrealism"></div><div class="field"><label for="mood">Mood <span class="hint">comma-separated</span></label><input id="mood" placeholder="warm, hopeful, playful"></div></div>
        <div class="field"><label for="style">Visual style</label><textarea id="style" placeholder="Cinematic practical light, tactile textures, restrained neon accents."></textarea></div>
        <div class="field"><label for="references">Reference URLs <span class="hint">one per line · optional</span></label><textarea id="references" placeholder="https://example.com/visual-reference"></textarea></div>
        <details><summary>World continuity · stays stable</summary><div style="height:12px"></div><div class="two"><div class="field"><label for="subject">Subject</label><input id="subject" placeholder="primary character or performer"></div><div class="field"><label for="setting">Setting</label><input id="setting" placeholder="recurring location/world"></div><div class="field"><label for="wardrobe">Wardrobe</label><input id="wardrobe" placeholder="specific wardrobe logic"></div><div class="field"><label for="palette">Baseline palette</label><input id="palette" placeholder="colors and light behavior"></div><div class="field"><label for="spatialRule">Spatial rule</label><input id="spatialRule" placeholder="left-to-right, orbit, descent…"></div><div class="field"><label for="camera">Global camera language</label><input id="camera" placeholder="restrained movement, no whip pans…"></div></div><div class="field"><label for="props">Required props <span class="hint">comma-separated</span></label><input id="props" placeholder="silver thread, mirror, old camera"></div><div class="field"><label for="avoid">Avoid <span class="hint">comma-separated</span></label><input id="avoid" placeholder="subtitles, logos, face drift"></div></details>
        <details><summary>Shot language · changes by section</summary><div style="height:12px"></div><p class="fine">Optional. Put one setup per line using a section label. Unlisted sections use the global camera language.</p><div class="field"><label for="shotLanguage">Section setups <span class="hint">intro, verse, chorus, bridge, outro</span></label><textarea id="shotLanguage" placeholder="intro: locked wide, slow push-in\nverse: medium tracking, intimate handheld\nchorus: sweeping wide orbit\nbridge: close orbit or locked-off contrast\noutro: slow pull-back"></textarea></div></details>
        <h3 style="margin-top:25px">3 · Choose the preview shape</h3>
        <div class="two"><div class="field"><label for="granularity">Scene granularity</label><select id="granularity"><option value="standard">Standard · ~8 seconds</option><option value="coarse">Coarse · ~20 seconds</option><option value="dense">Dense · ~5 seconds</option></select></div><div class="field"><label for="duration">Target duration <span class="hint">optional</span></label><input id="duration" type="number" min="1" max="300" placeholder="Use audio duration"></div></div>
        <div class="actions"><button class="primary" id="previewButton" type="submit">Generate free preview</button><span class="status" id="status" aria-live="polite">No payment required.</span></div>
        <div class="boundary"><strong>What stays behind the paywall</strong>The preview shows analysis plus two sample scene blocks. A full blueprint, complete scene set, acoustic alignment, and LRC export are generated only after checkout.</div>
      </form>
      <section class="panel result" id="result" aria-live="polite"><h3>Your preview</h3><p class="sub" id="resultIntro">A compact read on the track and the first visual decisions.</p><div id="resultBody"><div class="empty">Upload a track and generate a preview to see the result here.</div></div><div id="paidPanel" class="boundary" style="display:none"><strong>Ready for the full blueprint?</strong><span id="paidCopy">The next step is a $4.99 full blueprint with every time-coded scene.</span><div class="actions"><button class="secondary" id="paidButton" type="button">Continue to checkout</button><span class="status" id="paidStatus"></span></div><p class="fine" style="margin:9px 0 0">No charge is made by this preview. Human checkout will use a hosted card flow; AI agents can use the separate x402 route.</p></div></section>
    </div>
    <div class="footer">VerseVision keeps the creative decision visible before generation. Your source timestamps remain source claims unless acoustic alignment is purchased.</div>
  </main>
  <script>
    (function(){
      var form=document.getElementById('studioForm'), audio=document.getElementById('audio'), lyricsFile=document.getElementById('lyricsFile'), lyrics=document.getElementById('lyrics'), status=document.getElementById('status'), button=document.getElementById('previewButton'), result=document.getElementById('result'), resultBody=document.getElementById('resultBody'), paidPanel=document.getElementById('paidPanel'), paidButton=document.getElementById('paidButton'), paidStatus=document.getElementById('paidStatus'), drop=document.getElementById('drop');
      function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
      function csv(id){return document.getElementById(id).value.split(',').map(function(x){return x.trim();}).filter(Boolean);}
      function val(id){var v=document.getElementById(id).value.trim();return v||undefined;}
      function overrides(){var keys=['subject','setting','wardrobe','palette','spatialRule','camera'];var out={};keys.forEach(function(k){if(val(k))out[k]=val(k);});var props=csv('props'),avoid=csv('avoid');if(props.length)out.requiredProps=props;if(avoid.length)out.avoid=avoid;return Object.keys(out).length?out:undefined;}
      function shotLanguage(){var global=val('camera'), sections=[];document.getElementById('shotLanguage').value.split(/\r?\n/).map(function(line){return line.trim();}).filter(Boolean).forEach(function(line){var match=line.match(/^(intro|verse|pre-chorus|chorus|bridge|outro|default)\s*:\s*(.+)$/i);if(match)sections.push({section:match[1].toLowerCase(),setup:match[2].trim()});});if(!global&&!sections.length)return undefined;return {global:global,sections:sections};}
      audio.addEventListener('change',function(){var f=audio.files[0];document.getElementById('fileName').textContent=f?f.name+' · '+Math.round(f.size/1024)+' KB':'Choose a track to begin.';});
      lyricsFile.addEventListener('change',function(){var f=lyricsFile.files[0];if(!f)return;document.getElementById('lyricsFileName').textContent=f.name;var reader=new FileReader();reader.onload=function(){lyrics.value=String(reader.result||'');};reader.readAsText(f);});
      ['dragenter','dragover'].forEach(function(evt){drop.addEventListener(evt,function(e){e.preventDefault();drop.classList.add('active');});});['dragleave','drop'].forEach(function(evt){drop.addEventListener(evt,function(e){e.preventDefault();drop.classList.remove('active');});});drop.addEventListener('drop',function(e){if(e.dataTransfer.files.length){audio.files=e.dataTransfer.files;audio.dispatchEvent(new Event('change'));}});
      function render(body){var a=body.analysisSummary||{}, scenes=body.sampleScenes||[];var warnings=(body.warnings||[]).map(function(w){return '<span class="tag">'+esc(w.message||w.code)+'</span>';}).join('');var html='<div class="metrics"><div class="metric"><b>'+esc(a.bpm&&a.bpm.value!=null?a.bpm.value:'—')+'</b><span>BPM</span></div><div class="metric"><b>'+esc(a.sectionCount||0)+'</b><span>sections</span></div><div class="metric"><b>'+esc(a.estimatedSceneCount==null?'—':a.estimatedSceneCount)+'</b><span>full scenes</span></div><div class="metric"><b>'+esc(a.estimatedDurationSeconds==null?'—':Math.round(a.estimatedDurationSeconds)+'s')+'</b><span>duration</span></div></div>'+(warnings?'<p class="fine">'+warnings+'</p>':'');if(!scenes.length)html+='<div class="empty">Analysis completed, but no semantic section windows were available for sample scenes yet. The full route can still use the analysis once enabled.</div>';else{html+='<p class="fine">Two sample blocks from the beginning of the proposed visual arc:</p>';scenes.forEach(function(s){var n=s.narrative||{};html+='<article class="scene"><div class="scene-head"><span>'+esc((s.startSeconds||0).toFixed(1))+'s → '+esc((s.endSeconds||0).toFixed(1))+'s</span><span>'+esc(s.sectionLabel||'section')+'</span></div><h4>'+esc(n.arcRole||s.intent||'Scene direction')+'</h4><p><strong>Subject:</strong> '+esc(n.subject||'—')+'</p><p><strong>Scene:</strong> '+esc(n.scene||s.prompt||'—')+'</p><p><strong>Character action:</strong> '+esc(n.characterAction||'—')+'</p><p><strong>Camera:</strong> '+esc(s.camera&& (s.camera.shot||s.camera.movement)||'—')+' · <strong>Lighting:</strong> '+esc(s.lighting||'—')+'</p></article>';});}resultBody.innerHTML=html;result.classList.add('visible');paidPanel.style.display='block';}
      form.addEventListener('submit',async function(e){e.preventDefault();if(!audio.files[0]){status.textContent='Choose an audio file first.';status.className='status error';return;}button.disabled=true;status.textContent='Analyzing track…';status.className='status';var creative={brief:val('brief'),lyrics:lyrics.value.trim()||undefined,lyricsMode:lyrics.value.trim()?'provided':undefined,narrativeMode:document.getElementById('mode').value,genre:csv('genre'),mood:csv('mood'),visualStyle:val('style'),referenceUrls:document.getElementById('references').value.split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean),visualOverrides:overrides(),shotLanguage:shotLanguage()};var output={sceneGranularity:document.getElementById('granularity').value};var ratio=document.getElementById('ratio').value;if(ratio)output.aspectRatio=ratio;var spec={schema:'versevision/blueprint-request/v1',source:{kind:'upload',title:audio.files[0].name},creative:creative,alignment:{mode:'provisional'},output:output};var duration=val('duration');if(duration)spec.output.durationSeconds=Number(duration);var data=new FormData();data.append('spec',JSON.stringify(spec));data.append('audio',audio.files[0],audio.files[0].name);try{var response=await fetch('/v1/blueprint/preview',{method:'POST',body:data});var body=await response.json();if(!response.ok)throw new Error(body.error&&body.error.message||'Preview failed.');render(body);status.textContent='Preview ready — no payment required.';status.className='status ok';}catch(error){status.textContent=error.message;status.className='status error';}finally{button.disabled=false;}});
      paidButton.addEventListener('click',function(){paidStatus.textContent='Checkout is being wired; no charge was made. The full route is payment-gated.';paidStatus.className='status';});
    }());
  </script>
</body>
</html>`;

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function safeJsonLd(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

export function renderStudioHtml({ publicUrl, pagePath = '/studio' } = {}) {
  const origin = String(publicUrl || '').replace(/\/+$/, '');
  const isStudio = pagePath === '/studio';
  const title = isStudio
    ? 'VerseVision Studio — Time-Coded Visual Blueprints'
    : 'VerseVision — Time-Coded Visual Blueprints for Music';
  const description = isStudio
    ? 'Upload music, lyrics, and creative intent to preview generator-ready visual scenes with timing, continuity, and LRC-ready alignment.'
    : 'Turn music, lyrics, and creative intent into generator-ready visual blueprints with time-coded scenes, continuity, and LRC-ready alignment.';
  const canonical = `${origin}${pagePath}`;
  const jsonLd = safeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'VerseVision',
      url: origin,
      logo: `${origin}/assets/versevision-logo.svg`,
      description: 'Creative planning tools that turn music and intent into time-coded visual blueprints.'
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'VerseVision',
      url: origin,
      description
    }
  ]);
  return STUDIO_HTML
    .replaceAll('__VERSEVISION_TITLE__', escapeAttribute(title))
    .replaceAll('__VERSEVISION_DESCRIPTION__', escapeAttribute(description))
    .replaceAll('__VERSEVISION_CANONICAL__', escapeAttribute(canonical))
    .replaceAll('__VERSEVISION_SOCIAL_IMAGE__', escapeAttribute(`${origin}/assets/versevision-social.svg`))
    .replace('__VERSEVISION_JSONLD__', jsonLd);
}
