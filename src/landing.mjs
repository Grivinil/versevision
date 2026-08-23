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

const LANDING_HTML = String.raw`<!doctype html>
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
  <meta property="og:image:alt" content="VerseVision time-coded visual blueprints">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="__VERSEVISION_TITLE__">
  <meta name="twitter:description" content="__VERSEVISION_DESCRIPTION__">
  <meta name="twitter:image" content="__VERSEVISION_SOCIAL_IMAGE__">
  <title>__VERSEVISION_TITLE__</title>
  <script type="application/ld+json">__VERSEVISION_JSONLD__</script>
  <style>
    :root{color-scheme:dark;--bg:#090c12;--panel:#111824;--panel2:#172234;--line:#29364c;--text:#f5f7fb;--muted:#a5b0c3;--lime:#b9f36a;--blue:#79d7ff;--shadow:0 28px 90px #0009}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(900px 500px at 82% 0,#29465e 0,#131b29 43%,var(--bg) 78%);color:var(--text);font:16px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}a{color:inherit;text-decoration:none}a:focus-visible,button:focus-visible{outline:3px solid var(--blue);outline-offset:3px}.wrap{max-width:1160px;margin:auto;padding:28px 22px 78px}.nav{display:flex;justify-content:space-between;align-items:center;gap:20px}.brand{display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:.02em}.brand img{width:42px;height:42px;border-radius:13px}.links{display:flex;align-items:center;gap:24px;color:var(--muted);font-size:14px}.links a:hover{color:var(--text)}.button{display:inline-flex;align-items:center;justify-content:center;border-radius:12px;padding:11px 17px;font-weight:800}.button.primary{background:var(--lime);color:#11180d;box-shadow:0 10px 30px #b9f36a2b}.button.secondary{border:1px solid #536682;background:#172234;color:var(--text)}.hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:50px;align-items:center;padding:92px 0 82px}.eyebrow{color:var(--blue);font-size:12px;text-transform:uppercase;letter-spacing:.17em;font-weight:750}.hero h1{font-size:clamp(42px,7vw,78px);line-height:.99;letter-spacing:-.055em;margin:13px 0 20px;max-width:760px}.hero h1 em{font-style:normal;color:var(--lime)}.hero p{font-size:19px;color:var(--muted);max-width:670px;margin:0 0 26px}.actions{display:flex;gap:12px;flex-wrap:wrap}.hero-card{border:1px solid #4b6684;border-radius:24px;background:linear-gradient(150deg,#1d2c40e8,#0f151fee);box-shadow:var(--shadow);padding:24px;transform:rotate(1.3deg)}.hero-card .wave{height:105px;display:flex;align-items:center;gap:4px;margin:15px 0 20px}.hero-card .wave i{display:block;width:5px;border-radius:5px;background:linear-gradient(var(--lime),var(--blue));opacity:.88}.hero-card h2{font-size:18px;margin:0 0 5px}.hero-card p{font-size:13px;margin:0;color:var(--muted)}.section{padding:68px 0}.section-head{max-width:700px;margin-bottom:24px}.section h2{font-size:clamp(28px,4vw,44px);line-height:1.1;letter-spacing:-.035em;margin:9px 0 12px}.section-head p{color:var(--muted);font-size:17px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{padding:22px;border:1px solid var(--line);border-radius:18px;background:#121a27cc}.card .num{color:var(--lime);font-size:12px;font-weight:800;letter-spacing:.1em}.card h3{margin:10px 0 7px;font-size:18px}.card p{color:var(--muted);font-size:14px;margin:0}.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.step{border-top:2px solid #3d506c;padding:16px 10px 0}.step b{color:var(--blue);font-size:13px}.step h3{font-size:16px;margin:7px 0}.step p{color:var(--muted);font-size:13px;margin:0}.use-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.use{padding:20px;border-radius:16px;border:1px solid #2c3b51;background:linear-gradient(155deg,#162337,#101722)}.use h3{margin:0 0 6px;font-size:17px}.use p{color:var(--muted);font-size:13px;margin:0}.honest{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:26px;border:1px solid #514a31;border-radius:20px;background:#211d13}.honest h2{font-size:24px;margin:0 0 8px}.honest p{color:#dfd4af;font-size:14px;margin:0}.faq{border-top:1px solid var(--line)}details{border-bottom:1px solid var(--line);padding:17px 0}summary{cursor:pointer;font-weight:750}details p{color:var(--muted);font-size:14px;max-width:800px;margin:10px 0 0}.footer{border-top:1px solid var(--line);padding-top:20px;display:flex;justify-content:space-between;gap:15px;color:#738197;font-size:13px}.footer a{color:var(--blue)}
    @media(max-width:850px){.hero{grid-template-columns:1fr;padding:62px 0}.hero-card{max-width:500px}.cards,.steps{grid-template-columns:1fr 1fr}.use-grid{grid-template-columns:1fr 1fr}.honest{grid-template-columns:1fr}.links a:not(.button){display:none}}@media(max-width:520px){.wrap{padding-left:15px;padding-right:15px}.hero h1{font-size:47px}.cards,.steps,.use-grid{grid-template-columns:1fr}.footer{display:block}.footer span{display:block;margin-top:7px}}
  </style>
</head>
<body>
  <main class="wrap">
    <nav class="nav" aria-label="Primary"><a class="brand" href="/"><img src="/assets/versevision-logo.svg" alt="VerseVision"><span>VerseVision</span></a><div class="links"><a href="#how-it-works">How it works</a><a href="#use-cases">Use cases</a><a class="button primary" href="/studio">Try a free preview</a></div></nav>
    <section class="hero"><div><div class="eyebrow">Creative planning for music and narrative</div><h1>Make the next frame feel inevitable.<br><em>Start with the blueprint.</em></h1><p>VerseVision turns music, lyrics, and creative intent into a time-coded visual blueprint: coherent scenes, character behavior, camera language, and continuity rules ready for your generation workflow.</p><div class="actions"><a class="button primary" href="/studio">Build a free preview</a><a class="button secondary" href="#how-it-works">See how it works</a></div></div><aside class="hero-card" aria-label="VerseVision blueprint preview"><div class="eyebrow">A track becomes a visual arc</div><div class="wave" aria-hidden="true"><i style="height:32%"></i><i style="height:58%"></i><i style="height:41%"></i><i style="height:85%"></i><i style="height:47%"></i><i style="height:69%"></i><i style="height:30%"></i><i style="height:92%"></i><i style="height:55%"></i><i style="height:76%"></i><i style="height:38%"></i><i style="height:63%"></i><i style="height:88%"></i><i style="height:45%"></i><i style="height:72%"></i><i style="height:33%"></i><i style="height:80%"></i><i style="height:51%"></i><i style="height:67%"></i><i style="height:38%"></i></div><h2>00:08 · rising threshold</h2><p>Continue the same traveler, wardrobe, location anchor, and silver-thread motif as the lyric tension changes.</p></aside></section>
    <section class="section" id="features"><div class="section-head"><div class="eyebrow">What VerseVision gives you</div><h2>Direction with enough structure to survive the next tool.</h2><p>Use the blueprint as a handoff to an image or video generator, a director’s treatment, or a production planning document.</p></div><div class="cards"><article class="card"><div class="num">01 · TIMING</div><h3>Beat-aware sections</h3><p>Estimate BPM, energy, section windows, and scene timing so the visual plan moves with the track instead of floating above it.</p></article><article class="card"><div class="num">02 · STORY</div><h3>Continuity that carries</h3><p>Keep the same subject, setting, wardrobe, palette, anchor props, and spatial rules across every scene block.</p></article><article class="card"><div class="num">03 · LYRICS</div><h3>Words become behavior</h3><p>Translate lyric moments into visible action, props, and character choices. Optional alignment can produce LRC-ready timing.</p></article></div></section>
    <section class="section" id="how-it-works"><div class="section-head"><div class="eyebrow">A low-risk creative loop</div><h2>See the idea before you pay to generate the whole thing.</h2></div><div class="steps"><article class="step"><b>01 · UPLOAD</b><h3>Bring the track</h3><p>Upload MP3, WAV, or M4A. Add lyrics, a script, or a reference brief.</p></article><article class="step"><b>02 · SHAPE</b><h3>Set the world</h3><p>Choose narrative mode, mood, aspect ratio, camera language, and continuity anchors.</p></article><article class="step"><b>03 · PREVIEW</b><h3>Review two scenes</h3><p>See timing, narrative intent, subject action, camera, lighting, and warnings before committing.</p></article><article class="step"><b>04 · EXTEND</b><h3>Generate the full plan</h3><p>When checkout is enabled, unlock the complete time-coded blueprint and optional alignment artifacts.</p></article></div></section>
    <section class="section" id="use-cases"><div class="section-head"><div class="eyebrow">Built for more than one kind of voice</div><h2>Start with a song. Keep the narrative tools.</h2></div><div class="use-grid"><article class="use"><h3>Music videos</h3><p>Turn verses, hooks, and bridges into a coherent visual arc with generator-ready prompts.</p></article><article class="use"><h3>Guided meditation</h3><p>Plan breath-led transitions, symbolic journeys, and a consistent return to the body.</p></article><article class="use"><h3>Spoken word</h3><p>Make arguments, pauses, and emotional turns visible through character-led scenes.</p></article><article class="use"><h3>Cinematic narration</h3><p>Organize scripts into shot-ready blocks with a stable visual world and state progression.</p></article></div></section>
    <section class="section"><div class="honest"><div><div class="eyebrow">A deliberate boundary</div><h2>VerseVision plans the film. It does not pretend to render it.</h2></div><p>The output is a creative blueprint for the tools you already use: scene prompts, timing, continuity, visual direction, and optional lyric artifacts. That keeps the preview fast, the handoff inspectable, and the final generator choice yours.</p></div></section>
    <section class="section" id="faq"><div class="section-head"><div class="eyebrow">Questions people ask first</div><h2>Clear expectations make better creative choices.</h2></div><div class="faq"><details open><summary>Does VerseVision generate the finished music video?</summary><p>No. It creates a time-coded visual blueprint that you can place into your preferred image or video generation workflow.</p></details><details><summary>Can I use lyrics or a full script?</summary><p>Yes. You can paste lyrics or spoken text, upload a text or LRC file, and choose a narrative mode that fits the material.</p></details><details><summary>What does the free preview show?</summary><p>It analyzes the track and returns two sample scene blocks. The complete scene set and optional acoustic alignment remain behind the future checkout step.</p></details><details><summary>What is the most important input?</summary><p>A clear creative intent helps most: who or what the viewer follows, what should change, and what visual rules must remain consistent.</p></details></div></section>
    <footer class="footer"><span>© VerseVision · Creative planning for human and agent workflows</span><span><a href="/studio">Open the studio</a> · <a href="/sitemap.xml">Sitemap</a></span></footer>
  </main>
</body>
</html>`;

export function renderLandingHtml({ publicUrl } = {}) {
  const origin = String(publicUrl || '').replace(/\/+$/, '');
  const title = 'VerseVision — Time-Coded Visual Blueprints for Music';
  const description = 'Turn music, lyrics, and creative intent into generator-ready visual blueprints with time-coded scenes, continuity, and LRC-ready alignment.';
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
  return LANDING_HTML
    .replaceAll('__VERSEVISION_TITLE__', escapeAttribute(title))
    .replaceAll('__VERSEVISION_DESCRIPTION__', escapeAttribute(description))
    .replaceAll('__VERSEVISION_CANONICAL__', escapeAttribute(`${origin}/`))
    .replaceAll('__VERSEVISION_SOCIAL_IMAGE__', escapeAttribute(`${origin}/assets/versevision-social.svg`))
    .replace('__VERSEVISION_JSONLD__', jsonLd);
}
